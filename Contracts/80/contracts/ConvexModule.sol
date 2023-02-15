// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.6;
import "@yield-protocol/vault-interfaces/ICauldron.sol";
import "@yield-protocol/vault-interfaces/DataTypes.sol";
import "./interfaces/IConvexYieldWrapper.sol";
import "../../LadleStorage.sol";

/// @title Convex Ladle Module to handle vault addition
contract ConvexModule is LadleStorage {
    constructor(ICauldron cauldron_, IWETH9 weth_) LadleStorage(cauldron_, weth_) {}

    /// @notice Adds a vault to the user's vault list in the convex wrapper
    /// @param convexStakingWrapper The address of the convex wrapper to which the vault will be added
    /// @param vaultId The vaulId to be added
    function addVault(IConvexYieldWrapper convexStakingWrapper, bytes12 vaultId) external {
        if (vaultId == bytes12(0)) {
            convexStakingWrapper.addVault(cachedVaultId);
        } else {
            convexStakingWrapper.addVault(vaultId);
        }
    }

    /// @notice Removes a vault from the user's vault list in the convex wrapper
    /// @param convexStakingWrapper The address of the convex wrapper from which the vault will be removed
    /// @param vaultId The vaulId to be removed
    /// @param account The address of the user from whose list the vault is to be removed
    function removeVault(
        IConvexYieldWrapper convexStakingWrapper,
        bytes12 vaultId,
        address account
    ) external {
        convexStakingWrapper.removeVault(vaultId, account);
    }
}
