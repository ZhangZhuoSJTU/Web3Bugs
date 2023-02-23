// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import "../deps/GamifiedTokenStructs.sol";

interface IQuestManager {
  event QuestAdded(
    address questMaster,
    uint256 id,
    QuestType model,
    uint16 multiplier,
    QuestStatus status,
    uint32 expiry
  );
  event QuestCompleteQuests(address indexed user, uint256[] ids);
  event QuestCompleteUsers(uint256 indexed questId, address[] accounts);
  event QuestExpired(uint16 indexed id);
  event QuestMaster(address oldQuestMaster, address newQuestMaster);
  event QuestSeasonEnded();
  event QuestSigner(address oldQuestSigner, address newQuestSigner);
  event StakedTokenAdded(address stakedToken);

  // GETTERS
  function balanceData(address _account)
    external
    view
    returns (QuestBalance memory);

  function getQuest(uint256 _id) external view returns (Quest memory);

  function hasCompleted(address _account, uint256 _id)
    external
    view
    returns (bool);

  function questMaster() external view returns (address);

  function seasonEpoch() external view returns (uint32);

  // ADMIN
  function addQuest(
    QuestType _model,
    uint8 _multiplier,
    uint32 _expiry
  ) external;

  function addStakedToken(address _stakedToken) external;

  function expireQuest(uint16 _id) external;

  function setQuestMaster(address _newQuestMaster) external;

  function setQuestSigner(address _newQuestSigner) external;

  function startNewQuestSeason() external;

  // USER
  function completeUserQuests(
    address _account,
    uint256[] memory _ids,
    bytes calldata _signature
  ) external;

  function completeQuestUsers(
    uint256 _questId,
    address[] memory _accounts,
    bytes calldata _signature
  ) external;

  function checkForSeasonFinish(address _account)
    external
    returns (uint8 newQuestMultiplier);
}
