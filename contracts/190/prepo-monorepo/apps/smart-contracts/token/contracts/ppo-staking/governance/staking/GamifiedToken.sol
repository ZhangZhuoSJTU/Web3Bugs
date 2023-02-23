// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {SafeCastExtended} from "../../shared/SafeCastExtended.sol";
import {ILockedERC20} from "./interfaces/ILockedERC20.sol";
import {HeadlessStakingRewards} from "../../rewards/staking/HeadlessStakingRewards.sol";
import {IQuestManager} from "./interfaces/IQuestManager.sol";
import "./deps/GamifiedTokenStructs.sol";

/**
 * @title GamifiedToken
 * @notice GamifiedToken is a non-transferrable ERC20 token that has both a raw balance and a scaled balance.
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
abstract contract GamifiedToken is
  ILockedERC20,
  Initializable,
  ContextUpgradeable,
  HeadlessStakingRewards
{
  /// @notice name of this token (ERC20)
  bytes32 private _name;
  /// @notice symbol of this token (ERC20)
  bytes32 private _symbol;
  /// @notice number of decimals of this token (ERC20)
  uint8 public constant override decimals = 18;

  /// @notice User balance structs containing all data needed to scale balance
  mapping(address => Balance) internal _balances;
  /// @notice Most recent price coefficients per user
  mapping(address => uint256) internal _userPriceCoeff;
  /// @notice Quest Manager
  IQuestManager public immutable questManager;
  /// @notice Has variable price
  bool public immutable hasPriceCoeff;

  /***************************************
                    INIT
    ****************************************/

  /**
   * @param _nexus System nexus
   * @param _rewardsToken Token that is being distributed as a reward. eg MTA
   * @param _questManager Centralised manager of quests
   * @param _hasPriceCoeff true if raw staked amount is multiplied by price coeff to get staked amount. eg BPT Staked Token
   */
  constructor(
    address _nexus,
    address _rewardsToken,
    address _questManager,
    bool _hasPriceCoeff
  ) HeadlessStakingRewards(_nexus, _rewardsToken) {
    questManager = IQuestManager(_questManager);
    hasPriceCoeff = _hasPriceCoeff;
  }

  /**
   * @param _nameArg Token name
   * @param _symbolArg Token symbol
   * @param _rewardsDistributorArg mStable Rewards Distributor
   */
  function __GamifiedToken_init(
    bytes32 _nameArg,
    bytes32 _symbolArg,
    address _rewardsDistributorArg
  ) internal initializer {
    __Context_init_unchained();
    _name = _nameArg;
    _symbol = _symbolArg;
    HeadlessStakingRewards._initialize(_rewardsDistributorArg);
  }

  /**
   * @dev Checks that _msgSender is the quest Manager
   */
  modifier onlyQuestManager() {
    require(_msgSender() == address(questManager), "Not verified");
    _;
  }

  /***************************************
                    VIEWS
    ****************************************/

  function name() public view override returns (string memory) {
    return bytes32ToString(_name);
  }

  function symbol() public view override returns (string memory) {
    return bytes32ToString(_symbol);
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
    return _getBalance(_account, _balances[_account]);
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
  function _getBalance(address _account, Balance memory _balance)
    internal
    view
    returns (uint256 balance)
  {
    // e.g. raw = 1000, questMultiplier = 40, timeMultiplier = 30. Cooldown of 60%
    // e.g. 1000 * (100 + 40) / 100 = 1400
    balance = (_balance.raw * (100 + _balance.questMultiplier)) / 100;
    // e.g. 1400 * (100 + 30) / 100 = 1820
    balance = (balance * (100 + _balance.timeMultiplier)) / 100;

    if (hasPriceCoeff) {
      // e.g. 1820 * 16000 / 10000 = 2912
      balance = (balance * _userPriceCoeff[_account]) / 10000;
    }
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

  /**
   * @notice Raw staked balance without any multipliers
   */
  function userPriceCoeff(address _account) external view returns (uint256) {
    return _userPriceCoeff[_account];
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
  function applyQuestMultiplier(address _account, uint8 _newMultiplier)
    external
    onlyQuestManager
  {
    require(_account != address(0), "Invalid address");

    // 1. Get current balance & update questMultiplier, only if user has a balance
    Balance memory oldBalance = _balances[_account];
    uint256 oldScaledBalance = _getBalance(_account, oldBalance);
    if (oldScaledBalance > 0) {
      _applyQuestMultiplier(
        _account,
        oldBalance,
        oldScaledBalance,
        _newMultiplier
      );
    }
  }

  /**
   * @dev Gets the multiplier awarded for a given weightedTimestamp
   * @param _ts WeightedTimestamp of a user
   * @return timeMultiplier Ranging from 20 (0.2x) to 60 (0.6x)
   */
  function _timeMultiplier(uint32 _ts)
    internal
    view
    returns (uint8 timeMultiplier)
  {
    // If the user has no ts yet, they are not in the system
    if (_ts == 0) return 0;

    uint256 hodlLength = block.timestamp - _ts;
    if (hodlLength < 13 weeks) {
      // 0-3 months = 1x
      return 0;
    } else if (hodlLength < 26 weeks) {
      // 3 months = 1.2x
      return 20;
    } else if (hodlLength < 52 weeks) {
      // 6 months = 1.3x
      return 30;
    } else if (hodlLength < 78 weeks) {
      // 12 months = 1.4x
      return 40;
    } else if (hodlLength < 104 weeks) {
      // 18 months = 1.5x
      return 50;
    } else {
      // > 24 months = 1.6x
      return 60;
    }
  }

  function _getPriceCoeff() internal virtual returns (uint256) {
    return 10000;
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
  function _applyQuestMultiplier(
    address _account,
    Balance memory _oldBalance,
    uint256 _oldScaledBalance,
    uint8 _newMultiplier
  ) private updateReward(_account) {
    // 1. Set the questMultiplier
    _balances[_account].questMultiplier = _newMultiplier;

    // 2. Take the opportunity to set weighted timestamp, if it changes
    _balances[_account].timeMultiplier = _timeMultiplier(
      _oldBalance.weightedTimestamp
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
    uint88 totalUnits = oldBalance.raw + oldBalance.cooldownUnits;
    require(
      _units > 0 && _units <= totalUnits,
      "Must choose between 0 and 100%"
    );

    // 2. Set weighted timestamp and enter cooldown
    _balances[_account].timeMultiplier = _timeMultiplier(
      oldBalance.weightedTimestamp
    );
    // e.g. 1e18 / 1e16 = 100, 2e16 / 1e16 = 2, 1e15/1e16 = 0
    _balances[_account].raw = totalUnits - SafeCastExtended.toUint88(_units);

    // 3. Set cooldown data
    _balances[_account].cooldownTimestamp = SafeCastExtended.toUint32(
      block.timestamp
    );
    _balances[_account].cooldownUnits = SafeCastExtended.toUint88(_units);

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
    _balances[_account].timeMultiplier = _timeMultiplier(
      oldBalance.weightedTimestamp
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
    uint8 newTimeMultiplier = _timeMultiplier(oldBalance.weightedTimestamp);
    require(
      newTimeMultiplier != oldBalance.timeMultiplier,
      "Nothing worth poking here"
    );
    _balances[_account].timeMultiplier = newTimeMultiplier;

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
    uint88 totalRaw = oldBalance.raw + oldBalance.cooldownUnits;
    _balances[_account].raw =
      oldBalance.raw +
      SafeCastExtended.toUint88(_rawAmount);

    // 2. Exit cooldown if necessary
    if (_exitCooldown) {
      _balances[_account].raw += oldBalance.cooldownUnits;
      _balances[_account].cooldownTimestamp = 0;
      _balances[_account].cooldownUnits = 0;
    }

    // 3. Set weighted timestamp
    //  i) For new _account, set up weighted timestamp
    if (oldBalance.weightedTimestamp == 0) {
      _balances[_account].weightedTimestamp = SafeCastExtended.toUint32(
        block.timestamp
      );
      _mintScaled(_account, _getBalance(_account, _balances[_account]));
      return;
    }
    //  ii) For previous minters, recalculate time held
    //      Calc new weighted timestamp
    uint256 oldWeightedSecondsHeld = (block.timestamp -
      oldBalance.weightedTimestamp) * totalRaw;
    uint256 newSecondsHeld = oldWeightedSecondsHeld /
      (totalRaw + (_rawAmount / 2));
    uint32 newWeightedTs = SafeCastExtended.toUint32(
      block.timestamp - newSecondsHeld
    );
    _balances[_account].weightedTimestamp = newWeightedTs;

    uint8 timeMultiplier = _timeMultiplier(newWeightedTs);
    _balances[_account].timeMultiplier = timeMultiplier;

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
    uint256 totalRaw = oldBalance.raw + oldBalance.cooldownUnits;
    // 1.1. If _finalise, move everything to cooldown
    if (_finalise) {
      _balances[_account].raw = 0;
      _balances[_account].cooldownUnits = SafeCastExtended.toUint88(totalRaw);
      oldBalance.cooldownUnits = SafeCastExtended.toUint88(totalRaw);
    }
    // 1.2. Update
    require(
      oldBalance.cooldownUnits >= _rawAmount,
      "ERC20: burn amount > balance"
    );
    unchecked {
      _balances[_account].cooldownUnits -= SafeCastExtended.toUint88(
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
    uint256 secondsHeld = (block.timestamp - oldBalance.weightedTimestamp) *
      (totalRaw - (_rawAmount / 8));
    //      newWeightedTs = 937.5 / 100 = 93.75
    uint256 newSecondsHeld = secondsHeld / totalRaw;
    uint32 newWeightedTs = SafeCastExtended.toUint32(
      block.timestamp - newSecondsHeld
    );
    _balances[_account].weightedTimestamp = newWeightedTs;

    uint8 timeMultiplier = _timeMultiplier(newWeightedTs);
    _balances[_account].timeMultiplier = timeMultiplier;

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
    oldScaledBalance = _getBalance(_account, oldBalance);
    // Take the opportunity to check for season finish
    _balances[_account].questMultiplier = questManager.checkForSeasonFinish(
      _account
    );
    if (hasPriceCoeff) {
      _userPriceCoeff[_account] = SafeCastExtended.toUint16(_getPriceCoeff());
    }
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
    uint256 newScaledBalance = _getBalance(_account, _balances[_account]);
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
    uint8 newMultiplier = questManager.checkForSeasonFinish(_account);
    bool priceCoeffChanged = hasPriceCoeff
      ? _getPriceCoeff() != _userPriceCoeff[_account]
      : false;
    if (
      newMultiplier != _balances[_account].questMultiplier || priceCoeffChanged
    ) {
      // 1. Get current balance & trigger season finish
      uint256 oldScaledBalance = _getBalance(_account, _balances[_account]);
      _balances[_account].questMultiplier = newMultiplier;
      if (priceCoeffChanged) {
        _userPriceCoeff[_account] = SafeCastExtended.toUint16(
          _getPriceCoeff()
        );
      }
      // 3. Update scaled balance
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

  /***************************************
                    Utils
    ****************************************/

  function bytes32ToString(bytes32 _bytes32)
    internal
    pure
    returns (string memory)
  {
    uint256 i = 0;
    while (i < 32 && _bytes32[i] != 0) {
      i++;
    }
    bytes memory bytesArray = new bytes(i);
    for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
      bytesArray[i] = _bytes32[i];
    }
    return string(bytesArray);
  }

  uint256[46] private __gap;
}
