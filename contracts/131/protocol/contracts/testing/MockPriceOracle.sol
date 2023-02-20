// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/oracles/IOracleProvider.sol";

contract MockPriceOracle is IOracleProvider {
    mapping(address => uint256) internal _prices;

    function setPrice(address baseAsset, uint256 price) external {
        _prices[baseAsset] = price;
    }

    /// @inheritdoc IOracleProvider
    /// @dev this is a dummy function that tries to read from the state
    /// and otherwise simply returns 1
    function getPriceUSD(address baseAsset) external view returns (uint256) {
        uint256 cachedPrice = _prices[baseAsset];
        return cachedPrice == 0 ? 1e18 : cachedPrice;
    }

    /// @inheritdoc IOracleProvider
    /// @dev this is a dummy function that tries to read from the state
    /// and otherwise simply returns 1
    function getPriceETH(address baseAsset) external view returns (uint256) {
        uint256 cachedPrice = _prices[baseAsset];
        return cachedPrice == 0 ? 1e18 : cachedPrice;
    }
}
