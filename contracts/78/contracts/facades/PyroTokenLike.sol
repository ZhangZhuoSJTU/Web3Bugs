// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

abstract contract PyroTokenLike {
  function mint(address to, uint256 baseTokenAmount) external payable virtual returns (uint256);

  function redeemRate() public view virtual returns (uint256);
}
