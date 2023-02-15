// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IPriceOracle.sol";

/// @title Uniswap price oracle interface
/// @notice Contains logic for price calculation of asset using Uniswap V2 Pair
interface IUniswapV2PriceOracle is IPriceOracle {
    /// @notice Asset0 in the pair
    /// @return Returns address of asset0 in the pair
    function asset0() external view returns (address);

    /// @notice Asset1 in the pair
    /// @return Returns address of asset1 in the pair
    function asset1() external view returns (address);
}
