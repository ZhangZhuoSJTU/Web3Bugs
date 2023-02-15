// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity 0.8.10;

import "./IAddressProvider.sol";

interface IDexAddressProvider {
  event DexSet(uint8);

  struct Dex {
    address proxy;
    address router;
  }

  function setDexMapping(
    uint256 _index,
    address _proxy,
    address _dex
  ) external;

  function parallel() external view returns (IAddressProvider);

  function dexMapping(uint256 index) external view returns (address, address);
}
