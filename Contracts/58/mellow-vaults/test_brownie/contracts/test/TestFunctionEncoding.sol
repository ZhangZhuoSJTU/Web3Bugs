// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "../Vault.sol";
import "../interfaces/IVaultGovernance.sol";
import "../interfaces/IVault.sol";

contract TestFunctionEncoding {
    Vault public vault;

    constructor(Vault _vault) {
        vault = _vault;
    }

    function encodeWithSignatureTest(address from) external {
        bytes memory data = abi.encodeWithSignature("tvl()");
        vault.claimRewards(from, data);
    }
}
