// SPDX-License-Identifier: MIT
pragma solidity >=0.5.17 <0.9.0;

interface IMintableERC20
{
  function mint(address account, uint256 amount) external returns (bool);
  function transfer(address recipient, uint256 amount) external returns (bool);
  function totalSupply() external returns (uint);
  function balanceOf(address account) external returns (uint256);
}