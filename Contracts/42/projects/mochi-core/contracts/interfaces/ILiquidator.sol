// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

interface ILiquidator {
    event Triggered(uint256 _auctionId, uint256 _price);
    event Settled(uint256 _auctionId, uint256 _price);

    function triggerLiquidation(address _asset, uint256 _nftId) external;
}
