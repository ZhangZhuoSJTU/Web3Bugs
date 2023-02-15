// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity 0.8.10;

import "./IVaultsCore.sol";
import "./IPriceFeed.sol";
import "./IVaultsDataProvider.sol";

interface IAddressProvider {
  function core() external view returns (IVaultsCore);

  function priceFeed() external view returns (IPriceFeed);

  function vaultsData() external view returns (IVaultsDataProvider);

  function stablex() external view returns (address);
}
