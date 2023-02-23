// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;
pragma abicoder v2;

import {IStakedToken} from "./interfaces/IStakedToken.sol";
import {GamifiedVotingToken} from "./GamifiedVotingToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Root} from "../../shared/Root.sol";
import {InitializableReentrancyGuard} from "../../shared/InitializableReentrancyGuard.sol";
import "./deps/GamifiedTokenStructs.sol";

/**
 * @title StakedToken
 * @notice StakedToken is a non-transferrable ERC20 token that allows users to stake and withdraw, earning voting rights.
 * Scaled balance is determined by quests a user completes, and the length of time they keep the raw balance wrapped.
 * Stakers can unstake, after the elapsed cooldown period, and before the end of the unstake window. Users voting/earning
 * power is slashed during this time, and they may face a redemption fee if they leave early.
 * The reason for this unstake window is that this StakedToken acts as a source of insurance value for the mStable system,
 * which can access the funds via the Recollateralisation module, up to the amount defined in `safetyData`.
 * Voting power can be used for a number of things: voting in the mStable DAO/emission dials, boosting rewards, earning
 * rewards here. While a users "balance" is unique to themselves, they can choose to delegate their voting power (which will apply
 * to voting in the mStable DAO and emission dials).
 * @author mStable
 * @dev Only whitelisted contracts can communicate with this contract, in order to avoid having tokenised wrappers that
 * could potentially circumvent our unstaking procedure.
 **/
contract StakedToken is GamifiedVotingToken, InitializableReentrancyGuard {
  using SafeERC20 for IERC20;

  /// @notice Core token that is staked and tracked (e.g. MTA)
  IERC20 public immutable STAKED_TOKEN;
  /// @notice Seconds a user must wait after she initiates her cooldown before withdrawal is possible
  uint256 public immutable COOLDOWN_SECONDS;
  /// @notice Window in which it is possible to withdraw, following the cooldown period
  uint256 public immutable UNSTAKE_WINDOW;
  /// @notice A week
  uint256 private constant ONE_WEEK = 7 days;

  struct SafetyData {
    /// Percentage of collateralisation where 100% = 1e18
    uint128 collateralisationRatio;
    /// Slash % where 100% = 1e18
    uint128 slashingPercentage;
  }

  /// @notice Data relating to the re-collateralisation safety module
  SafetyData public safetyData;

  /// @notice Whitelisted smart contract integrations
  mapping(address => bool) public whitelistedWrappers;

  event Staked(address indexed user, uint256 amount, address delegatee);
  event Withdraw(address indexed user, address indexed to, uint256 amount);
  event Cooldown(address indexed user, uint256 percentage);
  event CooldownExited(address indexed user);
  event SlashRateChanged(uint256 newRate);
  event Recollateralised();
  event WrapperWhitelisted(address wallet);
  event WrapperBlacklisted(address wallet);

  /***************************************
                    INIT
    ****************************************/

  /**
   * @param _nexus System nexus
   * @param _rewardsToken Token that is being distributed as a reward. eg MTA
   * @param _questManager Centralised manager of quests
   * @param _stakedToken Core token that is staked and tracked (e.g. MTA)
   * @param _cooldownSeconds Seconds a user must wait after she initiates her cooldown before withdrawal is possible
   * @param _unstakeWindow Window in which it is possible to withdraw, following the cooldown period
   * @param _hasPriceCoeff true if raw staked amount is multiplied by price coeff to get staked amount. eg BPT Staked Token
   */
  constructor(
    address _nexus,
    address _rewardsToken,
    address _questManager,
    address _stakedToken,
    uint256 _cooldownSeconds,
    uint256 _unstakeWindow,
    bool _hasPriceCoeff
  ) GamifiedVotingToken(_nexus, _rewardsToken, _questManager, _hasPriceCoeff) {
    STAKED_TOKEN = IERC20(_stakedToken);
    COOLDOWN_SECONDS = _cooldownSeconds;
    UNSTAKE_WINDOW = _unstakeWindow;
  }

  /**
   * @param _nameArg Token name
   * @param _symbolArg Token symbol
   * @param _rewardsDistributorArg mStable Rewards Distributor
   */
  function __StakedToken_init(
    bytes32 _nameArg,
    bytes32 _symbolArg,
    address _rewardsDistributorArg
  ) public initializer {
    __GamifiedToken_init(_nameArg, _symbolArg, _rewardsDistributorArg);
    _initializeReentrancyGuard();
    safetyData = SafetyData({
      collateralisationRatio: 1e18,
      slashingPercentage: 0
    });
  }

  /**
   * @dev Only the recollateralisation module, as specified in the mStable Nexus, can execute this
   */
  modifier onlyRecollateralisationModule() {
    require(
      _msgSender() == _recollateraliser(),
      "Only Recollateralisation Module"
    );
    _;
  }

  /**
   * @dev This protects against fn's being called after a recollateralisation event, when the contract is essentially finished
   */
  modifier onlyBeforeRecollateralisation() {
    _onlyBeforeRecollateralisation();
    _;
  }

  function _onlyBeforeRecollateralisation() internal view {
    require(
      safetyData.collateralisationRatio == 1e18,
      "Only while fully collateralised"
    );
  }

  /**
   * @dev Only whitelisted contracts can call core fns. mStable governors can whitelist and de-whitelist wrappers.
   * Access may be given to yield optimisers to boost rewards, but creating unlimited and ungoverned wrappers is unadvised.
   */
  modifier assertNotContract() {
    _assertNotContract();
    _;
  }

  function _assertNotContract() internal view {
    if (_msgSender() != tx.origin) {
      require(whitelistedWrappers[_msgSender()], "Not a whitelisted contract");
    }
  }

  /***************************************
                    ACTIONS
    ****************************************/

  /**
   * @dev Stake an `_amount` of STAKED_TOKEN in the system. This amount is added to the users stake and
   * boosts their voting power.
   * @param _amount Units of STAKED_TOKEN to stake
   */
  function stake(uint256 _amount) external {
    _transferAndStake(_amount, address(0), false);
  }

  /**
   * @dev Stake an `_amount` of STAKED_TOKEN in the system. This amount is added to the users stake and
   * boosts their voting power.
   * @param _amount Units of STAKED_TOKEN to stake
   * @param _exitCooldown Bool signalling whether to take this opportunity to end any outstanding cooldown and
   * return the user back to their full voting power
   */
  function stake(uint256 _amount, bool _exitCooldown) external {
    _transferAndStake(_amount, address(0), _exitCooldown);
  }

  /**
   * @dev Stake an `_amount` of STAKED_TOKEN in the system. This amount is added to the users stake and
   * boosts their voting power. Take the opportunity to change delegatee.
   * @param _amount Units of STAKED_TOKEN to stake
   * @param _delegatee Address of the user to whom the sender would like to delegate their voting power
   */
  function stake(uint256 _amount, address _delegatee) external {
    _transferAndStake(_amount, _delegatee, false);
  }

  /**
   * @dev Transfers tokens from sender before calling `_settleStake`
   */
  function _transferAndStake(
    uint256 _amount,
    address _delegatee,
    bool _exitCooldown
  ) internal {
    STAKED_TOKEN.safeTransferFrom(_msgSender(), address(this), _amount);
    _settleStake(_amount, _delegatee, _exitCooldown);
  }

  /**
   * @dev Internal stake fn. Can only be called by whitelisted contracts/EOAs and only before a recollateralisation event.
   * NOTE - Assumes tokens have already been transferred
   * @param _amount Units of STAKED_TOKEN to stake
   * @param _delegatee Address of the user to whom the sender would like to delegate their voting power
   * @param _exitCooldown Bool signalling whether to take this opportunity to end any outstanding cooldown and
   * return the user back to their full voting power
   */
  function _settleStake(
    uint256 _amount,
    address _delegatee,
    bool _exitCooldown
  ) internal onlyBeforeRecollateralisation assertNotContract {
    require(_amount != 0, "INVALID_ZERO_AMOUNT");

    // 1. Apply the delegate if it has been chosen (else it defaults to the sender)
    if (_delegatee != address(0)) {
      _delegate(_msgSender(), _delegatee);
    }

    // 2. Deal with cooldown
    //      If a user is currently in a cooldown period, re-calculate their cooldown timestamp
    Balance memory oldBalance = _balances[_msgSender()];
    //      If we have missed the unstake window, or the user has chosen to exit the cooldown,
    //      then reset the timestamp to 0
    bool exitCooldown = _exitCooldown ||
      (oldBalance.cooldownTimestamp > 0 &&
        block.timestamp >
        (oldBalance.cooldownTimestamp + COOLDOWN_SECONDS + UNSTAKE_WINDOW));
    if (exitCooldown) {
      emit CooldownExited(_msgSender());
    }

    // 3. Settle the stake by depositing the STAKED_TOKEN and minting voting power
    _mintRaw(_msgSender(), _amount, exitCooldown);

    emit Staked(_msgSender(), _amount, _delegatee);
  }

  /**
   * @dev Withdraw raw tokens from the system, following an elapsed cooldown period.
   * Note - May be subject to a transfer fee, depending on the users weightedTimestamp
   * @param _amount Units of raw token to withdraw
   * @param _recipient Address of beneficiary who will receive the raw tokens
   * @param _amountIncludesFee Is the `_amount` specified inclusive of any applicable redemption fee?
   * @param _exitCooldown Should we take this opportunity to exit the cooldown period?
   **/
  function withdraw(
    uint256 _amount,
    address _recipient,
    bool _amountIncludesFee,
    bool _exitCooldown
  ) external {
    _withdraw(_amount, _recipient, _amountIncludesFee, _exitCooldown);
  }

  /**
   * @dev Withdraw raw tokens from the system, following an elapsed cooldown period.
   * Note - May be subject to a transfer fee, depending on the users weightedTimestamp
   * @param _amount Units of raw token to withdraw
   * @param _recipient Address of beneficiary who will receive the raw tokens
   * @param _amountIncludesFee Is the `_amount` specified inclusive of any applicable redemption fee?
   * @param _exitCooldown Should we take this opportunity to exit the cooldown period?
   **/
  function _withdraw(
    uint256 _amount,
    address _recipient,
    bool _amountIncludesFee,
    bool _exitCooldown
  ) internal assertNotContract {
    require(_amount != 0, "INVALID_ZERO_AMOUNT");

    // Is the contract post-recollateralisation?
    if (safetyData.collateralisationRatio != 1e18) {
      // 1. If recollateralisation has occured, the contract is finished and we can skip all checks
      _burnRaw(_msgSender(), _amount, false, true);
      // 2. Return a proportionate amount of tokens, based on the collateralisation ratio
      STAKED_TOKEN.safeTransfer(
        _recipient,
        (_amount * safetyData.collateralisationRatio) / 1e18
      );
      emit Withdraw(_msgSender(), _recipient, _amount);
    } else {
      // 1. If no recollateralisation has occured, the user must be within their UNSTAKE_WINDOW period in order to withdraw
      Balance memory oldBalance = _balances[_msgSender()];
      require(
        block.timestamp > oldBalance.cooldownTimestamp + COOLDOWN_SECONDS,
        "INSUFFICIENT_COOLDOWN"
      );
      require(
        block.timestamp - (oldBalance.cooldownTimestamp + COOLDOWN_SECONDS) <=
          UNSTAKE_WINDOW,
        "UNSTAKE_WINDOW_FINISHED"
      );

      // 2. Get current balance
      Balance memory balance = _balances[_msgSender()];

      // 3. Apply redemption fee
      //      e.g. (55e18 / 5e18) - 2e18 = 9e18 / 100 = 9e16
      uint256 feeRate = calcRedemptionFeeRate(balance.weightedTimestamp);
      //      fee = amount * 1e18 / feeRate
      //      totalAmount = amount + fee
      uint256 totalWithdraw = _amountIncludesFee
        ? _amount
        : (_amount * (1e18 + feeRate)) / 1e18;
      uint256 userWithdrawal = (totalWithdraw * 1e18) / (1e18 + feeRate);

      //      Check for percentage withdrawal
      uint256 maxWithdrawal = oldBalance.cooldownUnits;
      require(totalWithdraw <= maxWithdrawal, "Exceeds max withdrawal");

      // 4. Exit cooldown if the user has specified, or if they have withdrawn everything
      // Otherwise, update the percentage remaining proportionately
      bool exitCooldown = _exitCooldown || totalWithdraw == maxWithdrawal;

      // 5. Settle the withdrawal by burning the voting tokens
      _burnRaw(_msgSender(), totalWithdraw, exitCooldown, false);
      //      Log any redemption fee to the rewards contract
      _notifyAdditionalReward(totalWithdraw - userWithdrawal);
      //      Finally transfer tokens back to recipient
      STAKED_TOKEN.safeTransfer(_recipient, userWithdrawal);

      emit Withdraw(_msgSender(), _recipient, _amount);
    }
  }

  /**
   * @dev Enters a cooldown period, after which (and before the unstake window elapses) a user will be able
   * to withdraw part or all of their staked tokens. Note, during this period, a users voting power is significantly reduced.
   * If a user already has a cooldown period, then it will reset to the current block timestamp, so use wisely.
   * @param _units Units of stake to cooldown for
   **/
  function startCooldown(uint256 _units) external {
    _startCooldown(_units);
  }

  /**
   * @dev Ends the cooldown of the sender and give them back their full voting power. This can be used to signal that
   * the user no longer wishes to exit the system. Note, the cooldown can also be reset, more smoothly, as part of a stake or
   * withdraw transaction.
   **/
  function endCooldown() external {
    require(_balances[_msgSender()].cooldownTimestamp != 0, "No cooldown");

    _exitCooldownPeriod(_msgSender());

    emit CooldownExited(_msgSender());
  }

  /**
   * @dev Enters a cooldown period, after which (and before the unstake window elapses) a user will be able
   * to withdraw part or all of their staked tokens. Note, during this period, a users voting power is significantly reduced.
   * If a user already has a cooldown period, then it will reset to the current block timestamp, so use wisely.
   * @param _units Units of stake to cooldown for
   **/
  function _startCooldown(uint256 _units) internal {
    require(balanceOf(_msgSender()) != 0, "INVALID_BALANCE_ON_COOLDOWN");

    _enterCooldownPeriod(_msgSender(), _units);

    emit Cooldown(_msgSender(), _units);
  }

  /***************************************
                    ADMIN
    ****************************************/

  /**
   * @dev This is a write function allowing the whitelisted recollateralisation module to slash stakers here and take
   * the capital to use to recollateralise any lost value in the system. Trusting that the recollateralisation module has
   * sufficient protections put in place. Note, once this has been executed, the contract is now finished, and undercollateralised,
   * meaning that all users must withdraw, and will only receive a proportionate amount back relative to the colRatio.
   **/
  function emergencyRecollateralisation()
    external
    onlyRecollateralisationModule
    onlyBeforeRecollateralisation
  {
    // 1. Change collateralisation rate
    safetyData.collateralisationRatio = 1e18 - safetyData.slashingPercentage;
    // 2. Take slashing percentage
    uint256 balance = STAKED_TOKEN.balanceOf(address(this));
    STAKED_TOKEN.safeTransfer(
      _recollateraliser(),
      (balance * safetyData.slashingPercentage) / 1e18
    );
    // 3. No functions should work anymore because the colRatio has changed
    emit Recollateralised();
  }

  /**
   * @dev Governance can change the slashing percentage here (initially 0). This is the amount of a stakers capital that is at
   * risk in the recollateralisation process.
   * @param _newRate Rate, where 50% == 5e17
   **/
  function changeSlashingPercentage(uint256 _newRate)
    external
    onlyGovernor
    onlyBeforeRecollateralisation
  {
    require(_newRate <= 5e17, "Cannot exceed 50%");

    safetyData.slashingPercentage = SafeCast.toUint128(_newRate);

    emit SlashRateChanged(_newRate);
  }

  /**
   * @dev Allows governance to whitelist a smart contract to interact with the StakedToken (for example a yield aggregator or simply
   * a Gnosis SAFE or other)
   * @param _wrapper Address of the smart contract to list
   **/
  function whitelistWrapper(address _wrapper) external onlyGovernor {
    whitelistedWrappers[_wrapper] = true;

    emit WrapperWhitelisted(_wrapper);
  }

  /**
   * @dev Allows governance to blacklist a smart contract to end it's interaction with the StakedToken
   * @param _wrapper Address of the smart contract to blacklist
   **/
  function blackListWrapper(address _wrapper) external onlyGovernor {
    whitelistedWrappers[_wrapper] = false;

    emit WrapperBlacklisted(_wrapper);
  }

  /***************************************
            BACKWARDS COMPATIBILITY
    ****************************************/

  /**
   * @dev Allows for backwards compatibility with createLock fn, giving basic args to stake
   * @param _value Units to stake
   **/
  function createLock(
    uint256 _value,
    uint256 /* _unlockTime */
  ) external {
    _transferAndStake(_value, address(0), false);
  }

  /**
   * @dev Allows for backwards compatibility with increaseLockAmount fn by simply staking more
   * @param _value Units to stake
   **/
  function increaseLockAmount(uint256 _value) external {
    require(balanceOf(_msgSender()) != 0, "Nothing to increase");
    _transferAndStake(_value, address(0), false);
  }

  /**
   * @dev Backwards compatibility. Previously a lock would run out and a user would call this. Now, it will take 2 calls
   * to exit in order to leave. The first will initiate the cooldown period, and the second will execute a full withdrawal.
   **/
  function exit() external virtual {
    // Since there is no immediate exit here, this can be called twice
    // If there is no cooldown, or the cooldown has passed the unstake window, enter cooldown
    uint128 ts = _balances[_msgSender()].cooldownTimestamp;
    if (ts == 0 || block.timestamp > ts + COOLDOWN_SECONDS + UNSTAKE_WINDOW) {
      (uint256 raw, uint256 cooldownUnits) = rawBalanceOf(_msgSender());
      _startCooldown(raw + cooldownUnits);
    }
    // Else withdraw all available
    else {
      _withdraw(
        _balances[_msgSender()].cooldownUnits,
        _msgSender(),
        true,
        false
      );
    }
  }

  /***************************************
                    GETTERS
    ****************************************/

  /**
   * @dev fee = sqrt(300/x)-2.5, where x = weeks since user has staked
   * @param _weightedTimestamp The users weightedTimestamp
   * @return _feeRate where 1% == 1e16
   */
  function calcRedemptionFeeRate(uint32 _weightedTimestamp)
    public
    view
    returns (uint256 _feeRate)
  {
    uint256 weeksStaked = ((block.timestamp - _weightedTimestamp) * 1e18) /
      ONE_WEEK;
    if (weeksStaked > 3e18) {
      // e.g. weeks = 1  = sqrt(300e18) = 17320508075
      // e.g. weeks = 10 = sqrt(30e18) =   5477225575
      // e.g. weeks = 26 = sqrt(11.5) =    3391164991
      _feeRate = Root.sqrt(300e36 / weeksStaked) * 1e7;
      // e.g. weeks = 1  = 173e15 - 25e15 = 148e15 or 14.8%
      // e.g. weeks = 10 =  55e15 - 25e15 = 30e15 or 3%
      // e.g. weeks = 26 =  34e15 - 25e15 = 9e15 or 0.9%
      _feeRate = _feeRate < 25e15 ? 0 : _feeRate - 25e15;
    } else {
      _feeRate = 75e15;
    }
  }

  uint256[48] private __gap;
}
