// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IERC721 {

  function approve(address to, uint tokenId) external;
  function ownerOf(uint _tokenId) external view returns (address);

  function safeTransferFrom(
    address from,
    address to,
    uint tokenId
  ) external;
}
