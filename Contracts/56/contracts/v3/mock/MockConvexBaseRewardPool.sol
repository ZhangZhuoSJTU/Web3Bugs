// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract MockConvexBaseRewardPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;

    uint256 public pid;
    uint256 public extraRewardsLength;

    constructor(
        uint256 pid_,
        address, /*stakingToken_*/
        address rewardToken_,
        address, /*operator_*/
        address /*rewardManager_*/
    ) public {
        pid = pid_;
        rewardToken = IERC20(rewardToken_);
        extraRewardsLength = 0;
    }

    function stakeFor(
        address, /*_for*/
        uint256 /*_amount*/
    ) public pure returns (bool) {
        return true;
    }

    function getReward(
        address _account,
        bool /*_claimExtras*/
    ) public returns (bool) {
        IERC20(rewardToken).safeTransferFrom(address(this), _account, 1000);
        return true;
    }
}
