// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

interface ILinkOracle {
  function latestAnswer() external view returns(uint);
  function decimals() external view returns(int256);
}
