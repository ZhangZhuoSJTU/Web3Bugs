// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

interface IPriceOracle {
  function tokenPrice(address _token) external view returns(uint);
  function tokenSupported(address _token) external view returns(bool);
}
