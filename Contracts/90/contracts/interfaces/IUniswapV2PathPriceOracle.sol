// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IPriceOracle.sol";

/// @title Uniswap path price oracle interface
/// @notice Contains logic for price calculation of asset which doesn't have a pair with a base asset
interface IUniswapV2PathPriceOracle is IPriceOracle {
    /// @notice Returns anatomy data for the current oracle
    /// @return _path List of assets to compose exchange pairs
    /// @return _oracles List of corresponding price oracles for pairs provided by {_path}
    function anatomy() external view returns (address[] calldata _path, address[] calldata _oracles);
}
