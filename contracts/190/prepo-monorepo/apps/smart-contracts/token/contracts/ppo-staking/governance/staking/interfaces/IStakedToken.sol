// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../deps/GamifiedTokenStructs.sol";

interface IStakedToken {
  // GETTERS
  function COOLDOWN_SECONDS() external view returns (uint256);

  function UNSTAKE_WINDOW() external view returns (uint256);

  function STAKED_TOKEN() external view returns (IERC20);

  function getRewardToken() external view returns (address);

  function pendingAdditionalReward() external view returns (uint256);

  function whitelistedWrappers(address) external view returns (bool);

  function balanceData(address _account)
    external
    view
    returns (Balance memory);

  function balanceOf(address _account) external view returns (uint256);

  function rawBalanceOf(address _account)
    external
    view
    returns (uint256, uint256);

  function calcRedemptionFeeRate(uint32 _weightedTimestamp)
    external
    view
    returns (uint256 _feeRate);

  function safetyData()
    external
    view
    returns (uint128 collateralisationRatio, uint128 slashingPercentage);

  function delegates(address account) external view returns (address);

  function getPastTotalSupply(uint256 blockNumber)
    external
    view
    returns (uint256);

  function getPastVotes(address account, uint256 blockNumber)
    external
    view
    returns (uint256);

  function getVotes(address account) external view returns (uint256);

  // HOOKS/PERMISSIONED
  function applyQuestMultiplier(address _account, uint8 _newMultiplier)
    external;

  // ADMIN
  function whitelistWrapper(address _wrapper) external;

  function blackListWrapper(address _wrapper) external;

  function changeSlashingPercentage(uint256 _newRate) external;

  function emergencyRecollateralisation() external;

  function setGovernanceHook(address _newHook) external;

  // USER
  function stake(uint256 _amount) external;

  function stake(uint256 _amount, address _delegatee) external;

  function stake(uint256 _amount, bool _exitCooldown) external;

  function withdraw(
    uint256 _amount,
    address _recipient,
    bool _amountIncludesFee,
    bool _exitCooldown
  ) external;

  function delegate(address delegatee) external;

  function startCooldown(uint256 _units) external;

  function endCooldown() external;

  function reviewTimestamp(address _account) external;

  function claimReward() external;

  function claimReward(address _to) external;

  // Backwards compatibility
  function createLock(uint256 _value, uint256) external;

  function exit() external;

  function increaseLockAmount(uint256 _value) external;

  function increaseLockLength(uint256) external;
}
