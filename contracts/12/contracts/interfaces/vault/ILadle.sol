// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface ILadle {
    /// @dev Allow liquidation contracts to move assets to wind down vaults
    function settle(bytes12 vaultId, address user, uint128 ink, uint128 art) external;
}