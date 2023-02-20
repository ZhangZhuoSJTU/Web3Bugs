// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "../interfaces/IVaultGovernance.sol";
import "../interfaces/IVaultFactory.sol";
import "../ERC20Vault.sol";

contract ERC20VaultTest is ERC20Vault {
    constructor(IVaultGovernance vaultGovernance_, address[] memory vaultTokens_)
        ERC20Vault(vaultGovernance_, vaultTokens_)
    {}

    function setVaultGovernance(address newVaultGovernance) public {
        _vaultGovernance = IVaultGovernance(newVaultGovernance);
    }

    function __postReclaimTokens(address a, address[] memory tokens) public view {
        _postReclaimTokens(a, tokens);
    }
}
