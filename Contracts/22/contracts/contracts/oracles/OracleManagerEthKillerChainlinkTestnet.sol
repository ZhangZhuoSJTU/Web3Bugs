// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "./OracleManagerEthKillerChainlink.sol";

contract OracleManagerEthKillerChainlinkTestnet is OracleManagerEthKillerChainlink {
  uint256 lastUpdate;
  uint256 maxUpdateIntervalSeconds;
  int256 forcedPriceAdjustment;

  constructor(
    address _admin,
    address _tronOracle,
    address _eosOracle,
    address _xrpOracle,
    uint256 _maxUpdateIntervalSeconds
  ) OracleManagerEthKillerChainlink(_admin, _tronOracle, _eosOracle, _xrpOracle) {
    maxUpdateIntervalSeconds = _maxUpdateIntervalSeconds;
  }

  function setMaxUpdateInterval(uint256 newMaxUpdateIntervalSeconds) external adminOnly {
    maxUpdateIntervalSeconds = newMaxUpdateIntervalSeconds;
  }

  function _updatePrice() internal override returns (int256) {
    int256 previousPrice = indexPrice;
    int256 latestPrice = super._updatePrice();

    if (previousPrice != latestPrice || lastUpdate + maxUpdateIntervalSeconds < block.timestamp) {
      forcedPriceAdjustment = (forcedPriceAdjustment + 1) % 2;
      lastUpdate = block.timestamp;
    }

    return latestPrice + forcedPriceAdjustment;
  }
}
