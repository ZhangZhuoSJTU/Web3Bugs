// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../interfaces/IAddressProvider.sol";
import "../../../governance/interfaces/IGovernanceAddressProvider.sol";

interface IGenericMinerV2 {
  struct UserInfo {
    uint256 stake;
    uint256 stakeWithBoost;
    uint256 accAmountPerShare;
    uint256 accParAmountPerShare;
  }

  struct BoostConfig {
    uint256 a;
    uint256 b;
    uint256 c;
    uint256 d;
    uint256 e;
    uint256 maxBoost;
  }

  /// @dev This emit when a users' productivity has changed
  /// It emits with the user's address and the the value after the change.
  event StakeIncreased(address indexed user, uint256 stake);

  /// @dev This emit when a users' productivity has changed
  /// It emits with the user's address and the the value after the change.
  event StakeDecreased(address indexed user, uint256 stake);

  event BoostConfigSet(BoostConfig);

  function releaseRewards(address _user) external;

  function stake(address _user) external view returns (uint256);

  function stakeWithBoost(address _user) external view returns (uint256);

  // Read only
  function a() external view returns (IGovernanceAddressProvider);

  function pendingMIMO(address _user) external view returns (uint256);

  function pendingPAR(address _user) external view returns (uint256);

  function par() external view returns (IERC20);

  function boostConfig() external view returns (BoostConfig memory);

  function totalStake() external view returns (uint256);

  function totalStakeWithBoost() external view returns (uint256);

  function userInfo(address _user) external view returns (UserInfo memory);
}
