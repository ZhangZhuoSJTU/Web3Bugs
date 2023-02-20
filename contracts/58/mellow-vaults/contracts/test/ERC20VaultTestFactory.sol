// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "../interfaces/IVaultFactory.sol";
import "../interfaces/IVaultGovernance.sol";
import "./ERC20VaultTest.sol";

contract ERC20VaultTestFactory is IVaultFactory {
    IVaultGovernance public vaultGovernance;

    constructor(IVaultGovernance vaultGovernance_) {
        vaultGovernance = vaultGovernance_;
    }

    function setVaultGovernance(address newVaultGovernance) public {
        vaultGovernance = IVaultGovernance(newVaultGovernance);
    }

    function deployVault(address[] memory vaultTokens, bytes memory) external returns (IVault) {
        require(msg.sender == address(vaultGovernance), "VG");
        ERC20VaultTest vault = new ERC20VaultTest(vaultGovernance, vaultTokens);
        return IVault(vault);
    }
}
