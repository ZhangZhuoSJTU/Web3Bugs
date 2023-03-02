// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IBondNFT {
    function createLock(
        address _asset,
        uint _amount,
        uint _period,
        address _owner
    ) external returns(uint id);

    function extendLock(
        uint _id,
        address _asset,
        uint _amount,
        uint _period,
        address _sender
    ) external;

    function claim(
        uint _id,
        address _owner
    ) external returns(uint amount, address tigAsset);

    function claimDebt(
        address _owner,
        address _tigAsset
    ) external returns(uint amount);

    function release(
        uint _id,
        address _releaser
    ) external returns(uint amount, uint lockAmount, address asset, address _owner);

    function distribute(
        address _tigAsset,
        uint _amount
    ) external;

    function ownerOf(uint _id) external view returns (uint256);
    
    function totalAssets() external view returns (uint256);
    function getAssets() external view returns (address[] memory);
}