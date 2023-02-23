// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;
pragma abicoder v2;

import {IStakedToken} from "./interfaces/IStakedToken.sol";
import {PPOGamifiedVotingToken} from "./PPOGamifiedVotingToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Root} from "../../shared/Root.sol";
import {InitializableReentrancyGuard} from "../../shared/InitializableReentrancyGuard.sol";
import "./deps/PPOGamifiedTokenStructs.sol";

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
contract PPOStaking is PPOGamifiedVotingToken, InitializableReentrancyGuard {
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

  event Stake(address indexed user, uint256 amount);
  event Withdraw(address indexed user, address indexed to, uint256 amount);
  event Cooldown(address indexed user, uint256 percentage);
  event CooldownExit(address indexed user);
  event SlashRateChange(uint256 newRate);
  event Recollateralise();
  event WrapperWhitelist(address wallet);
  event WrapperBlacklist(address wallet);

  /***************************************
                    INIT
    ****************************************/

  /**
   * @param _nexus System nexus
   * @param _rewardsToken Token that is being distributed as a reward. eg MTA
   * @param _achievementsManager Centralised manager of achievements
   * @param _stakedToken Core token that is staked and tracked (e.g. MTA)
   * @param _cooldownSeconds Seconds a user must wait after she initiates her cooldown before withdrawal is possible
   * @param _unstakeWindow Window in which it is possible to withdraw, following the cooldown period
   */
  constructor(
    address _nexus,
    address _rewardsToken,
    address _achievementsManager,
    address _stakedToken,
    uint256 _cooldownSeconds,
    uint256 _unstakeWindow
  ) PPOGamifiedVotingToken(_nexus, _rewardsToken, _achievementsManager) {
    STAKED_TOKEN = IERC20(_stakedToken);
    COOLDOWN_SECONDS = _cooldownSeconds;
    UNSTAKE_WINDOW = _unstakeWindow;
  }

  // TODO allow owner to change name and symbol
  /**
   * @param _rewardsDistributorArg mStable Rewards Distributor
   */
  function __PPOStaking_init(address _rewardsDistributorArg)
    public
    initializer
  {
    __PPOGamifiedToken_init("PPO Power", "pPPO", _rewardsDistributorArg);
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

  // TODO Add reentrancyGuard here
  /**
   * TODO Add helper function to allow staking and delegation to happen
   * together if msg.sender == _recipient (we do not want anyone besides
   * the position holder to delegate)
   */
  /**
   * @dev Stake an `_amount` of STAKED_TOKEN in the system. This amount is added to the users stake and
   * boosts their voting power. Take the opportunity to change delegatee.
   * @param _recipient Recipient of staked position
   * @param _amount Units of STAKED_TOKEN to stake
   */
  function stake(address _recipient, uint256 _amount)
    external
    assertNotContract
  {
    if (_amount == 0) return;
    STAKED_TOKEN.safeTransferFrom(_msgSender(), address(this), _amount);

    // 1. Deal with cooldown
    //      If a user is currently in a cooldown period, re-calculate their cooldown timestamp
    Balance memory _oldBalance = _balances[_recipient];
    //      If we have missed the unstake window, or the user has chosen to exit the cooldown,
    //      then reset the timestamp to 0
    bool _exitCooldown = (_oldBalance.cooldownTimestamp > 0 &&
      block.timestamp >
      (_oldBalance.cooldownTimestamp + COOLDOWN_SECONDS + UNSTAKE_WINDOW));
    if (_exitCooldown) {
      emit CooldownExit(_recipient);
    }

    // 2. Settle the stake by depositing the STAKED_TOKEN and minting voting power
    _mintRaw(_recipient, _amount, _exitCooldown);

    emit Stake(_recipient, _amount);
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

    emit CooldownExit(_msgSender());
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
    emit Recollateralise();
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

    emit SlashRateChange(_newRate);
  }

  /**
   * @dev Allows governance to whitelist a smart contract to interact with the StakedToken (for example a yield aggregator or simply
   * a Gnosis SAFE or other)
   * @param _wrapper Address of the smart contract to list
   **/
  function whitelistWrapper(address _wrapper) external onlyGovernor {
    whitelistedWrappers[_wrapper] = true;

    emit WrapperWhitelist(_wrapper);
  }

  /**
   * @dev Allows governance to blacklist a smart contract to end it's interaction with the StakedToken
   * @param _wrapper Address of the smart contract to blacklist
   **/
  function blackListWrapper(address _wrapper) external onlyGovernor {
    whitelistedWrappers[_wrapper] = false;

    emit WrapperBlacklist(_wrapper);
  }

  /***************************************
                    GETTERS
    ****************************************/

  /**
   * @dev fee = sqrt(300/x)-2.5, where x = weeks since user has staked
   * @param _weightedTimestamp The users weightedTimestamp
   * @return _feeRate where 1% == 1e16
   */
  function calcRedemptionFeeRate(uint256 _weightedTimestamp)
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
