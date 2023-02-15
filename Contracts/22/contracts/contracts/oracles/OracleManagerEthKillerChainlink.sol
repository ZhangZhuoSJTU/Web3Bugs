// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IOracleManager.sol";

contract OracleManagerEthKillerChainlink is IOracleManager {
  address public admin; // This will likely be the Gnosis safe

  // Oracle price, changes by average of the underlying asset changes.
  int256 public indexPrice;

  // Underlying asset prices.
  int256 public tronPrice;
  int256 public eosPrice;
  int256 public xrpPrice;

  // Oracle addresses
  AggregatorV3Interface public tronOracle;
  AggregatorV3Interface public eosOracle;
  AggregatorV3Interface public xrpOracle;

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
    address _tronOracle,
    address _eosOracle,
    address _xrpOracle
  ) {
    admin = _admin;
    tronOracle = AggregatorV3Interface(_tronOracle);
    eosOracle = AggregatorV3Interface(_eosOracle);
    xrpOracle = AggregatorV3Interface(_xrpOracle);
    // Initial asset prices.
    (tronPrice, eosPrice, xrpPrice) = _getAssetPrices();

    // Initial base index price.
    indexPrice = 1e18;
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

  function _getAssetPrices()
    internal
    view
    returns (
      int256,
      int256,
      int256
    )
  {
    (, int256 _tronPrice, , , ) = tronOracle.latestRoundData();
    (, int256 _eosPrice, , , ) = eosOracle.latestRoundData();
    (, int256 _xrpPrice, , , ) = xrpOracle.latestRoundData();
    return (_tronPrice, _eosPrice, _xrpPrice);
  }

  function _updatePrice() internal virtual returns (int256) {
    (int256 newTronPrice, int256 newEosPrice, int256 newXrpPrice) = _getAssetPrices();

    int256 valueOfChangeInIndex = (int256(indexPrice) *
      (_calcAbsolutePercentageChange(newTronPrice, tronPrice) +
        _calcAbsolutePercentageChange(newEosPrice, eosPrice) +
        _calcAbsolutePercentageChange(newXrpPrice, xrpPrice))) / (3 * 1e18);

    tronPrice = newTronPrice;
    eosPrice = newEosPrice;
    xrpPrice = newXrpPrice;

    indexPrice = indexPrice + valueOfChangeInIndex;

    return indexPrice;
  }

  function updatePrice() external override returns (int256) {
    return _updatePrice();
  }

  function _calcAbsolutePercentageChange(int256 newPrice, int256 basePrice) internal pure returns (int256) {
    return ((newPrice - basePrice) * (1e18)) / (basePrice);
  }

  function getLatestPrice() external view override returns (int256) {
    return indexPrice;
  }
}
