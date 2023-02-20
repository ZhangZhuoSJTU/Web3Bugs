// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/ISyntheticToken.sol";
import "./interfaces/IStaker.sol";
import "./interfaces/ILongShort.sol";
import "./interfaces/IYieldManager.sol";
import "./interfaces/IOracleManager.sol";

/**
 **** visit https://float.capital *****
 */

/// @title Core logic of Float Protocal markets
/// @author float.capital
/// @notice visit https://float.capital for more info
/// @dev All functions in this file are currently `virtual`. This is NOT to encourage inheritance.
/// It is merely for convenince when unit testing.
/// @custom:auditors This contract balances long and short sides.
contract LongShort is ILongShort, Initializable {
  /*╔═════════════════════════════╗
    ║          VARIABLES          ║
    ╚═════════════════════════════╝*/

  /* ══════ Fixed-precision constants ══════ */
  /// @notice this is the address that permanently locked initial liquidity for markets is held by.
  /// These tokens will never move so market can never have zero liquidity on a side.
  /// @dev f10a7 spells float in hex - for fun - important part is that the private key for this address in not known.
  address public constant PERMANENT_INITIAL_LIQUIDITY_HOLDER = 0xf10A7_F10A7_f10A7_F10a7_F10A7_f10a7_F10A7_f10a7;

  /// @dev an empty allocation of storage for use in future upgrades - inspiration from OZ:
  ///      https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/10f0f1a95b1b0fd5520351886bae7a03490f1056/contracts/token/ERC20/ERC20Upgradeable.sol#L361
  uint256[45] private __constantsGap;

  /* ══════ Global state ══════ */
  address public admin;
  address public treasury;
  uint32 public latestMarket;

  address public staker;
  address public tokenFactory;
  uint256[45] private __globalStateGap;

  /* ══════ Market specific ══════ */
  mapping(uint32 => bool) public marketExists;
  mapping(uint32 => uint256) public assetPrice;
  mapping(uint32 => uint256) public marketUpdateIndex;
  mapping(uint32 => address) public paymentTokens;
  mapping(uint32 => address) public yieldManagers;
  mapping(uint32 => address) public oracleManagers;
  mapping(uint32 => uint256) public marketTreasurySplitGradient_e18;

  /* ══════ Market + position (long/short) specific ══════ */
  mapping(uint32 => mapping(bool => address)) public syntheticTokens;
  mapping(uint32 => mapping(bool => uint256)) public marketSideValueInPaymentToken;

  /// @notice synthetic token prices of a given market of a (long/short) at every previous price update
  mapping(uint32 => mapping(bool => mapping(uint256 => uint256))) public syntheticToken_priceSnapshot;

  mapping(uint32 => mapping(bool => uint256)) public batched_amountPaymentToken_deposit;
  mapping(uint32 => mapping(bool => uint256)) public batched_amountSyntheticToken_redeem;
  mapping(uint32 => mapping(bool => uint256)) public batched_amountSyntheticToken_toShiftAwayFrom_marketSide;

  /* ══════ User specific ══════ */
  mapping(uint32 => mapping(address => uint256)) public userNextPrice_currentUpdateIndex;

  mapping(uint32 => mapping(bool => mapping(address => uint256))) public userNextPrice_paymentToken_depositAmount;
  mapping(uint32 => mapping(bool => mapping(address => uint256))) public userNextPrice_syntheticToken_redeemAmount;
  mapping(uint32 => mapping(bool => mapping(address => uint256)))
    public userNextPrice_syntheticToken_toShiftAwayFrom_marketSide;

  /*╔════════════════════════════╗
    ║           EVENTS           ║
    ╚════════════════════════════╝*/

  event LongShortV1(address admin, address treasury, address tokenFactory, address staker);

  event SystemStateUpdated(
    uint32 marketIndex,
    uint256 updateIndex,
    int256 underlyingAssetPrice,
    uint256 longValue,
    uint256 shortValue,
    uint256 longPrice,
    uint256 shortPrice
  );

  event SyntheticMarketCreated(
    uint32 marketIndex,
    address longTokenAddress,
    address shortTokenAddress,
    address paymentToken,
    uint256 initialAssetPrice,
    string name,
    string symbol,
    address oracleAddress,
    address yieldManagerAddress
  );

  event NextPriceRedeem(
    uint32 marketIndex,
    bool isLong,
    uint256 synthRedeemed,
    address user,
    uint256 oracleUpdateIndex
  );

  event NextPriceSyntheticPositionShift(
    uint32 marketIndex,
    bool isShiftFromLong,
    uint256 synthShifted,
    address user,
    uint256 oracleUpdateIndex
  );

  event NextPriceDeposit(
    uint32 marketIndex,
    bool isLong,
    uint256 depositAdded,
    address user,
    uint256 oracleUpdateIndex
  );

  event OracleUpdated(uint32 marketIndex, address oldOracleAddress, address newOracleAddress);

  event NewMarketLaunchedAndSeeded(uint32 marketIndex, uint256 initialSeed);

  event ExecuteNextPriceMintSettlementUser(address user, uint32 marketIndex, bool isLong, uint256 amount);

  event ExecuteNextPriceRedeemSettlementUser(address user, uint32 marketIndex, bool isLong, uint256 amount);

  event ExecuteNextPriceMarketSideShiftSettlementUser(
    address user,
    uint32 marketIndex,
    bool isShiftFromLong,
    uint256 amount
  );

  event ExecuteNextPriceSettlementsUser(address user, uint32 marketIndex);

  /*╔═════════════════════════════╗
    ║          MODIFIERS          ║
    ╚═════════════════════════════╝*/

  function adminOnlyModifierLogic() internal virtual {
    require(msg.sender == admin, "only admin");
  }

  modifier adminOnly() {
    adminOnlyModifierLogic();
    _;
  }

  function requireMarketExistsModifierLogic(uint32 marketIndex) internal view virtual {
    require(marketExists[marketIndex], "market doesn't exist");
  }

  modifier requireMarketExists(uint32 marketIndex) {
    requireMarketExistsModifierLogic(marketIndex);
    _;
  }

  modifier executeOutstandingNextPriceSettlements(address user, uint32 marketIndex) {
    _executeOutstandingNextPriceSettlements(user, marketIndex);
    _;
  }

  modifier updateSystemStateMarket(uint32 marketIndex) {
    _updateSystemStateInternal(marketIndex);
    _;
  }

  /*╔═════════════════════════════╗
    ║       CONTRACT SET-UP       ║
    ╚═════════════════════════════╝*/

  /// @notice Initializes the contract.
  /// @dev Calls OpenZeppelin's initializer modifier.
  /// @param _admin Address of the admin role.
  /// @param _treasury Address of the treasury.
  /// @param _tokenFactory Address of the contract which creates synthetic asset tokens.
  /// @param _staker Address of the contract which handles synthetic asset stakes.
  function initialize(
    address _admin,
    address _treasury,
    address _tokenFactory,
    address _staker
  ) external virtual initializer {
    admin = _admin;
    treasury = _treasury;
    tokenFactory = _tokenFactory;
    staker = _staker;

    emit LongShortV1(_admin, _treasury, _tokenFactory, _staker);
  }

  /*╔═══════════════════╗
    ║       ADMIN       ║
    ╚═══════════════════╝*/

  /// @notice Changes the admin address for this contract.
  /// @dev Can only be called by the current admin.
  /// @param _admin Address of the new admin.
  function changeAdmin(address _admin) external adminOnly {
    admin = _admin;
  }

  /// @notice Changes the treasury contract address for this contract.
  /// @dev Can only be called by the current admin.
  /// @param _treasury Address of the treasury contract
  function changeTreasury(address _treasury) external adminOnly {
    treasury = _treasury;
  }

  /// @notice Update oracle for a market
  /// @dev Can only be called by the current admin.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param _newOracleManager Address of the replacement oracle manager.
  function updateMarketOracle(uint32 marketIndex, address _newOracleManager) external adminOnly {
    // If not a oracle contract this would break things.. Test's arn't validating this
    // Ie require isOracle interface - ERC165
    address previousOracleManager = oracleManagers[marketIndex];
    oracleManagers[marketIndex] = _newOracleManager;
    emit OracleUpdated(marketIndex, previousOracleManager, _newOracleManager);
  }

  /// @notice changes the gradient of the line for determining the yield split between market and treasury.
  function changeMarketTreasurySplitGradient(uint32 marketIndex, uint256 _marketTreasurySplitGradient_e18)
    external
    adminOnly
  {
    marketTreasurySplitGradient_e18[marketIndex] = _marketTreasurySplitGradient_e18;
  }

  /*╔═════════════════════════════╗
    ║       MARKET CREATION       ║
    ╚═════════════════════════════╝*/

  /// @notice Creates an entirely new long/short market tracking an underlying oracle price.
  ///  Make sure the synthetic names/symbols are unique.
  /// @dev This does not make the market active.
  /// The `initializeMarket` function was split out separately to this function to reduce costs.
  /// @param syntheticName Name of the synthetic asset
  /// @param syntheticSymbol Symbol for the synthetic asset
  /// @param _paymentToken The address of the erc20 token used to buy this synthetic asset
  /// this will likely always be DAI
  /// @param _oracleManager The address of the oracle manager that provides the price feed for this market
  /// @param _yieldManager The contract that manages depositing the paymentToken into a yield bearing protocol
  function createNewSyntheticMarket(
    string calldata syntheticName,
    string calldata syntheticSymbol,
    address _paymentToken,
    address _oracleManager,
    address _yieldManager
  ) external adminOnly {
    latestMarket++;

    // Create new synthetic long token.
    syntheticTokens[latestMarket][true] = ITokenFactory(tokenFactory).createSyntheticToken(
      string(abi.encodePacked("Float Up ", syntheticName)),
      string(abi.encodePacked("fu", syntheticSymbol)),
      staker,
      latestMarket,
      true
    );

    // Create new synthetic short token.
    syntheticTokens[latestMarket][false] = ITokenFactory(tokenFactory).createSyntheticToken(
      string(abi.encodePacked("Float Down ", syntheticName)),
      string(abi.encodePacked("fd", syntheticSymbol)),
      staker,
      latestMarket,
      false
    );

    // Initial market state.
    paymentTokens[latestMarket] = _paymentToken;
    yieldManagers[latestMarket] = _yieldManager;
    oracleManagers[latestMarket] = _oracleManager;
    assetPrice[latestMarket] = uint256(IOracleManager(oracleManagers[latestMarket]).updatePrice());

    emit SyntheticMarketCreated(
      latestMarket,
      syntheticTokens[latestMarket][true],
      syntheticTokens[latestMarket][false],
      _paymentToken,
      assetPrice[latestMarket],
      syntheticName,
      syntheticSymbol,
      _oracleManager,
      _yieldManager
    );
  }

  /// @notice Seeds a new market with initial capital.
  /// @dev Only called when initializing a market.
  /// @param initialMarketSeedForEachMarketSide Amount in wei for which to seed both sides of the market.
  /// @param marketIndex An int32 which uniquely identifies a market.
  function _seedMarketInitially(uint256 initialMarketSeedForEachMarketSide, uint32 marketIndex) internal virtual {
    require(
      // You require at least 1e18 (1 payment token with 18 decimal places) of the underlying payment token to seed the market.
      initialMarketSeedForEachMarketSide >= 1e18,
      "Insufficient market seed"
    );

    uint256 amountToLockInYieldManager = initialMarketSeedForEachMarketSide * 2;
    _transferPaymentTokensFromUserToYieldManager(marketIndex, amountToLockInYieldManager);
    IYieldManager(yieldManagers[marketIndex]).depositPaymentToken(amountToLockInYieldManager);

    ISyntheticToken(syntheticTokens[latestMarket][true]).mint(
      PERMANENT_INITIAL_LIQUIDITY_HOLDER,
      initialMarketSeedForEachMarketSide
    );
    ISyntheticToken(syntheticTokens[latestMarket][false]).mint(
      PERMANENT_INITIAL_LIQUIDITY_HOLDER,
      initialMarketSeedForEachMarketSide
    );

    marketSideValueInPaymentToken[marketIndex][true] = initialMarketSeedForEachMarketSide;
    marketSideValueInPaymentToken[marketIndex][false] = initialMarketSeedForEachMarketSide;

    emit NewMarketLaunchedAndSeeded(marketIndex, initialMarketSeedForEachMarketSide);
  }

  /// @notice Sets a market as active once it has already been setup by createNewSyntheticMarket.
  /// @dev Seperated from createNewSyntheticMarket due to gas considerations.
  /// @param marketIndex An int32 which uniquely identifies the market.
  /// @param kInitialMultiplier Linearly decreasing multiplier for Float token issuance for the market when staking synths.
  /// @param kPeriod Time which kInitialMultiplier will last
  /// @param unstakeFee_e18 Base 1e18 percentage fee levied when unstaking for the market.
  /// @param balanceIncentiveCurve_exponent Sets the degree to which Float token issuance differs
  /// for market sides in unbalanced markets. See Staker.sol
  /// @param balanceIncentiveCurve_equilibriumOffset An offset to account for naturally imbalanced markets
  /// when Float token issuance should differ for market sides. See Staker.sol
  /// @param initialMarketSeedForEachMarketSide Amount of payment token that will be deposited in each market side to seed the market.
  function initializeMarket(
    uint32 marketIndex,
    uint256 kInitialMultiplier,
    uint256 kPeriod,
    uint256 unstakeFee_e18,
    uint256 initialMarketSeedForEachMarketSide,
    uint256 balanceIncentiveCurve_exponent,
    int256 balanceIncentiveCurve_equilibriumOffset,
    uint256 _marketTreasurySplitGradient_e18
  ) external adminOnly {
    require(!marketExists[marketIndex], "already initialized");
    require(marketIndex <= latestMarket, "index too high");

    marketExists[marketIndex] = true;

    marketTreasurySplitGradient_e18[marketIndex] = _marketTreasurySplitGradient_e18;

    // Set this value to one initially - 0 is a null value and thus potentially bug prone.
    marketUpdateIndex[marketIndex] = 1;

    // Add new staker funds with fresh synthetic tokens.
    IStaker(staker).addNewStakingFund(
      latestMarket,
      syntheticTokens[latestMarket][true],
      syntheticTokens[latestMarket][false],
      kInitialMultiplier,
      kPeriod,
      unstakeFee_e18,
      balanceIncentiveCurve_exponent,
      balanceIncentiveCurve_equilibriumOffset
    );

    _seedMarketInitially(initialMarketSeedForEachMarketSide, marketIndex);
  }

  /*╔══════════════════════════════╗
    ║       GETTER FUNCTIONS       ║
    ╚══════════════════════════════╝*/

  /// @notice Return the minimum of the 2 parameters. If they are equal return the first parameter.
  /// @param a Any uint256
  /// @param b Any uint256
  /// @return min The minimum of the 2 parameters.
  function _getMin(uint256 a, uint256 b) internal pure virtual returns (uint256) {
    if (a > b) {
      return b;
    } else {
      return a;
    }
  }

  /// @notice Calculates the conversion rate from synthetic tokens to payment tokens.
  /// @dev Synth tokens have a fixed 18 decimals.
  /// @param amountPaymentTokenBackingSynth Amount of payment tokens in that token's lowest denomination.
  /// @param amountSyntheticToken Amount of synth token in wei.
  /// @return syntheticTokenPrice The calculated conversion rate in base 1e18.
  function _getSyntheticTokenPrice(uint256 amountPaymentTokenBackingSynth, uint256 amountSyntheticToken)
    internal
    pure
    virtual
    returns (uint256 syntheticTokenPrice)
  {
    return (amountPaymentTokenBackingSynth * 1e18) / amountSyntheticToken;
  }

  /// @notice Converts synth token amounts to payment token amounts at a synth token price.
  /// @dev Price assumed base 1e18.
  /// @param amountSyntheticToken Amount of synth token in wei.
  /// @param syntheticTokenPriceInPaymentTokens The conversion rate from synth to payment tokens in base 1e18.
  /// @return amountPaymentToken The calculated amount of payment tokens in token's lowest denomination.
  function _getAmountPaymentToken(uint256 amountSyntheticToken, uint256 syntheticTokenPriceInPaymentTokens)
    internal
    pure
    virtual
    returns (uint256 amountPaymentToken)
  {
    return (amountSyntheticToken * syntheticTokenPriceInPaymentTokens) / 1e18;
  }

  /// @notice Converts payment token amounts to synth token amounts at a synth token price.
  /// @dev  Price assumed base 1e18.
  /// @param amountPaymentTokenBackingSynth Amount of payment tokens in that token's lowest denomination.
  /// @param syntheticTokenPriceInPaymentTokens The conversion rate from synth to payment tokens in base 1e18.
  /// @return amountSyntheticToken The calculated amount of synthetic token in wei.
  function _getAmountSyntheticToken(uint256 amountPaymentTokenBackingSynth, uint256 syntheticTokenPriceInPaymentTokens)
    internal
    pure
    virtual
    returns (uint256 amountSyntheticToken)
  {
    return (amountPaymentTokenBackingSynth * 1e18) / syntheticTokenPriceInPaymentTokens;
  }

  /**
  @notice Calculate the amount of target side synthetic tokens that are worth the same
          amount of payment tokens as X many synthetic tokens on origin side.
          The resulting equation comes from simplifying this function

            _getAmountSyntheticToken(
              _getAmountPaymentToken(
                amountOriginSynth,
                priceOriginSynth
              ),
              priceTargetSynth)

            Unpacking the function we get:
            ((amountOriginSynth * priceOriginSynth) / 1e18) * 1e18 / priceTargetSynth
              And simplifying this we get:
            (amountOriginSynth * priceOriginSynth) / priceTargetSynth
  @param amountSyntheticTokens_originSide Amount of synthetic tokens on origin side
  @param syntheticTokenPrice_originSide Price of origin side's synthetic token
  @param syntheticTokenPrice_targetSide Price of target side's synthetic token
  @return equivalentAmountSyntheticTokensOnTargetSide Amount of synthetic token on target side
  */
  function _getEquivalentAmountSyntheticTokensOnTargetSide(
    uint256 amountSyntheticTokens_originSide,
    uint256 syntheticTokenPrice_originSide,
    uint256 syntheticTokenPrice_targetSide
  ) internal pure virtual returns (uint256 equivalentAmountSyntheticTokensOnTargetSide) {
    equivalentAmountSyntheticTokensOnTargetSide =
      (amountSyntheticTokens_originSide * syntheticTokenPrice_originSide) /
      syntheticTokenPrice_targetSide;
  }

  /// @notice Given an executed next price shift from tokens on one market side to the other,
  /// determines how many other side tokens the shift was worth.
  /// @dev Intended for use primarily by Staker.sol
  /// @param marketIndex An uint32 which uniquely identifies a market.
  /// @param amountSyntheticToken_redeemOnOriginSide Amount of synth token in wei.
  /// @param isShiftFromLong Whether the token shift is from long to short (true), or short to long (false).
  /// @param priceSnapshotIndex Index which identifies which synth prices to use.
  /// @return amountSyntheticTokensToMintOnTargetSide The amount in wei of tokens for the other side that the shift was worth.
  function getAmountSyntheticTokenToMintOnTargetSide(
    uint32 marketIndex,
    uint256 amountSyntheticToken_redeemOnOriginSide,
    bool isShiftFromLong,
    uint256 priceSnapshotIndex
  ) public view virtual override returns (uint256 amountSyntheticTokensToMintOnTargetSide) {
    uint256 syntheticTokenPriceOnOriginSide = syntheticToken_priceSnapshot[marketIndex][isShiftFromLong][
      priceSnapshotIndex
    ];
    uint256 syntheticTokenPriceOnTargetSide = syntheticToken_priceSnapshot[marketIndex][!isShiftFromLong][
      priceSnapshotIndex
    ];

    amountSyntheticTokensToMintOnTargetSide = _getEquivalentAmountSyntheticTokensOnTargetSide(
      amountSyntheticToken_redeemOnOriginSide,
      syntheticTokenPriceOnOriginSide,
      syntheticTokenPriceOnTargetSide
    );
  }

  /**
  @notice The amount of a synth token a user is owed following a batch execution.
    4 possible states for next price actions:
        - "Pending" - means the next price update hasn't happened or been enacted on by the updateSystemState function.
        - "Confirmed" - means the next price has been updated by the updateSystemState function. There is still
        -               outstanding (lazy) computation that needs to be executed per user in the batch.
        - "Settled" - there is no more computation left for the user.
        - "Non-existant" - user has no next price actions.
    This function returns a calculated value only in the case of 'confirmed' next price actions.
    It should return zero for all other types of next price actions.
  @dev Used in SyntheticToken.sol balanceOf to allow for automatic reflection of next price actions.
  @param user The address of the user for whom to execute the function for.
  @param marketIndex An int32 which uniquely identifies a market.
  @param isLong Whether it is for the long synthetic asset or the short synthetic asset.
  @return confirmedButNotSettledBalance The amount in wei of tokens that the user is owed.
  */
  function getUsersConfirmedButNotSettledSynthBalance(
    address user,
    uint32 marketIndex,
    bool isLong
  ) external view virtual override requireMarketExists(marketIndex) returns (uint256 confirmedButNotSettledBalance) {
    uint256 currentMarketUpdateIndex = marketUpdateIndex[marketIndex];
    if (
      userNextPrice_currentUpdateIndex[marketIndex][user] != 0 &&
      userNextPrice_currentUpdateIndex[marketIndex][user] <= currentMarketUpdateIndex
    ) {
      uint256 amountPaymentTokenDeposited = userNextPrice_paymentToken_depositAmount[marketIndex][isLong][user];

      if (amountPaymentTokenDeposited > 0) {
        uint256 syntheticTokenPrice = syntheticToken_priceSnapshot[marketIndex][isLong][currentMarketUpdateIndex];

        confirmedButNotSettledBalance = _getAmountSyntheticToken(amountPaymentTokenDeposited, syntheticTokenPrice);
      }


        uint256 amountSyntheticTokensToBeShiftedAwayFromOriginSide
       = userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[marketIndex][!isLong][user];

      if (amountSyntheticTokensToBeShiftedAwayFromOriginSide > 0) {
        uint256 syntheticTokenPriceOnOriginSide = syntheticToken_priceSnapshot[marketIndex][!isLong][
          currentMarketUpdateIndex
        ];
        uint256 syntheticTokenPriceOnTargetSide = syntheticToken_priceSnapshot[marketIndex][isLong][
          currentMarketUpdateIndex
        ];

        confirmedButNotSettledBalance += _getEquivalentAmountSyntheticTokensOnTargetSide(
          amountSyntheticTokensToBeShiftedAwayFromOriginSide,
          syntheticTokenPriceOnOriginSide,
          syntheticTokenPriceOnTargetSide
        );
      }
    }
  }

  /**
   @notice Calculates the percentage in base 1e18 of how much of the accrued yield
   for a market should be allocated to treasury.
   @dev For gas considerations also returns whether the long side is imbalanced.
   @dev For gas considerations totalValueLockedInMarket is passed as a parameter as the function
   calling this function has pre calculated the value
   @param longValue The current total payment token value of the long side of the market.
   @param shortValue The current total payment token value of the short side of the market.
   @param totalValueLockedInMarket Total payment token value of both sides of the market.
   @return isLongSideUnderbalanced Whether the long side initially had less value than the short side.
   @return treasuryYieldPercent_e18 The percentage in base 1e18 of how much of the accrued yield
   for a market should be allocated to treasury.
   */
  function _getYieldSplit(
    uint32 marketIndex,
    uint256 longValue,
    uint256 shortValue,
    uint256 totalValueLockedInMarket
  ) internal view virtual returns (bool isLongSideUnderbalanced, uint256 treasuryYieldPercent_e18) {
    isLongSideUnderbalanced = longValue < shortValue;
    uint256 imbalance;

    if (isLongSideUnderbalanced) {
      imbalance = shortValue - longValue;
    } else {
      imbalance = longValue - shortValue;
    }

    // marketTreasurySplitGradient_e18 may be adjusted to ensure yield is given
    // to the market at a desired rate e.g. if a market tends to become imbalanced
    // frequently then the gradient can be increased to funnel yield to the market
    // quicker.
    // See this equation in latex: https://gateway.pinata.cloud/ipfs/QmXsW4cHtxpJ5BFwRcMSUw7s5G11Qkte13NTEfPLTKEx4x
    // Interact with this equation: https://www.desmos.com/calculator/pnl43tfv5b
    uint256 marketPercentCalculated_e18 = (imbalance * marketTreasurySplitGradient_e18[marketIndex]) /
      totalValueLockedInMarket;

    uint256 marketPercent_e18 = _getMin(marketPercentCalculated_e18, 1e18);

    treasuryYieldPercent_e18 = 1e18 - marketPercent_e18;
  }

  /*╔══════════════════════════════╗
    ║       HELPER FUNCTIONS       ║
    ╚══════════════════════════════╝*/

  /// @notice First gets yield from the yield manager and allocates it to market and treasury.
  /// It then allocates the full market yield portion to the underbalanced side of the market.
  /// NB this function also adjusts the value of the long and short side based on the latest
  /// price of the underlying asset received from the oracle. This function should ideally be
  /// called everytime there is an price update from the oracle. We have built a bot that does this.
  /// The system is still perectly safe if not called every price update, the synthetic will just
  /// less closely track the underlying asset.
  /// @dev In one function as yield should be allocated before rebalancing.
  /// This prevents an attack whereby the user imbalances a side to capture all accrued yield.
  /// @param marketIndex The market for which to execute the function for.
  /// @param newAssetPrice The new asset price.
  /// @param oldAssetPrice The old asset price.
  /// @return longValue The value of the long side after rebalancing.
  /// @return shortValue The value of the short side after rebalancing.
  function _claimAndDistributeYieldThenRebalanceMarket(
    uint32 marketIndex,
    int256 newAssetPrice,
    int256 oldAssetPrice
  ) internal virtual returns (uint256 longValue, uint256 shortValue) {
    // Claiming and distributing the yield
    longValue = marketSideValueInPaymentToken[marketIndex][true];
    shortValue = marketSideValueInPaymentToken[marketIndex][false];
    uint256 totalValueLockedInMarket = longValue + shortValue;

    (bool isLongSideUnderbalanced, uint256 treasuryYieldPercent_e18) = _getYieldSplit(
      marketIndex,
      longValue,
      shortValue,
      totalValueLockedInMarket
    );

    uint256 marketAmount = IYieldManager(yieldManagers[marketIndex])
    .distributeYieldForTreasuryAndReturnMarketAllocation(totalValueLockedInMarket, treasuryYieldPercent_e18);

    if (marketAmount > 0) {
      if (isLongSideUnderbalanced) {
        longValue += marketAmount;
      } else {
        shortValue += marketAmount;
      }
    }

    // Adjusting value of long and short pool based on price movement
    // The side/position with less liquidity has 100% percent exposure to the price movement.
    // The side/position with more liquidity will have exposure < 100% to the price movement.
    // I.e. Imagine $100 in longValue and $50 shortValue
    // long side would have $50/$100 = 50% exposure to price movements based on the liquidity imbalance.
    // min(longValue, shortValue) = $50 , therefore if the price change was -10% then
    // $50 * 10% = $5 gained for short side and conversely $5 lost for long side.
    int256 underbalancedSideValue = int256(_getMin(longValue, shortValue));

    // See this equation in latex: https://gateway.pinata.cloud/ipfs/QmPeJ3SZdn1GfxqCD4GDYyWTJGPMSHkjPJaxrzk2qTTPSE
    // Interact with this equation: https://www.desmos.com/calculator/t8gr6j5vsq
    int256 valueChange = ((newAssetPrice - oldAssetPrice) * underbalancedSideValue) / oldAssetPrice;

    if (valueChange > 0) {
      longValue += uint256(valueChange);
      shortValue -= uint256(valueChange);
    } else {
      longValue -= uint256(-valueChange);
      shortValue += uint256(-valueChange);
    }
  }

  /*╔═══════════════════════════════╗
    ║     UPDATING SYSTEM STATE     ║
    ╚═══════════════════════════════╝*/

  /// @notice Updates the value of the long and short sides to account for latest oracle price updates
  /// and batches all next price actions.
  /// @dev To prevent front-running only executes on price change from an oracle.
  /// We assume the function will be called for each market at least once per price update.
  /// Note Even if not called on every price update, this won't affect security, it will only affect how closely
  /// the synthetic asset actually tracks the underlying asset.
  /// @param marketIndex The market index for which to update.
  function _updateSystemStateInternal(uint32 marketIndex) internal virtual requireMarketExists(marketIndex) {
    // If a negative int is return this should fail.
    int256 newAssetPrice = IOracleManager(oracleManagers[marketIndex]).updatePrice();
    int256 oldAssetPrice = int256(assetPrice[marketIndex]);

    bool assetPriceHasChanged = oldAssetPrice != newAssetPrice;

    if (assetPriceHasChanged || msg.sender == staker) {
      uint256 syntheticTokenPrice_inPaymentTokens_long = syntheticToken_priceSnapshot[marketIndex][true][
        marketUpdateIndex[marketIndex]
      ];
      uint256 syntheticTokenPrice_inPaymentTokens_short = syntheticToken_priceSnapshot[marketIndex][false][
        marketUpdateIndex[marketIndex]
      ];
      // if there is a price change and the 'staker' contract has pending updates, push the stakers price snapshot index to the staker
      // (so the staker can handle its internal accounting)
      if (
        userNextPrice_currentUpdateIndex[marketIndex][staker] == marketUpdateIndex[marketIndex] + 1 &&
        assetPriceHasChanged
      ) {
        IStaker(staker).pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations(
          marketIndex,
          syntheticTokenPrice_inPaymentTokens_long,
          syntheticTokenPrice_inPaymentTokens_short,
          marketSideValueInPaymentToken[marketIndex][true],
          marketSideValueInPaymentToken[marketIndex][false],
          // This variable could allow users to do any next price actions in the future (not just synthetic side shifts)
          userNextPrice_currentUpdateIndex[marketIndex][staker]
        );
      } else {
        IStaker(staker).pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations(
          marketIndex,
          syntheticTokenPrice_inPaymentTokens_long,
          syntheticTokenPrice_inPaymentTokens_short,
          marketSideValueInPaymentToken[marketIndex][true],
          marketSideValueInPaymentToken[marketIndex][false],
          0
        );
      }

      // function will return here if the staker called this simply for the
      // purpose of adding a state point required in staker.sol for our rewards calculation
      if (!assetPriceHasChanged) {
        return;
      }

      (uint256 newLongPoolValue, uint256 newShortPoolValue) = _claimAndDistributeYieldThenRebalanceMarket(
        marketIndex,
        newAssetPrice,
        oldAssetPrice
      );

      syntheticTokenPrice_inPaymentTokens_long = _getSyntheticTokenPrice(
        newLongPoolValue,
        ISyntheticToken(syntheticTokens[marketIndex][true]).totalSupply()
      );
      syntheticTokenPrice_inPaymentTokens_short = _getSyntheticTokenPrice(
        newShortPoolValue,
        ISyntheticToken(syntheticTokens[marketIndex][false]).totalSupply()
      );

      assetPrice[marketIndex] = uint256(newAssetPrice);
      marketUpdateIndex[marketIndex] += 1;

      syntheticToken_priceSnapshot[marketIndex][true][
        marketUpdateIndex[marketIndex]
      ] = syntheticTokenPrice_inPaymentTokens_long;

      syntheticToken_priceSnapshot[marketIndex][false][
        marketUpdateIndex[marketIndex]
      ] = syntheticTokenPrice_inPaymentTokens_short;

      (
        int256 long_changeInMarketValue_inPaymentToken,
        int256 short_changeInMarketValue_inPaymentToken
      ) = _batchConfirmOutstandingPendingActions(
        marketIndex,
        syntheticTokenPrice_inPaymentTokens_long,
        syntheticTokenPrice_inPaymentTokens_short
      );

      newLongPoolValue = uint256(int256(newLongPoolValue) + long_changeInMarketValue_inPaymentToken);
      newShortPoolValue = uint256(int256(newShortPoolValue) + short_changeInMarketValue_inPaymentToken);
      marketSideValueInPaymentToken[marketIndex][true] = newLongPoolValue;
      marketSideValueInPaymentToken[marketIndex][false] = newShortPoolValue;

      emit SystemStateUpdated(
        marketIndex,
        marketUpdateIndex[marketIndex],
        newAssetPrice,
        newLongPoolValue,
        newShortPoolValue,
        syntheticTokenPrice_inPaymentTokens_long,
        syntheticTokenPrice_inPaymentTokens_short
      );
    }
  }

  /// @notice Updates the state of a market to account for the latest oracle price update.
  /// @param marketIndex An int32 which uniquely identifies a market.
  function updateSystemState(uint32 marketIndex) external override {
    _updateSystemStateInternal(marketIndex);
  }

  /// @notice Updates the state of multiples markets to account for their latest oracle price updates.
  /// @param marketIndexes An array of int32s which uniquely identify markets.
  function updateSystemStateMulti(uint32[] calldata marketIndexes) external override {
    for (uint256 i = 0; i < marketIndexes.length; i++) {
      _updateSystemStateInternal(marketIndexes[i]);
    }
  }

  /*╔════════════════════════════════╗
    ║           DEPOSIT              ║
    ╚════════════════════════════════╝*/

  /// @notice Transfers payment tokens for a market from msg.sender to this contract.
  /// @dev Tokens are transferred directly to this contract to be deposited by the yield manager in the batch to earn yield.
  ///      Since we check the return value of the transferFrom method, all payment tokens we use must conform to the ERC20 standard.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amount Amount of payment tokens in that token's lowest denominationto deposit.
  function _transferPaymentTokensFromUserToYieldManager(uint32 marketIndex, uint256 amount) internal virtual {
    require(IERC20(paymentTokens[marketIndex]).transferFrom(msg.sender, yieldManagers[marketIndex], amount));
  }

  /*╔═══════════════════════════╗
    ║       MINT POSITION       ║
    ╚═══════════════════════════╝*/

  /// @notice Allows users to mint synthetic assets for a market. To prevent front-running these mints are executed on the next price update from the oracle.
  /// @dev Called by external functions to mint either long or short. If a user mints multiple times before a price update, these are treated as a single mint.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amount Amount of payment tokens in that token's lowest denominationfor which to mint synthetic assets at next price.
  /// @param isLong Whether the mint is for a long or short synth.
  function _mintNextPrice(
    uint32 marketIndex,
    uint256 amount,
    bool isLong
  )
    internal
    virtual
    updateSystemStateMarket(marketIndex)
    executeOutstandingNextPriceSettlements(msg.sender, marketIndex)
  {
    _transferPaymentTokensFromUserToYieldManager(marketIndex, amount);

    batched_amountPaymentToken_deposit[marketIndex][isLong] += amount;
    userNextPrice_paymentToken_depositAmount[marketIndex][isLong][msg.sender] += amount;
    userNextPrice_currentUpdateIndex[marketIndex][msg.sender] = marketUpdateIndex[marketIndex] + 1;

    emit NextPriceDeposit(marketIndex, isLong, amount, msg.sender, marketUpdateIndex[marketIndex] + 1);
  }

  /// @notice Allows users to mint long synthetic assets for a market. To prevent front-running these mints are executed on the next price update from the oracle.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amount Amount of payment tokens in that token's lowest denominationfor which to mint synthetic assets at next price.
  function mintLongNextPrice(uint32 marketIndex, uint256 amount) external {
    _mintNextPrice(marketIndex, amount, true);
  }

  /// @notice Allows users to mint short synthetic assets for a market. To prevent front-running these mints are executed on the next price update from the oracle.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amount Amount of payment tokens in that token's lowest denominationfor which to mint synthetic assets at next price.
  function mintShortNextPrice(uint32 marketIndex, uint256 amount) external {
    _mintNextPrice(marketIndex, amount, false);
  }

  /*╔═══════════════════════════╗
    ║      REDEEM POSITION      ║
    ╚═══════════════════════════╝*/

  /// @notice Allows users to redeem their synthetic tokens for payment tokens. To prevent front-running these redeems are executed on the next price update from the oracle.
  /// @dev Called by external functions to redeem either long or short. Payment tokens are actually transferred to the user when executeOutstandingNextPriceSettlements is called from a function call by the user.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param tokens_redeem Amount in wei of synth tokens to redeem.
  /// @param isLong Whether this redeem is for a long or short synth.
  function _redeemNextPrice(
    uint32 marketIndex,
    uint256 tokens_redeem,
    bool isLong
  )
    internal
    virtual
    updateSystemStateMarket(marketIndex)
    executeOutstandingNextPriceSettlements(msg.sender, marketIndex)
  {
    require(
      ISyntheticToken(syntheticTokens[marketIndex][isLong]).transferFrom(msg.sender, address(this), tokens_redeem)
    );

    userNextPrice_syntheticToken_redeemAmount[marketIndex][isLong][msg.sender] += tokens_redeem;
    userNextPrice_currentUpdateIndex[marketIndex][msg.sender] = marketUpdateIndex[marketIndex] + 1;

    batched_amountSyntheticToken_redeem[marketIndex][isLong] += tokens_redeem;

    emit NextPriceRedeem(marketIndex, isLong, tokens_redeem, msg.sender, marketUpdateIndex[marketIndex] + 1);
  }

  /// @notice  Allows users to redeem long synthetic assets for a market. To prevent front-running these redeems are executed on the next price update from the oracle.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param tokens_redeem Amount in wei of synth tokens to redeem at the next oracle price.
  function redeemLongNextPrice(uint32 marketIndex, uint256 tokens_redeem) external {
    _redeemNextPrice(marketIndex, tokens_redeem, true);
  }

  /// @notice  Allows users to redeem short synthetic assets for a market. To prevent front-running these redeems are executed on the next price update from the oracle.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param tokens_redeem Amount in wei of synth tokens to redeem at the next oracle price.
  function redeemShortNextPrice(uint32 marketIndex, uint256 tokens_redeem) external {
    _redeemNextPrice(marketIndex, tokens_redeem, false);
  }

  /*╔═══════════════════════════╗
    ║       SHIFT POSITION      ║
    ╚═══════════════════════════╝*/

  /// @notice  Allows users to shift their position from one side of the market to the other in a single transaction. To prevent front-running these shifts are executed on the next price update from the oracle.
  /// @dev Called by external functions to shift either way. Intended for primary use by Staker.sol
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amountSyntheticTokensToShift Amount in wei of synthetic tokens to shift from the one side to the other at the next oracle price update.
  /// @param isShiftFromLong Whether the token shift is from long to short (true), or short to long (false).
  function _shiftPositionNextPrice(
    uint32 marketIndex,
    uint256 amountSyntheticTokensToShift,
    bool isShiftFromLong
  )
    internal
    virtual
    updateSystemStateMarket(marketIndex)
    executeOutstandingNextPriceSettlements(msg.sender, marketIndex)
  {
    require(
      ISyntheticToken(syntheticTokens[marketIndex][isShiftFromLong]).transferFrom(
        msg.sender,
        address(this),
        amountSyntheticTokensToShift
      )
    );

    userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[marketIndex][isShiftFromLong][
      msg.sender
    ] += amountSyntheticTokensToShift;
    userNextPrice_currentUpdateIndex[marketIndex][msg.sender] = marketUpdateIndex[marketIndex] + 1;

    batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][
      isShiftFromLong
    ] += amountSyntheticTokensToShift;

    emit NextPriceSyntheticPositionShift(
      marketIndex,
      isShiftFromLong,
      amountSyntheticTokensToShift,
      msg.sender,
      marketUpdateIndex[marketIndex] + 1
    );
  }

  /// @notice Allows users to shift their position from long to short in a single transaction. To prevent front-running these shifts are executed on the next price update from the oracle.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amountSyntheticTokensToShift Amount in wei of synthetic tokens to shift from long to short the next oracle price update.
  function shiftPositionFromLongNextPrice(uint32 marketIndex, uint256 amountSyntheticTokensToShift) external override {
    _shiftPositionNextPrice(marketIndex, amountSyntheticTokensToShift, true);
  }

  /// @notice Allows users to shift their position from short to long in a single transaction. To prevent front-running these shifts are executed on the next price update from the oracle.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param amountSyntheticTokensToShift Amount in wei of synthetic tokens to shift from the short to long at the next oracle price update.
  function shiftPositionFromShortNextPrice(uint32 marketIndex, uint256 amountSyntheticTokensToShift) external override {
    _shiftPositionNextPrice(marketIndex, amountSyntheticTokensToShift, false);
  }

  /*╔════════════════════════════════╗
    ║     NEXT PRICE SETTLEMENTS     ║
    ╚════════════════════════════════╝*/

  /// @notice Transfers outstanding synth tokens from a next price mint to the user.
  /// @dev The outstanding synths should already be reflected for the user due to balanceOf in SyntheticToken.sol, this just does the accounting.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param user The address of the user for whom to execute the function for.
  /// @param isLong Whether this is for the long or short synth for the market.
  function _executeOutstandingNextPriceMints(
    uint32 marketIndex,
    address user,
    bool isLong
  ) internal virtual {
    uint256 currentPaymentTokenDepositAmount = userNextPrice_paymentToken_depositAmount[marketIndex][isLong][user];
    if (currentPaymentTokenDepositAmount > 0) {
      userNextPrice_paymentToken_depositAmount[marketIndex][isLong][user] = 0;
      uint256 amountSyntheticTokensToTransferToUser = _getAmountSyntheticToken(
        currentPaymentTokenDepositAmount,
        syntheticToken_priceSnapshot[marketIndex][isLong][userNextPrice_currentUpdateIndex[marketIndex][user]]
      );
      require(
        ISyntheticToken(syntheticTokens[marketIndex][isLong]).transfer(user, amountSyntheticTokensToTransferToUser)
      );

      emit ExecuteNextPriceMintSettlementUser(user, marketIndex, isLong, amountSyntheticTokensToTransferToUser);
    }
  }

  /// @notice Transfers outstanding payment tokens from a next price redemption to the user.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param user The address of the user for whom to execute the function for.
  /// @param isLong Whether this is for the long or short synth for the market.
  function _executeOutstandingNextPriceRedeems(
    uint32 marketIndex,
    address user,
    bool isLong
  ) internal virtual {
    uint256 currentSyntheticTokenRedemptions = userNextPrice_syntheticToken_redeemAmount[marketIndex][isLong][user];
    if (currentSyntheticTokenRedemptions > 0) {
      userNextPrice_syntheticToken_redeemAmount[marketIndex][isLong][user] = 0;
      uint256 amountPaymentToken_toRedeem = _getAmountPaymentToken(
        currentSyntheticTokenRedemptions,
        syntheticToken_priceSnapshot[marketIndex][isLong][userNextPrice_currentUpdateIndex[marketIndex][user]]
      );

      IYieldManager(yieldManagers[marketIndex]).transferPaymentTokensToUser(user, amountPaymentToken_toRedeem);

      emit ExecuteNextPriceRedeemSettlementUser(user, marketIndex, isLong, amountPaymentToken_toRedeem);
    }
  }

  /// @notice Transfers outstanding synth tokens from a next price position shift to the user.
  /// @dev The outstanding synths should already be reflected for the user due to balanceOf in SyntheticToken.sol, this just does the accounting.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param user The address of the user for whom to execute the function for.
  /// @param isShiftFromLong Whether the token shift was from long to short (true), or short to long (false).
  function _executeOutstandingNextPriceTokenShifts(
    uint32 marketIndex,
    address user,
    bool isShiftFromLong
  ) internal virtual {
    uint256 syntheticToken_toShiftAwayFrom_marketSide = userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[
      marketIndex
    ][isShiftFromLong][user];
    if (syntheticToken_toShiftAwayFrom_marketSide > 0) {
      uint256 syntheticToken_toShiftTowardsTargetSide = getAmountSyntheticTokenToMintOnTargetSide(
        marketIndex,
        syntheticToken_toShiftAwayFrom_marketSide,
        isShiftFromLong,
        userNextPrice_currentUpdateIndex[marketIndex][user]
      );

      userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[marketIndex][isShiftFromLong][user] = 0;

      require(
        ISyntheticToken(syntheticTokens[marketIndex][!isShiftFromLong]).transfer(
          user,
          syntheticToken_toShiftTowardsTargetSide
        )
      );

      emit ExecuteNextPriceMarketSideShiftSettlementUser(
        user,
        marketIndex,
        isShiftFromLong,
        syntheticToken_toShiftTowardsTargetSide
      );
    }
  }

  /// @notice After markets have been batched updated on a new oracle price, transfers any owed tokens to a user from their next price actions for that update to that user.
  /// @dev Once the market has updated for the next price, should be guaranteed (through modifiers) to execute for a user before user initiation of new next price actions.
  /// @param user The address of the user for whom to execute the function for.
  /// @param marketIndex An int32 which uniquely identifies a market.
  function _executeOutstandingNextPriceSettlements(address user, uint32 marketIndex) internal virtual {
    uint256 userCurrentUpdateIndex = userNextPrice_currentUpdateIndex[marketIndex][user];
    if (userCurrentUpdateIndex != 0 && userCurrentUpdateIndex <= marketUpdateIndex[marketIndex]) {
      _executeOutstandingNextPriceMints(marketIndex, user, true);
      _executeOutstandingNextPriceMints(marketIndex, user, false);
      _executeOutstandingNextPriceRedeems(marketIndex, user, true);
      _executeOutstandingNextPriceRedeems(marketIndex, user, false);
      _executeOutstandingNextPriceTokenShifts(marketIndex, user, true);
      _executeOutstandingNextPriceTokenShifts(marketIndex, user, false);

      userNextPrice_currentUpdateIndex[marketIndex][user] = 0;

      emit ExecuteNextPriceSettlementsUser(user, marketIndex);
    }
  }

  /// @notice After markets have been batched updated on a new oracle price, transfers any owed tokens to a user from their next price actions for that update to that user.
  /// @param user The address of the user for whom to execute the function for.
  /// @param marketIndex An int32 which uniquely identifies a market.
  function executeOutstandingNextPriceSettlementsUser(address user, uint32 marketIndex) external override {
    _executeOutstandingNextPriceSettlements(user, marketIndex);
  }

  /// @notice Executes outstanding next price settlements for a user for multiple markets.
  /// @param user The address of the user for whom to execute the function for.
  /// @param marketIndexes An array of int32s which each uniquely identify a market.
  function executeOutstandingNextPriceSettlementsUserMulti(address user, uint32[] memory marketIndexes) external {
    for (uint256 i = 0; i < marketIndexes.length; i++) {
      _executeOutstandingNextPriceSettlements(user, marketIndexes[i]);
    }
  }

  /*╔═══════════════════════════════════════════╗
    ║   BATCHED NEXT PRICE SETTLEMENT ACTIONS   ║
    ╚═══════════════════════════════════════════╝*/

  /// @notice Either transfers funds from the yield manager to this contract if redeems > deposits,
  /// and visa versa. The yield manager handles depositing and withdrawing the funds from a yield market.
  /// @dev When all batched next price actions are handled the total value in the market can either increase or decrease based on the value of mints and redeems.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param totalPaymentTokenValueChangeForMarket An int256 which indicates the magnitude and direction of the change in market value.
  function _handleTotalPaymentTokenValueChangeForMarketWithYieldManager(
    uint32 marketIndex,
    int256 totalPaymentTokenValueChangeForMarket
  ) internal virtual {
    if (totalPaymentTokenValueChangeForMarket > 0) {
      IYieldManager(yieldManagers[marketIndex]).depositPaymentToken(uint256(totalPaymentTokenValueChangeForMarket));
    } else if (totalPaymentTokenValueChangeForMarket < 0) {
      // NB there will be issues here if not enough liquidity exists to withdraw
      // Boolean should be returned from yield manager and think how to appropriately handle this
      IYieldManager(yieldManagers[marketIndex]).removePaymentTokenFromMarket(
        uint256(-totalPaymentTokenValueChangeForMarket)
      );
    }
  }

  /// @notice Given a desired change in synth token supply, either mints or burns tokens to achieve that desired change.
  /// @dev When all batched next price actions are executed total supply for a synth can either increase or decrease.
  /// @param marketIndex An int32 which uniquely identifies a market.
  /// @param isLong Whether this function should execute for the long or short synth for the market.
  /// @param changeInSyntheticTokensTotalSupply The amount in wei by which synth token supply should change.
  function _handleChangeInSyntheticTokensTotalSupply(
    uint32 marketIndex,
    bool isLong,
    int256 changeInSyntheticTokensTotalSupply
  ) internal virtual {
    if (changeInSyntheticTokensTotalSupply > 0) {
      ISyntheticToken(syntheticTokens[marketIndex][isLong]).mint(
        address(this),
        uint256(changeInSyntheticTokensTotalSupply)
      );
    } else if (changeInSyntheticTokensTotalSupply < 0) {
      ISyntheticToken(syntheticTokens[marketIndex][isLong]).burn(uint256(-changeInSyntheticTokensTotalSupply));
    }
  }

  /**
  @notice Performs all batched next price actions on an oracle price update.
  @dev Mints or burns all synthetic tokens for this contract.

    After this function is executed all user actions in that batch are confirmed and can be settled individually by
      calling _executeOutstandingNexPriceSettlements for a given user.

    The maths here is safe from rounding errors since it always over estimates on the batch with division.
      (as an example (5/3) + (5/3) = 2 but (5+5)/3 = 10/3 = 3, so the batched action would mint one more)
  @param marketIndex An int32 which uniquely identifies a market.
  @param syntheticTokenPrice_inPaymentTokens_long The long synthetic token price for this oracle price update.
  @param syntheticTokenPrice_inPaymentTokens_short The short synthetic token price for this oracle price update.
  @return long_changeInMarketValue_inPaymentToken The total value change for the long side after all batched actions are executed.
  @return short_changeInMarketValue_inPaymentToken The total value change for the short side after all batched actions are executed.
  */
  function _batchConfirmOutstandingPendingActions(
    uint32 marketIndex,
    uint256 syntheticTokenPrice_inPaymentTokens_long,
    uint256 syntheticTokenPrice_inPaymentTokens_short
  )
    internal
    virtual
    returns (int256 long_changeInMarketValue_inPaymentToken, int256 short_changeInMarketValue_inPaymentToken)
  {
    int256 changeInSupply_syntheticToken_long;
    int256 changeInSupply_syntheticToken_short;

    // NOTE: the only reason we are re-uising amountForCurrentAction_workingVariable for all actions (redeemLong, redeemShort, mintLong, mintShort, shiftFromLong, shiftFromShort) is to reduce stack usage
    uint256 amountForCurrentAction_workingVariable = batched_amountPaymentToken_deposit[marketIndex][true];

    // Handle batched deposits LONG
    if (amountForCurrentAction_workingVariable > 0) {
      long_changeInMarketValue_inPaymentToken = int256(amountForCurrentAction_workingVariable);

      batched_amountPaymentToken_deposit[marketIndex][true] = 0;

      changeInSupply_syntheticToken_long = int256(
        _getAmountSyntheticToken(amountForCurrentAction_workingVariable, syntheticTokenPrice_inPaymentTokens_long)
      );
    }

    // Handle batched deposits SHORT
    amountForCurrentAction_workingVariable = batched_amountPaymentToken_deposit[marketIndex][false];
    if (amountForCurrentAction_workingVariable > 0) {
      short_changeInMarketValue_inPaymentToken = int256(amountForCurrentAction_workingVariable);

      batched_amountPaymentToken_deposit[marketIndex][false] = 0;

      changeInSupply_syntheticToken_short = int256(
        _getAmountSyntheticToken(amountForCurrentAction_workingVariable, syntheticTokenPrice_inPaymentTokens_short)
      );
    }

    // Handle shift tokens from LONG to SHORT
    amountForCurrentAction_workingVariable = batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][true];
    if (amountForCurrentAction_workingVariable > 0) {
      int256 paymentTokenValueChangeForShiftToShort = int256(
        _getAmountPaymentToken(amountForCurrentAction_workingVariable, syntheticTokenPrice_inPaymentTokens_long)
      );

      long_changeInMarketValue_inPaymentToken -= paymentTokenValueChangeForShiftToShort;
      short_changeInMarketValue_inPaymentToken += paymentTokenValueChangeForShiftToShort;

      changeInSupply_syntheticToken_long -= int256(amountForCurrentAction_workingVariable);
      changeInSupply_syntheticToken_short += int256(
        _getEquivalentAmountSyntheticTokensOnTargetSide(
          amountForCurrentAction_workingVariable,
          syntheticTokenPrice_inPaymentTokens_long,
          syntheticTokenPrice_inPaymentTokens_short
        )
      );

      batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][true] = 0;
    }

    // Handle shift tokens from SHORT to LONG
    amountForCurrentAction_workingVariable = batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][
      false
    ];
    if (amountForCurrentAction_workingVariable > 0) {
      int256 paymentTokenValueChangeForShiftToLong = int256(
        _getAmountPaymentToken(amountForCurrentAction_workingVariable, syntheticTokenPrice_inPaymentTokens_short)
      );

      short_changeInMarketValue_inPaymentToken -= paymentTokenValueChangeForShiftToLong;
      long_changeInMarketValue_inPaymentToken += paymentTokenValueChangeForShiftToLong;

      changeInSupply_syntheticToken_short -= int256(amountForCurrentAction_workingVariable);
      changeInSupply_syntheticToken_long += int256(
        _getEquivalentAmountSyntheticTokensOnTargetSide(
          amountForCurrentAction_workingVariable,
          syntheticTokenPrice_inPaymentTokens_short,
          syntheticTokenPrice_inPaymentTokens_long
        )
      );

      batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][true] = 0;
    }

    // Handle batched redeems LONG
    amountForCurrentAction_workingVariable = batched_amountSyntheticToken_redeem[marketIndex][true];
    if (amountForCurrentAction_workingVariable > 0) {
      long_changeInMarketValue_inPaymentToken -= int256(
        _getAmountPaymentToken(amountForCurrentAction_workingVariable, syntheticTokenPrice_inPaymentTokens_long)
      );
      changeInSupply_syntheticToken_long -= int256(amountForCurrentAction_workingVariable);

      batched_amountSyntheticToken_redeem[marketIndex][true] = 0;
    }

    // Handle batched redeems SHORT
    amountForCurrentAction_workingVariable = batched_amountSyntheticToken_redeem[marketIndex][false];
    if (amountForCurrentAction_workingVariable > 0) {
      short_changeInMarketValue_inPaymentToken -= int256(
        _getAmountPaymentToken(amountForCurrentAction_workingVariable, syntheticTokenPrice_inPaymentTokens_short)
      );
      changeInSupply_syntheticToken_short -= int256(amountForCurrentAction_workingVariable);

      batched_amountSyntheticToken_redeem[marketIndex][false] = 0;
    }

    // Batch settle payment tokens
    _handleTotalPaymentTokenValueChangeForMarketWithYieldManager(
      marketIndex,
      long_changeInMarketValue_inPaymentToken + short_changeInMarketValue_inPaymentToken
    );
    // Batch settle synthetic tokens
    _handleChangeInSyntheticTokensTotalSupply(marketIndex, true, changeInSupply_syntheticToken_long);
    _handleChangeInSyntheticTokensTotalSupply(marketIndex, false, changeInSupply_syntheticToken_short);
  }
}
