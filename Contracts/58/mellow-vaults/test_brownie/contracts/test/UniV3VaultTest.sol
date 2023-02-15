// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "../interfaces/IVaultGovernance.sol";
import "../interfaces/IVaultFactory.sol";
import "../UniV3Vault.sol";

contract UniV3VaultTest is UniV3Vault {
    constructor(
        IVaultGovernance vaultGovernance_,
        address[] memory vaultTokens_,
        uint24 fee
    ) UniV3Vault(vaultGovernance_, vaultTokens_, fee) {}

    function setVaultGovernance(address newVaultGovernance) public {
        _vaultGovernance = IVaultGovernance(newVaultGovernance);
    }
}
