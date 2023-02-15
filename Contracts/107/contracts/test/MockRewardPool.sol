// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IBaseRewardPool.sol";

contract MockRewardPool is IBaseRewardPool {
    IERC20 internal poolToken;
    address public override rewardToken;
    address[] public override extraRewards;

    constructor(
        IERC20 _poolToken,
        address _rewardToken,
        address[] memory _extraRewards
    ) {
        poolToken = _poolToken;
        rewardToken = _rewardToken;
        extraRewards = _extraRewards;
    }

    function withdrawAllAndUnwrap(bool claim) external override {
        withdrawAndUnwrap(balanceOf(address(0)), claim);
    }

    function withdrawAndUnwrap(uint256 amount, bool claim)
        public
        override
        returns (bool)
    {
        poolToken.transfer(msg.sender, amount);
        if (claim) getReward(msg.sender, true);
        return true;
    }

    function getReward(address recipient, bool claimExtras) public override returns (bool) {
        IERC20(rewardToken).transfer(recipient, IERC20(rewardToken).balanceOf(address(this)));
        if (claimExtras) {
            for (uint256 i = 0; i < extraRewards.length; i++) {
                IBaseRewardPool(extraRewards[i]).getReward(
                    recipient,
                    true
                );
            }
        }

        return true;
    }

    function balanceOf(address) public view override returns (uint256) {
        return poolToken.balanceOf(address(this));
    }

    function extraRewardsLength() external view override returns (uint256) {
        return extraRewards.length;
    }

    function earned() external view override returns (uint256) {
        return IERC20(rewardToken).balanceOf(address(this));
    }
}
