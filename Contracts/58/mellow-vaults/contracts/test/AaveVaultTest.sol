// SPDX-License-Identifier: agpl-3.0
pragma solidity =0.8.9;

import "../interfaces/IVaultGovernance.sol";
import "../AaveVault.sol";

contract AaveVaultTest is AaveVault {
    constructor(IVaultGovernance vaultGovernance_, address[] memory vaultTokens_)
        AaveVault(vaultGovernance_, vaultTokens_)
    {}

    function setATokens(address[] memory aTokens) public {
        _aTokens = aTokens;
    }

    function setVaultGovernance(address newVaultGovernance) public {
        _vaultGovernance = IVaultGovernance(newVaultGovernance);
    }
}
