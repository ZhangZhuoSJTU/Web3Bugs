// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";

import {CERC20} from "./CERC20.sol";
import {PriceFeed} from "./PriceFeed.sol";

/// @title Comptroller
/// @author Compound Labs and Rari Capital
/// @notice Minimal Compound/Fuse Comptroller interface.
interface Comptroller {
    /// @notice Retrieves the admin of the Comptroller.
    /// @return The current administrator of the Comptroller.
    function admin() external view returns (address);

    /// @notice Retrieves the price feed of the Comptroller.
    /// @return The current price feed of the Comptroller.
    function oracle() external view returns (PriceFeed);

    /// @notice Maps underlying tokens to their equivalent cTokens in a pool.
    /// @param token The underlying token to find the equivalent cToken for.
    /// @return The equivalent cToken for the given underlying token.
    function cTokensByUnderlying(ERC20 token) external view returns (CERC20);

    /// @notice Get's data about a cToken.
    /// @param cToken The cToken to get data about.
    /// @return isListed Whether the cToken is listed in the Comptroller.
    /// @return collateralFactor The collateral factor of the cToken.

    function markets(CERC20 cToken) external view returns (bool isListed, uint256 collateralFactor);

    /// @notice Enters into a list of cToken markets, enabling them as collateral.
    /// @param cTokens The list of cTokens to enter into, enabling them as collateral.
    /// @return A list of error codes, or 0 if there were no failures in entering the cTokens.
    function enterMarkets(CERC20[] calldata cTokens) external returns (uint256[] memory);
}
