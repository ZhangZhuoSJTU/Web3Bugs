// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IIndexFactory.sol";

/// @title Top N market capitalization index factory interface
/// @notice Contains logic for top N market capitalization index creation
interface ITopNMarketCapIndexFactory is IIndexFactory {
    /// @notice Market cap categories address
    /// @return Returns market cap categories address
    function marketCapCategories() external view returns (address);
}
