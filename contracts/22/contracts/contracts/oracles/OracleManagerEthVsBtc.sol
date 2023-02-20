// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IOracleManager.sol";

/**
  Contract that gives price ration of ETH/BTC
*/
contract OracleManagerEthVsBtc is IOracleManager {
  address public admin; // This will likely be the Gnosis safe

  int256 public ethDominance;

  // Oracle addresses
  AggregatorV3Interface public btcOracle;
  AggregatorV3Interface public ethOracle;

  ////////////////////////////////////
  /////////// MODIFIERS //////////////
  ////////////////////////////////////

  modifier adminOnly() {
    require(msg.sender == admin);
    _;
  }

  ////////////////////////////////////
  ///// CONTRACT SET-UP //////////////
  ////////////////////////////////////

  constructor(
    address _admin,
    address _btcOracle,
    address _ethOracle
  ) {
    admin = _admin;

    btcOracle = AggregatorV3Interface(_btcOracle);
    ethOracle = AggregatorV3Interface(_ethOracle);

    _updatePrice();
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

  function _updatePrice() private returns (int256) {
    (, int256 _ethPrice, , , ) = ethOracle.latestRoundData();
    (, int256 _btcPrice, , , ) = btcOracle.latestRoundData();

    // 1e20 as 18 decimals but as %
    ethDominance = int256((uint256(_ethPrice) * 1e20) / (uint256(_btcPrice)));

    return ethDominance;
  }

  function updatePrice() external override returns (int256) {
    return _updatePrice();
  }

  function getLatestPrice() external view override returns (int256) {
    return ethDominance;
  }
}
