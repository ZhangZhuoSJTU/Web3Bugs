// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {SignatureVerifier} from "./deps/SignatureVerifier.sol";
import {ImmutableModule} from "../../shared/ImmutableModule.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IQuestManager} from "./interfaces/IQuestManager.sol";
import {IStakedToken} from "./interfaces/IStakedToken.sol";
import "./deps/GamifiedTokenStructs.sol";

/**
 * @title   QuestManager
 * @author  mStable
 * @notice  Centralised place to track quest management and completion status
 * @dev     VERSION: 1.0
 *          DATE:    2021-08-25
 */
contract QuestManager is
  IQuestManager,
  Initializable,
  ContextUpgradeable,
  ImmutableModule
{
  /// @notice Tracks the completion of each quest (user => questId => completion)
  mapping(address => mapping(uint256 => bool)) private _questCompletion;

  /// @notice User balance structs containing all data needed to scale balance
  mapping(address => QuestBalance) internal _balances;

  /// @notice List of quests, whose ID corresponds to their position in the array (from 0)
  Quest[] private _quests;
  /// @notice Timestamp at which the current season started
  uint32 public override seasonEpoch;
  /// @notice Timestamp at which the contract was created
  uint32 public startTime;

  /// @notice A whitelisted questMaster who can administer quests including signing user quests are completed.
  address public override questMaster;
  /// @notice account that can sign a user's quest as being completed.
  address internal _questSigner;

  /// @notice List of all staking tokens
  address[] internal _stakedTokens;

  /**
   * @param _nexus System nexus
   */
  constructor(address _nexus) ImmutableModule(_nexus) {}

  /**
   * @param _questMaster account that can sign user quests as completed
   * @param _questSignerArg account that can sign user quests as completed
   */
  function initialize(address _questMaster, address _questSignerArg)
    external
    initializer
  {
    startTime = SafeCast.toUint32(block.timestamp);
    questMaster = _questMaster;
    _questSigner = _questSignerArg;
  }

  /**
   * @dev Checks that _msgSender is either governor or the quest master
   */
  modifier questMasterOrGovernor() {
    _questMasterOrGovernor();
    _;
  }

  function _questMasterOrGovernor() internal view {
    require(
      _msgSender() == questMaster || _msgSender() == _governor(),
      "Not verified"
    );
  }

  /***************************************
                    Getters
    ****************************************/

  /**
   * @notice Gets raw quest data
   */
  function getQuest(uint256 _id)
    external
    view
    override
    returns (Quest memory)
  {
    return _quests[_id];
  }

  /**
   * @dev Simply checks if a given user has already completed a given quest
   * @param _account User address
   * @param _id Position of quest in array
   * @return bool with completion status
   */
  function hasCompleted(address _account, uint256 _id)
    public
    view
    override
    returns (bool)
  {
    return _questCompletion[_account][_id];
  }

  /**
   * @notice Raw quest balance
   */
  function balanceData(address _account)
    external
    view
    override
    returns (QuestBalance memory)
  {
    return _balances[_account];
  }

  /***************************************
                    Admin
    ****************************************/

  /**
   * @dev Sets the quest master that can administoer quests. eg add, expire and start seasons.
   */
  function setQuestMaster(address _newQuestMaster)
    external
    override
    questMasterOrGovernor
  {
    emit QuestMaster(questMaster, _newQuestMaster);

    questMaster = _newQuestMaster;
  }

  /**
   * @dev Sets the quest signer that can sign user quests as being completed.
   */
  function setQuestSigner(address _newQuestSigner)
    external
    override
    onlyGovernor
  {
    emit QuestSigner(_questSigner, _newQuestSigner);

    _questSigner = _newQuestSigner;
  }

  /**
   * @dev Adds a new stakedToken
   */
  function addStakedToken(address _stakedToken)
    external
    override
    onlyGovernor
  {
    require(_stakedToken != address(0), "Invalid StakedToken");

    _stakedTokens.push(_stakedToken);

    emit StakedTokenAdded(_stakedToken);
  }

  /***************************************
                    QUESTS
    ****************************************/

  /**
   * @dev Called by questMasters to add a new quest to the system with default 'ACTIVE' status
   * @param _model Type of quest rewards multiplier (does it last forever or just for the season).
   * @param _multiplier Multiplier, from 1 == 1.01x to 100 == 2.00x
   * @param _expiry Timestamp at which quest expires. Note that permanent quests should still be given a timestamp.
   */
  function addQuest(
    QuestType _model,
    uint8 _multiplier,
    uint32 _expiry
  ) external override questMasterOrGovernor {
    require(_expiry > block.timestamp + 1 days, "Quest window too small");
    require(
      _multiplier > 0 && _multiplier <= 50,
      "Quest multiplier too large > 1.5x"
    );

    _quests.push(
      Quest({
        model: _model,
        multiplier: _multiplier,
        status: QuestStatus.ACTIVE,
        expiry: _expiry
      })
    );

    emit QuestAdded(
      msg.sender,
      _quests.length - 1,
      _model,
      _multiplier,
      QuestStatus.ACTIVE,
      _expiry
    );
  }

  /**
   * @dev Called by questMasters to expire a quest, setting it's status as EXPIRED. After which it can
   * no longer be completed.
   * @param _id Quest ID (its position in the array)
   */
  function expireQuest(uint16 _id) external override questMasterOrGovernor {
    require(_id < _quests.length, "Quest does not exist");
    require(
      _quests[_id].status == QuestStatus.ACTIVE,
      "Quest already expired"
    );

    _quests[_id].status = QuestStatus.EXPIRED;
    if (block.timestamp < _quests[_id].expiry) {
      _quests[_id].expiry = SafeCast.toUint32(block.timestamp);
    }

    emit QuestExpired(_id);
  }

  /**
   * @dev Called by questMasters to start a new quest season. After this, all current
   * seasonMultipliers will be reduced at the next user action (or triggered manually).
   * In order to reduce cost for any keepers, it is suggested to add quests at the start
   * of a new season to incentivise user actions.
   * A new season can only begin after 9 months has passed.
   */
  function startNewQuestSeason() external override questMasterOrGovernor {
    require(
      block.timestamp > (startTime + 39 weeks),
      "First season has not elapsed"
    );
    require(
      block.timestamp > (seasonEpoch + 39 weeks),
      "Season has not elapsed"
    );

    uint256 len = _quests.length;
    for (uint256 i = 0; i < len; i++) {
      Quest memory quest = _quests[i];
      if (quest.model == QuestType.SEASONAL) {
        require(
          quest.status == QuestStatus.EXPIRED ||
            block.timestamp > quest.expiry,
          "All seasonal quests must have expired"
        );
      }
    }

    seasonEpoch = SafeCast.toUint32(block.timestamp);

    emit QuestSeasonEnded();
  }

  /***************************************
                    USER
    ****************************************/

  /**
   * @dev Called by anyone to complete one or more quests for a staker. The user must first collect a signed message
   * from the whitelisted _signer.
   * @param _account Account that has completed the quest
   * @param _ids Quest IDs (its position in the array)
   * @param _signature Signature from the verified _questSigner, containing keccak hash of account & ids
   */
  function completeUserQuests(
    address _account,
    uint256[] memory _ids,
    bytes calldata _signature
  ) external override {
    uint256 len = _ids.length;
    require(len > 0, "No quest IDs");

    uint8 questMultiplier = checkForSeasonFinish(_account);

    // For each quest
    for (uint256 i = 0; i < len; i++) {
      require(_validQuest(_ids[i]), "Invalid Quest ID");
      require(!hasCompleted(_account, _ids[i]), "Quest already completed");
      require(
        SignatureVerifier.verify(_questSigner, _account, _ids, _signature),
        "Invalid Quest Signer Signature"
      );

      // Store user quest has completed
      _questCompletion[_account][_ids[i]] = true;

      // Update multiplier
      Quest memory quest = _quests[_ids[i]];
      if (quest.model == QuestType.PERMANENT) {
        _balances[_account].permMultiplier += quest.multiplier;
      } else {
        _balances[_account].seasonMultiplier += quest.multiplier;
      }
      questMultiplier += quest.multiplier;
    }

    uint256 len2 = _stakedTokens.length;
    for (uint256 i = 0; i < len2; i++) {
      IStakedToken(_stakedTokens[i]).applyQuestMultiplier(
        _account,
        questMultiplier
      );
    }

    emit QuestCompleteQuests(_account, _ids);
  }

  /**
   * @dev Called by anyone to complete one or more accounts for a quest. The user must first collect a signed message
   * from the whitelisted _questMaster.
   * @param _questId Quest ID (its position in the array)
   * @param _accounts Accounts that has completed the quest
   * @param _signature Signature from the verified _questMaster, containing keccak hash of id and accounts
   */
  function completeQuestUsers(
    uint256 _questId,
    address[] memory _accounts,
    bytes calldata _signature
  ) external override {
    require(_validQuest(_questId), "Invalid Quest ID");
    uint256 len = _accounts.length;
    require(len > 0, "No accounts");
    require(
      SignatureVerifier.verify(_questSigner, _questId, _accounts, _signature),
      "Invalid Quest Signer Signature"
    );

    Quest memory quest = _quests[_questId];

    // For each user account
    for (uint256 i = 0; i < len; i++) {
      require(
        !hasCompleted(_accounts[i], _questId),
        "Quest already completed"
      );

      // store user quest has completed
      _questCompletion[_accounts[i]][_questId] = true;

      // _applyQuestMultiplier(_accounts[i], quests);
      uint8 questMultiplier = checkForSeasonFinish(_accounts[i]);

      // Update multiplier
      if (quest.model == QuestType.PERMANENT) {
        _balances[_accounts[i]].permMultiplier += quest.multiplier;
      } else {
        _balances[_accounts[i]].seasonMultiplier += quest.multiplier;
      }
      questMultiplier += quest.multiplier;

      uint256 len2 = _stakedTokens.length;
      for (uint256 j = 0; j < len2; j++) {
        IStakedToken(_stakedTokens[j]).applyQuestMultiplier(
          _accounts[i],
          questMultiplier
        );
      }
    }

    emit QuestCompleteUsers(_questId, _accounts);
  }

  /**
   * @dev Simply checks if a quest is valid. Quests are valid if their id exists,
   * they have an ACTIVE status and they have not yet reached their expiry timestamp.
   * @param _id Position of quest in array
   * @return bool with validity status
   */
  function _validQuest(uint256 _id) internal view returns (bool) {
    return
      _id < _quests.length &&
      _quests[_id].status == QuestStatus.ACTIVE &&
      block.timestamp < _quests[_id].expiry;
  }

  /**
   * @dev Checks if the season has just finished between now and the users last action.
   * If it has, we reset the seasonMultiplier. Either way, we update the lastAction for the user.
   * NOTE - it is important that this is called as a hook before each state change operation
   * @param _account Address of user that should be updated
   */
  function checkForSeasonFinish(address _account)
    public
    override
    returns (uint8 newQuestMultiplier)
  {
    QuestBalance storage balance = _balances[_account];
    // If the last action was before current season, then reset the season timing
    if (_hasFinishedSeason(balance.lastAction)) {
      // Remove 85% of the multiplier gained in this season
      balance.seasonMultiplier = (balance.seasonMultiplier * 15) / 100;
      balance.lastAction = SafeCast.toUint32(block.timestamp);
    }
    return balance.seasonMultiplier + balance.permMultiplier;
  }

  /**
   * @dev Simple view fn to check if the users last action was before the starting of the current season
   */
  function _hasFinishedSeason(uint32 _lastAction)
    internal
    view
    returns (bool)
  {
    return _lastAction < seasonEpoch;
  }
}
