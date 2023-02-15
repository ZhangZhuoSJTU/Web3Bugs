// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;
pragma abicoder v2;

import "../interfaces/IOracleManager.sol";
import "../interfaces/IBandOracle.sol";

/*
 * Implementation of an OracleManager that fetches prices from a band oracle.
 */
contract OracleManagerBand is IOracleManager {
  // Admin addresses.
  address public admin;

  // Global state.
  IBandOracle public bandOracle;
  string public base; // base pair for prices
  string public quote; // quote pair for prices

  ////////////////////////////////////
  /////////// MODIFIERS //////////////
  ////////////////////////////////////

  modifier adminOnly() {
    require(msg.sender == admin, "Not admin");
    _;
  }

  ////////////////////////////////////
  ///// CONTRACT SET-UP //////////////
  ////////////////////////////////////

  constructor(
    address _admin,
    address _bandOracle,
    string memory _base,
    string memory _quote
  ) {
    admin = _admin;
    base = _base;
    quote = _quote;

    bandOracle = IBandOracle(_bandOracle);
  }

  ////////////////////////////////////
  /// MULTISIG ADMIN FUNCTIONS ///////
  ////////////////////////////////////

  function changeAdmin(address _admin) external adminOnly {
    admin = _admin;
  }

  ////////////////////////////////////
  ///// IMPLEMENTATION ///////////////
  ////////////////////////////////////
  function _getLatestPrice() internal view returns (int256) {
    IBandOracle.ReferenceData memory data = bandOracle.getReferenceData(base, quote);

    return int256(data.rate);
  }

  function getLatestPrice() external view override returns (int256) {
    return _getLatestPrice();
  }

  function updatePrice() external override returns (int256) {
    return _getLatestPrice();
  }
}
