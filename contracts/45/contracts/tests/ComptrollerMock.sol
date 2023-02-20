//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract ComptrollerMock {
    address public unionToken;
    uint256 public rewardAmount;

    function __ComptrollerMock_init() public {}

    function getRewardsMultiplier(address account, address token) public view returns (uint256) {}

    function setRewardsInfo(address _unionToken, uint256 _rewardAmount) external {
        unionToken = _unionToken;
        rewardAmount = _rewardAmount;
    }

    function withdrawRewards(address sender, address) external returns (uint256) {
        IERC20Upgradeable(unionToken).transfer(sender, rewardAmount);
        return rewardAmount;
    }

    function calculateRewardsByBlocks(
        address account,
        address token,
        uint256 futureBlocks
    ) public view returns (uint256) {}

    function calculateRewards(address account, address token) public view returns (uint256) {
        return calculateRewardsByBlocks(account, token, 0);
    }

    function inflationPerBlock(uint256) public view returns (uint256) {}

    function updateTotalStaked(address, uint256) external pure returns (bool) {
        return true;
    }
}
