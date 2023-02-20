// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IBandOracle.sol";
import "../interfaces/IOracleManager.sol";

contract OracleManagerEthKiller is IOracleManager {
  address public admin; // This will likely be the Gnosis safe

  // Oracle price, changes by average of the underlying asset changes.
  uint256 public indexPrice;

  // Underlying asset prices.
  uint256 public tronPrice;
  uint256 public eosPrice;
  uint256 public xrpPrice;

  // Band oracle address.
  IBandOracle public oracle;

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

  constructor(address _admin, address _bandOracle) {
    admin = _admin;
    oracle = IBandOracle(_bandOracle);

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
      uint256,
      uint256,
      uint256
    )
  {
    string[] memory baseSymbols = new string[](3);
    baseSymbols[0] = "TRX"; // tron
    baseSymbols[1] = "EOS"; // eos
    baseSymbols[2] = "XRP"; // ripple

    string[] memory quoteSymbols = new string[](3);
    quoteSymbols[0] = "BUSD";
    quoteSymbols[1] = "BUSD";
    quoteSymbols[2] = "BUSD";

    IBandOracle.ReferenceData[] memory data = oracle.getReferenceDataBulk(baseSymbols, quoteSymbols);

    return (data[0].rate, data[1].rate, data[2].rate);
  }

  function updatePrice() external override returns (int256) {
    (uint256 newTronPrice, uint256 newEosPrice, uint256 newXrpPrice) = _getAssetPrices();

    int256 valueOfChangeInIndex = (int256(indexPrice) *
      (_calcAbsolutePercentageChange(newTronPrice, tronPrice) +
        _calcAbsolutePercentageChange(newEosPrice, eosPrice) +
        _calcAbsolutePercentageChange(newXrpPrice, xrpPrice))) / (3 * 1e18);

    tronPrice = newTronPrice;
    eosPrice = newEosPrice;
    xrpPrice = newXrpPrice;

    indexPrice = uint256(int256(indexPrice) + valueOfChangeInIndex);

    return int256(indexPrice);
  }

  function _calcAbsolutePercentageChange(uint256 newPrice, uint256 basePrice) internal pure returns (int256) {
    return ((int256(newPrice) - int256(basePrice)) * (1e18)) / (int256(basePrice));
  }

  function getLatestPrice() external view override returns (int256) {
    return int256(indexPrice);
  }
}
