// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {SafeCastExtended} from "../../shared/SafeCastExtended.sol";
import {ILockedERC20} from "./interfaces/ILockedERC20.sol";
import {HeadlessStakingRewards} from "../../rewards/staking/HeadlessStakingRewards.sol";
import {IAchievementsManager} from "./interfaces/IAchievementsManager.sol";
import {ITimeMultiplierCalculator} from "./interfaces/ITimeMultiplierCalculator.sol";
import "./deps/PPOGamifiedTokenStructs.sol";

/**
 * @title PPOGamifiedToken
 * @notice PPOGamifiedToken is a non-transferrable ERC20 token that has both a raw balance and a scaled balance.
 * Scaled balance is determined by quests a user completes, and the length of time they keep the raw balance wrapped.
 * QuestMasters can add new quests for stakers to complete, for which they are rewarded with permanent or seasonal multipliers.
 * @author mStable
 * @dev Originally forked from openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol
 * Changes:
 *   - Removed the transfer, transferFrom, approve fns to make non-transferrable
 *   - Removed `_allowances` storage
 *   - Removed `_beforeTokenTransfer` hook
 *   - Replaced standard uint256 balance with a single struct containing all data from which the scaledBalance can be derived
 *   - Quest system implemented that tracks a users quest status and applies multipliers for them
 **/
abstract contract PPOGamifiedToken is
  ILockedERC20,
  Initializable,
  ContextUpgradeable,
  HeadlessStakingRewards
{
  event TimeMultiplierCalculatorChange(address newCalculator);
  event MaxMultiplierChange(uint256 newMultiplier);

  /// @notice name of this token (ERC20)
  string private _name;
  /// @notice symbol of this token (ERC20)
  string private _symbol;
  /// @notice number of decimals of this token (ERC20)
  uint8 public constant override decimals = 18;

  ITimeMultiplierCalculator private _timeMultiplierCalculator;
  uint256 private _maxMultiplier;
  uint256 public constant MULTIPLIER_DENOMINATOR = 1e12;

  /// @notice User balance structs containing all data needed to scale balance
  mapping(address => Balance) internal _balances;
  IAchievementsManager public achievementsManager;

  /***************************************
                    INIT
    ****************************************/

  /**
   * @param _nexus System nexus
   * @param _rewardsToken Token that is being distributed as a reward. eg MTA
   * @param _achievementsManager Centralised manager of quests
   */
  constructor(
    address _nexus,
    address _rewardsToken,
    address _achievementsManager
  ) HeadlessStakingRewards(_nexus, _rewardsToken) {
    achievementsManager = IAchievementsManager(_achievementsManager);
  }

  /**
   * @param _nameArg Token name
   * @param _symbolArg Token symbol
   * @param _rewardsDistributorArg mStable Rewards Distributor
   */
  function __PPOGamifiedToken_init(
    string memory _nameArg,
    string memory _symbolArg,
    address _rewardsDistributorArg
  ) internal {
    __Context_init_unchained();
    _name = _nameArg;
    _symbol = _symbolArg;
    HeadlessStakingRewards._initialize(_rewardsDistributorArg);
  }

  /**
   * @dev Checks that _msgSender is the quest Manager
   */
  modifier onlyAchievementsManager() {
    require(
      _msgSender() == address(achievementsManager),
      "Not achievement manager"
    );
    _;
  }

  function setTimeMultiplierCalculator(address _newCalculator)
    external
    onlyGovernor
  {
    _timeMultiplierCalculator = ITimeMultiplierCalculator(_newCalculator);
    emit TimeMultiplierCalculatorChange(_newCalculator);
  }

  function setMaxMultiplier(uint256 _newMaxMultiplier) external onlyGovernor {
    _maxMultiplier = _newMaxMultiplier;
    emit MaxMultiplierChange(_newMaxMultiplier);
  }

  /***************************************
                    VIEWS
    ****************************************/

  function name() public view override returns (string memory) {
    return _name;
  }

  function symbol() public view override returns (string memory) {
    return _symbol;
  }

  /**
   * @dev Total sum of all scaled balances
   * In this instance, leave to the child token.
   */
  function totalSupply()
    public
    view
    virtual
    override(HeadlessStakingRewards, ILockedERC20)
    returns (uint256);

  /**
   * @dev Simply gets scaled balance
   * @return scaled balance for user
   */
  function balanceOf(address _account)
    public
    view
    virtual
    override(HeadlessStakingRewards, ILockedERC20)
    returns (uint256)
  {
    return _scaleBalance(_balances[_account]);
  }

  /**
   * @dev Simply gets raw balance
   * @return raw balance for user
   */
  function rawBalanceOf(address _account)
    public
    view
    returns (uint256, uint256)
  {
    return (_balances[_account].raw, _balances[_account].cooldownUnits);
  }

  /**
   * @dev Scales the balance of a given user by applying multipliers
   */
  function _scaleBalance(Balance memory _balance)
    internal
    view
    returns (uint256 balance)
  {
    uint256 _combinedMultiplier;
    if (_balance.achievementsMultiplier < 0) {
      uint256 _absAchievementsMultiplier = uint256(
        -int256(_balance.achievementsMultiplier)
      );
      _combinedMultiplier = _absAchievementsMultiplier >=
        _balance.timeMultiplier
        ? 0
        : _balance.timeMultiplier - _absAchievementsMultiplier;
    } else {
      /**
       * int => uint conversion is safe here because
       * achievementsMultiplier is guaranteed to be >= 0
       */
      _combinedMultiplier =
        _balance.timeMultiplier +
        uint256(uint64(_balance.achievementsMultiplier));
    }
    if (_combinedMultiplier > _maxMultiplier) {
      _combinedMultiplier = _maxMultiplier;
    }
    balance = (_balance.raw * _combinedMultiplier) / MULTIPLIER_DENOMINATOR;
  }

  function getTimeMultiplierCalculator()
    external
    view
    returns (ITimeMultiplierCalculator)
  {
    return _timeMultiplierCalculator;
  }

  function getMaxMultiplier() external view returns (uint256) {
    return _maxMultiplier;
  }

  /**
   * @notice Raw staked balance without any multipliers
   */
  function balanceData(address _account)
    external
    view
    returns (Balance memory)
  {
    return _balances[_account];
  }

  /***************************************
                    QUESTS
    ****************************************/

  /**
   * @dev Called by anyone to poke the timestamp of a given account. This allows users to
   * effectively 'claim' any new timeMultiplier, but will revert if there is no change there.
   */
  function reviewTimestamp(address _account) external {
    _reviewWeightedTimestamp(_account);
  }

  /**
   * @dev Adds the multiplier awarded from quest completion to a users data, taking the opportunity
   * to check time multipliers etc.
   * @param _account Address of user that should be updated
   * @param _newMultiplier New Quest Multiplier
   */
  function applyAchievementsMultiplier(address _account, int64 _newMultiplier)
    external
    onlyAchievementsManager
  {
    require(_account != address(0), "Invalid address");

    // 1. Get current balance & update achievementsMultiplier, only if user has a balance
    Balance memory oldBalance = _balances[_account];
    uint256 oldScaledBalance = _scaleBalance(oldBalance);
    if (oldScaledBalance > 0) {
      _applyAchievementsMultiplier(
        _account,
        oldBalance,
        oldScaledBalance,
        _newMultiplier
      );
    }
  }

  /***************************************
                BALANCE CHANGES
    ****************************************/

  /**
   * @dev Adds the multiplier awarded from quest completion to a users data, taking the opportunity
   * to check time multiplier.
   * @param _account Address of user that should be updated
   * @param _newMultiplier New Quest Multiplier
   */
  function _applyAchievementsMultiplier(
    address _account,
    Balance memory _oldBalance,
    uint256 _oldScaledBalance,
    int64 _newMultiplier
  ) private updateReward(_account) {
    // 1. Set the achievementsMultiplier
    _balances[_account].achievementsMultiplier = _newMultiplier;

    // 2. Take the opportunity to set weighted timestamp, if it changes
    _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
      _timeMultiplierCalculator.calculate(_oldBalance.weightedTimestamp)
    );

    // 3. Update scaled balance
    _settleScaledBalance(_account, _oldScaledBalance);
  }

  /**
   * @dev Entering a cooldown period means a user wishes to withdraw. With this in mind, their balance
   * should be reduced until they have shown more commitment to the system
   * @param _account Address of user that should be cooled
   * @param _units Units to cooldown for
   */
  function _enterCooldownPeriod(address _account, uint256 _units)
    internal
    updateReward(_account)
  {
    require(_account != address(0), "Invalid address");

    // 1. Get current balance
    (Balance memory oldBalance, uint256 oldScaledBalance) = _prepareOldBalance(
      _account
    );
    uint256 _totalUnits = oldBalance.raw + oldBalance.cooldownUnits;
    require(
      _units > 0 && _units <= _totalUnits,
      "Must choose between 0 and 100%"
    );

    // 2. Set weighted timestamp and enter cooldown
    _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
      _timeMultiplierCalculator.calculate(oldBalance.weightedTimestamp)
    );
    // e.g. 1e18 / 1e16 = 100, 2e16 / 1e16 = 2, 1e15/1e16 = 0
    _balances[_account].raw = SafeCastExtended.toUint128(_totalUnits - _units);

    // 3. Set cooldown data
    _balances[_account].cooldownTimestamp = SafeCastExtended.toUint64(
      block.timestamp
    );
    _balances[_account].cooldownUnits = SafeCastExtended.toUint128(_units);

    // 4. Update scaled balance
    _settleScaledBalance(_account, oldScaledBalance);
  }

  /**
   * @dev Exiting the cooldown period explicitly resets the users cooldown window and their balance
   * @param _account Address of user that should be exited
   */
  function _exitCooldownPeriod(address _account)
    internal
    updateReward(_account)
  {
    require(_account != address(0), "Invalid address");

    // 1. Get current balance
    (Balance memory oldBalance, uint256 oldScaledBalance) = _prepareOldBalance(
      _account
    );

    // 2. Set weighted timestamp and exit cooldown
    _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
      _timeMultiplierCalculator.calculate(oldBalance.weightedTimestamp)
    );
    _balances[_account].raw += oldBalance.cooldownUnits;

    // 3. Set cooldown data
    _balances[_account].cooldownTimestamp = 0;
    _balances[_account].cooldownUnits = 0;

    // 4. Update scaled balance
    _settleScaledBalance(_account, oldScaledBalance);
  }

  /**
   * @dev Pokes the weightedTimestamp of a given user and checks if it entitles them
   * to a better timeMultiplier. If not, it simply reverts as there is nothing to update.
   * @param _account Address of user that should be updated
   */
  function _reviewWeightedTimestamp(address _account)
    internal
    updateReward(_account)
  {
    require(_account != address(0), "Invalid address");

    // 1. Get current balance
    (Balance memory oldBalance, uint256 oldScaledBalance) = _prepareOldBalance(
      _account
    );

    // 2. Set weighted timestamp, if it changes
    uint256 _newTimeMultiplier = _timeMultiplierCalculator.calculate(
      oldBalance.weightedTimestamp
    );
    require(
      _newTimeMultiplier != oldBalance.timeMultiplier,
      "Nothing worth poking here"
    );
    _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
      _newTimeMultiplier
    );

    // 3. Update scaled balance
    _settleScaledBalance(_account, oldScaledBalance);
  }

  /**
   * @dev Called to mint from raw tokens. Adds raw to a users balance, and then propagates the scaledBalance.
   * Importantly, when a user stakes more, their weightedTimestamp is reduced proportionate to their stake.
   * @param _account Address of user to credit
   * @param _rawAmount Raw amount of tokens staked
   * @param _exitCooldown Should we end any cooldown?
   */
  function _mintRaw(
    address _account,
    uint256 _rawAmount,
    bool _exitCooldown
  ) internal updateReward(_account) {
    require(_account != address(0), "ERC20: mint to the zero address");

    // 1. Get and update current balance
    (Balance memory oldBalance, uint256 oldScaledBalance) = _prepareOldBalance(
      _account
    );
    uint256 _totalRaw = oldBalance.raw + oldBalance.cooldownUnits;
    _balances[_account].raw = SafeCastExtended.toUint128(
      oldBalance.raw + _rawAmount
    );

    // 2. Exit cooldown if necessary
    if (_exitCooldown) {
      _balances[_account].raw += oldBalance.cooldownUnits;
      _balances[_account].cooldownTimestamp = 0;
      _balances[_account].cooldownUnits = 0;
    }

    // 3. Set weighted timestamp
    //  i) For new _account, set up weighted timestamp
    if (oldBalance.weightedTimestamp == 0) {
      _balances[_account].weightedTimestamp = SafeCastExtended.toUint64(
        block.timestamp
      );
      // Required so that balances are initially scaled at 1X
      _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
        _timeMultiplierCalculator.calculate(block.timestamp)
      );
      _mintScaled(_account, _scaleBalance(_balances[_account]));
      return;
    }
    //  ii) For previous minters, recalculate time held
    //      Calc new weighted timestamp
    uint256 _oldWeightedSecondsHeld = (block.timestamp -
      oldBalance.weightedTimestamp) * _totalRaw;
    uint256 _newSecondsHeld = _oldWeightedSecondsHeld /
      (_totalRaw + (_rawAmount / 2));
    uint256 _newWeightedTs = block.timestamp - _newSecondsHeld;
    _balances[_account].weightedTimestamp = SafeCastExtended.toUint64(
      _newWeightedTs
    );
    _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
      _timeMultiplierCalculator.calculate(_newWeightedTs)
    );

    // 3. Update scaled balance
    _settleScaledBalance(_account, oldScaledBalance);
  }

  /**
   * @dev Called to burn a given amount of raw tokens.
   * @param _account Address of user
   * @param _rawAmount Raw amount of tokens to remove
   * @param _exitCooldown Exit the cooldown?
   * @param _finalise Has recollateralisation happened? If so, everything is cooled down
   */
  function _burnRaw(
    address _account,
    uint256 _rawAmount,
    bool _exitCooldown,
    bool _finalise
  ) internal updateReward(_account) {
    require(_account != address(0), "ERC20: burn from zero address");

    // 1. Get and update current balance
    (Balance memory oldBalance, uint256 oldScaledBalance) = _prepareOldBalance(
      _account
    );
    uint256 _totalRaw = oldBalance.raw + oldBalance.cooldownUnits;
    // 1.1. If _finalise, move everything to cooldown
    if (_finalise) {
      _balances[_account].raw = 0;
      _balances[_account].cooldownUnits = SafeCastExtended.toUint128(
        _totalRaw
      );
      oldBalance.cooldownUnits = SafeCastExtended.toUint128(_totalRaw);
    }
    // 1.2. Update
    require(
      oldBalance.cooldownUnits >= _rawAmount,
      "ERC20: burn amount > balance"
    );
    unchecked {
      _balances[_account].cooldownUnits -= SafeCastExtended.toUint128(
        _rawAmount
      );
    }

    // 2. If we are exiting cooldown, reset the balance
    if (_exitCooldown) {
      _balances[_account].raw += _balances[_account].cooldownUnits;
      _balances[_account].cooldownTimestamp = 0;
      _balances[_account].cooldownUnits = 0;
    }

    // 3. Set back scaled time
    // e.g. stake 10 for 100 seconds, withdraw 5.
    //      secondsHeld = (100 - 0) * (10 - 0.625) = 937.5
    uint256 _secondsHeld = (block.timestamp - oldBalance.weightedTimestamp) *
      (_totalRaw - (_rawAmount / 8));
    //      newWeightedTs = 937.5 / 100 = 93.75
    uint256 _newSecondsHeld = _secondsHeld / _totalRaw;
    uint256 _newWeightedTs = block.timestamp - _newSecondsHeld;
    _balances[_account].weightedTimestamp = SafeCastExtended.toUint64(
      _newWeightedTs
    );
    _balances[_account].timeMultiplier = SafeCastExtended.toUint64(
      _timeMultiplierCalculator.calculate(_newWeightedTs)
    );

    // 4. Update scaled balance
    _settleScaledBalance(_account, oldScaledBalance);
  }

  /***************************************
                    PRIVATE
    updateReward should already be called by now
    ****************************************/

  /**
   * @dev Fetches the balance of a given user, scales it, and also takes the opportunity
   * to check if the season has just finished between now and their last action.
   * @param _account Address of user to fetch
   * @return oldBalance struct containing all balance information
   * @return oldScaledBalance scaled balance after applying multipliers
   */
  function _prepareOldBalance(address _account)
    private
    returns (Balance memory oldBalance, uint256 oldScaledBalance)
  {
    // Get the old balance
    oldBalance = _balances[_account];
    oldScaledBalance = _scaleBalance(oldBalance);
    // Take the opportunity to check for season finish
    _balances[_account].achievementsMultiplier = achievementsManager
      .checkForSeasonFinish(_account);
  }

  /**
   * @dev Settles the scaled balance of a given account. The reason this is done here, is because
   * in each of the write functions above, there is the chance that a users balance can go down,
   * requiring to burn sacled tokens. This could happen at the end of a season when multipliers are slashed.
   * This is called after updating all multipliers etc.
   * @param _account Address of user that should be updated
   * @param _oldScaledBalance Previous scaled balance of the user
   */
  function _settleScaledBalance(address _account, uint256 _oldScaledBalance)
    private
  {
    uint256 newScaledBalance = _scaleBalance(_balances[_account]);
    if (newScaledBalance > _oldScaledBalance) {
      _mintScaled(_account, newScaledBalance - _oldScaledBalance);
    }
    // This can happen if the user moves back a time class, but is unlikely to result in a negative mint
    else {
      _burnScaled(_account, _oldScaledBalance - newScaledBalance);
    }
  }

  /**
   * @dev Propagates the minting of the tokens downwards.
   * @param _account Address of user that has minted
   * @param _amount Amount of scaled tokens minted
   */
  function _mintScaled(address _account, uint256 _amount) private {
    emit Transfer(address(0), _account, _amount);

    _afterTokenTransfer(address(0), _account, _amount);
  }

  /**
   * @dev Propagates the burning of the tokens downwards.
   * @param _account Address of user that has burned
   * @param _amount Amount of scaled tokens burned
   */
  function _burnScaled(address _account, uint256 _amount) private {
    emit Transfer(_account, address(0), _amount);

    _afterTokenTransfer(_account, address(0), _amount);
  }

  /***************************************
                    HOOKS
    ****************************************/

  /**
   * @dev Triggered after a user claims rewards from the HeadlessStakingRewards. Used
   * to check for season finish. If it has not, then do not spend gas updating the other vars.
   * @param _account Address of user that has burned
   */
  function _claimRewardHook(address _account) internal override {
    int64 _newMultiplier = achievementsManager.checkForSeasonFinish(_account);
    if (_newMultiplier != _balances[_account].achievementsMultiplier) {
      // 1. Get current balance & trigger season finish
      uint256 oldScaledBalance = _scaleBalance(_balances[_account]);
      _balances[_account].achievementsMultiplier = _newMultiplier;
      // 2. Update scaled balance
      _settleScaledBalance(_account, oldScaledBalance);
    }
  }

  /**
   * @dev Unchanged from OpenZeppelin. Used in child contracts to react to any balance changes.
   */
  function _afterTokenTransfer(
    address _from,
    address _to,
    uint256 _amount
  ) internal virtual {}

  uint256[46] private __gap;
}
