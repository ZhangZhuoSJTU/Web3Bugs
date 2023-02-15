// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "../Vault.sol";
import "../interfaces/IVaultGovernance.sol";
import "../interfaces/IVault.sol";

contract VaultTest is Vault {
    uint256[] res;

    constructor(IVaultGovernance vaultGovernance_, address[] memory vaultTokens_)
        Vault(vaultGovernance_, vaultTokens_)
    {
        res = new uint256[](1);
        res[0] = 0;
    }

    function tvl() public view override returns (uint256[] memory tokenAmounts) {
        return res;
    }

    function _push(uint256[] memory, bytes memory) internal view override returns (uint256[] memory) {
        // no-op, tokens are already on balance
        return res;
    }

    function _pull(
        address,
        uint256[] memory,
        bytes memory
    ) internal view override returns (uint256[] memory) {
        return res;
    }

    function postReclaimTokens(address to, address[] memory tokens) external {
        _postReclaimTokens(to, tokens);
    }

    function isValidPullDestination(address to) external view returns (bool) {
        return _isValidPullDestination(to);
    }

    function isApprovedOrOwner(address to) external view returns (bool) {
        return _isApprovedOrOwner(to);
    }
}
