// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "../interfaces/IOracleManager.sol";

/*
 * Mock implementation of an OracleManager with fixed, changeable prices.
 */
contract OracleManagerMock is IOracleManager {
  // Admin contract.
  address public admin;

  // Global state.
  int256 currentPrice; // e18

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

  constructor(address _admin) {
    admin = _admin;

    // Default to a price of 1.
    currentPrice = 1e18;
  }

  ////////////////////////////////////
  ///// IMPLEMENTATION ///////////////
  ////////////////////////////////////

  function setPrice(int256 newPrice) public adminOnly {
    currentPrice = newPrice;
  }

  function updatePrice() external override returns (int256) {
    return currentPrice;
  }

  function getLatestPrice() external view override returns (int256) {
    return currentPrice;
  }
}
