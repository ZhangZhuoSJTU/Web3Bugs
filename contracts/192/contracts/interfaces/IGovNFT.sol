// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGovNFT {
    function distribute(address _tigAsset, uint _amount) external;
    function safeTransferMany(address _to, uint[] calldata _ids) external;
    function claim(address _tigAsset) external;
    function pending(address user, address _tigAsset) external view returns (uint256);
}