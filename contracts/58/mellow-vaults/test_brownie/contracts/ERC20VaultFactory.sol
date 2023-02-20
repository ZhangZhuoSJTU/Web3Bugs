// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "./interfaces/IVaultFactory.sol";
import "./ERC20Vault.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Helper contract for ERC20VaultGovernance that can create new ERC20 Vaults.
contract ERC20VaultFactory is IVaultFactory {
    IVaultGovernance public vaultGovernance;

    /// @notice Creates a new contract.
    /// @param vaultGovernance_ Reference to VaultGovernance of this VaultKind
    constructor(IVaultGovernance vaultGovernance_) {
        vaultGovernance = vaultGovernance_;
    }

    /// @inheritdoc IVaultFactory
    function deployVault(address[] memory vaultTokens, bytes memory) external returns (IVault) {
        require(msg.sender == address(vaultGovernance), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        ERC20Vault vault = new ERC20Vault(vaultGovernance, vaultTokens);
        return IVault(vault);
    }
}
