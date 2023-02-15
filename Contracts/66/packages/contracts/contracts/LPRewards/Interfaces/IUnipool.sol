// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;


interface IUnipool {
    function setParams(address _yetiTokenAddress, address _uniTokenAddress, uint256 _duration) external;
    function lastTimeRewardApplicable() external view returns (uint256);
    function rewardPerToken() external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function withdrawAndClaim() external;
    function claimReward() external;
    //function notifyRewardAmount(uint256 reward) external;
}
