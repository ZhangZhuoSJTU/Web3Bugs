// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IPriceOracle {

  function tokenPrice(address _token) external view returns(uint);
  function tokenSupported(address _token) external view returns(bool);
  function convertTokenValues(address _fromToken, address _toToken, uint _amount) external view returns(uint);
}
