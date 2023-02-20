// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./IComptroller.sol";

// Based on https://github.com/compound-finance/compound-protocol/blob/v2.8.1/contracts/CToken.sol
// and https://github.com/compound-finance/compound-protocol/blob/v2.8.1/contracts/CTokenInterfaces.sol
interface ICToken is IERC20, IERC20Metadata {
    /// Indicator that this is a CToken contract (for inspection)
    function isCToken() external view returns (bool);

    /// Contract which oversees inter-cToken operations
    function comptroller() external view returns (IComptroller);

    /// Calculates and returns the current exchange rate.
    /// The decimal precision depends on the formula: 18 - 8 + Underlying Token Decimals
    function exchangeRateCurrent() external returns (uint);

    /// Calculates and returns the last stored rate.
    /// The decimal precision depends on the formula: 18 - 8 + Underlying Token Decimals
    function exchangeRateStored() external view returns (uint);
}
