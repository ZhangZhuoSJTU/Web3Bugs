// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "./interfaces/IVaultFactory.sol";
import "./LpIssuer.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Helper contract for LpIssuerGovernance that can create new LpIssuers.
contract LpIssuerFactory is IVaultFactory {
    IVaultGovernance public vaultGovernance;

    /// @notice Creates a new contract.
    /// @param vaultGovernance_ Reference to VaultGovernance of this VaultKind
    constructor(IVaultGovernance vaultGovernance_) {
        vaultGovernance = vaultGovernance_;
    }

    /// @inheritdoc IVaultFactory
    function deployVault(address[] memory vaultTokens, bytes memory options) external returns (IVault) {
        require(msg.sender == address(vaultGovernance), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        (string memory name, string memory symbol) = abi.decode(options, (string, string));
        LpIssuer vault = new LpIssuer(vaultGovernance, vaultTokens, name, symbol);
        return IVault(address(vault));
    }
}
