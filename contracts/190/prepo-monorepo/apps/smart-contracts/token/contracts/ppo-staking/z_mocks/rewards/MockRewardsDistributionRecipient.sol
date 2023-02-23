// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRewardsRecipientWithPlatformToken} from "../../interfaces/IRewardsDistributionRecipient.sol";
import {IRewardsDistributionRecipient} from "../../interfaces/IRewardsDistributionRecipient.sol";

contract MockRewardsDistributionRecipient is
  IRewardsDistributionRecipient,
  IRewardsRecipientWithPlatformToken
{
  IERC20 public rewardToken;
  IERC20 public platformToken;

  constructor(IERC20 _rewardToken, IERC20 _platformToken) {
    rewardToken = _rewardToken;
    platformToken = _platformToken;
  }

  function notifyRewardAmount(uint256 reward)
    external
    override(IRewardsDistributionRecipient, IRewardsRecipientWithPlatformToken)
  {
    // do nothing
  }

  function getRewardToken()
    external
    view
    override(IRewardsDistributionRecipient, IRewardsRecipientWithPlatformToken)
    returns (IERC20)
  {
    return rewardToken;
  }

  function getPlatformToken() external view override returns (IERC20) {
    return platformToken;
  }
}
