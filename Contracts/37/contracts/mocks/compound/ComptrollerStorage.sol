// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./CTokenMock.sol";

contract ComptrollerStorage {
    struct Market {
        /// @notice Per-market mapping of "accounts in this asset"
        mapping(address => bool) accountMembership;
    }

    /// @notice Official mapping of cTokens -> Market metadata
    /// @dev Used e.g. to determine if a market is supported
    mapping(address => Market) internal markets;

    /// @notice Per-account mapping of "assets you are in", capped by maxAssets
    mapping(address => CTokenMock[]) internal accountAssets;
}
