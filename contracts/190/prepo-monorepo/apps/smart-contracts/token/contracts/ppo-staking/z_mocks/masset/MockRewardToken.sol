// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.7;

import {MassetHelpers} from "../../shared/MassetHelpers.sol";
import {ImmutableModule} from "../../shared/ImmutableModule.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Overrides approveRewardToken
contract MockRewardToken is ImmutableModule {
  event RewardTokenApproved(address token, address spender);

  address rewardToken;
  uint256 rewardAmount = 1000;

  constructor(address _nexus) ImmutableModule(_nexus) {}

  // @override
  function approveRewardToken() external {
    address liquidator = nexus.getModule(keccak256("Liquidator"));
    require(liquidator != address(0), "Liquidator address cannot be zero");

    MassetHelpers.safeInfiniteApprove(rewardToken, liquidator);

    emit RewardTokenApproved(rewardToken, liquidator);
  }

  function setRewardToken(address _token) external {
    rewardToken = _token;
  }

  function setRewardAmount(uint256 _rewardAmount) external {
    rewardAmount = _rewardAmount;
  }

  /// @dev this assumes some reward tokens have been transferred to this contract
  function claimRewards() external {
    IERC20(rewardToken).transfer(msg.sender, rewardAmount);
  }
}
