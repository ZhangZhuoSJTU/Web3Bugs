// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "../interfaces/IVaultGovernance.sol";
import "../interfaces/IVaultFactory.sol";
import "../GatewayVault.sol";

contract GatewayVaultTest is GatewayVault {
    constructor(IVaultGovernance vaultGovernance_, address[] memory vaultTokens_)
        GatewayVault(vaultGovernance_, vaultTokens_)
    {}

    function isValidPullDestination(address to) public view returns (bool) {
        return _isValidPullDestination(to);
    }

    function setVaultGovernance(address newVaultGovernance) public {
        _vaultGovernance = IVaultGovernance(newVaultGovernance);
    }

    function setSubvaultNfts(uint256[] memory nfts) public {
        _subvaultNfts = nfts;
    }

    function isApprovedOrOwner(address sender) public view returns (bool) {
        return _isApprovedOrOwner(sender);
    }

    function setVaultTokens(address[] memory tokens) public {
        _vaultTokens = tokens;
    }
}
