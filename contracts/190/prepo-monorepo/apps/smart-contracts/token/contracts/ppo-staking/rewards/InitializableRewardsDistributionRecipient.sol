// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ImmutableModule} from "../shared/ImmutableModule.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRewardsDistributionRecipient} from "../interfaces/IRewardsDistributionRecipient.sol";

/**
 * @title  RewardsDistributionRecipient
 * @author Originally: Synthetix (forked from /Synthetixio/synthetix/contracts/RewardsDistributionRecipient.sol)
 *         Changes by: mStable
 * @notice RewardsDistributionRecipient gets notified of additional rewards by the rewardsDistributor
 * @dev    Changes: Addition of Module and abstract `getRewardToken` func + cosmetic
 */
abstract contract InitializableRewardsDistributionRecipient is
  IRewardsDistributionRecipient,
  ImmutableModule
{
  // This address has the ability to distribute the rewards
  address public rewardsDistributor;

  constructor(address _nexus) ImmutableModule(_nexus) {}

  /** @dev Recipient is a module, governed by mStable governance */
  function _initialize(address _rewardsDistributor) internal virtual {
    rewardsDistributor = _rewardsDistributor;
  }

  /**
   * @dev Only the rewards distributor can notify about rewards
   */
  modifier onlyRewardsDistributor() {
    require(
      msg.sender == rewardsDistributor,
      "Caller is not reward distributor"
    );
    _;
  }

  /**
   * @dev Change the rewardsDistributor - only called by mStable governor
   * @param _rewardsDistributor   Address of the new distributor
   */
  function setRewardsDistribution(address _rewardsDistributor)
    external
    onlyGovernor
  {
    rewardsDistributor = _rewardsDistributor;
  }
}
