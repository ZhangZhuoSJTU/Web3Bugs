// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;


// Wrapped Asset
interface IWAsset {

    function wrap(uint _amount, address _from, address _to, address _rewardOwner) external;

    function unwrap(uint amount) external;

    function unwrapFor(address _from, address _to, uint amount) external;

    function updateReward(address from, address to, uint amount) external;

    function claimReward(address _to) external;

    function getPendingRewards(address _for) external view returns (address[] memory tokens, uint[] memory amounts);

    function getUserInfo(address _user) external returns (uint, uint, uint);

    function endTreasuryReward(address _to, uint _amount) external;
}