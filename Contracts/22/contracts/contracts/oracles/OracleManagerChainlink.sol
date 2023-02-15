// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "../interfaces/IOracleManager.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/*
 * Implementation of an OracleManager that fetches prices from a Chainlink aggregate price feed.
 */
contract OracleManagerChainlink is IOracleManager {
  // Admin addresses.
  address public admin;

  // Global state.
  AggregatorV3Interface public chainlinkOracle;
  uint8 public oracleDecimals;

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
  constructor(address _admin, address _chainLinkOracle) {
    admin = _admin;
    chainlinkOracle = AggregatorV3Interface(_chainLinkOracle);
    oracleDecimals = chainlinkOracle.decimals();
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
    (, int256 price, , , ) = chainlinkOracle.latestRoundData();
    return price;
  }

  function getLatestPrice() external view override returns (int256) {
    return _getLatestPrice();
  }

  function updatePrice() external override returns (int256) {
    return _getLatestPrice();
  }
}
