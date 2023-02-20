// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IVault.sol";

interface IGatewayVault is IVault {
    /// @notice List of subvaults nfts
    function subvaultNfts() external view returns (uint256[] memory);

    /// @notice Checks that vault is subvault of the IGatewayVault.
    /// @param vault The vault to check
    /// @return `true` if vault is a subvault of the IGatewayVault
    function hasSubvault(address vault) external view returns (bool);

    /// @notice Breakdown of tvls by subvault.
    /// @return tokenAmounts Token amounts with subvault breakdown. If there are `k` subvaults then token `j`, `tokenAmounts[j]` would be a vector 1 x k - breakdown of token amount by subvaults
    function subvaultsTvl() external view returns (uint256[][] memory tokenAmounts);

    /// @notice A tvl of a specific subvault.
    /// @param vaultNum The number of the subvault in the subvaults array
    /// @return An array of token amounts (tvl) in the same order as vaultTokens
    function subvaultTvl(uint256 vaultNum) external view returns (uint256[] memory);

    /// @notice Adds subvaults NFTs to vault.
    /// @dev Can be called only once by GatewayVaultGovernance
    /// @param nfts Subvault NFTs to add
    function addSubvaults(uint256[] memory nfts) external;

    /// @notice Approves all NFTs to given address.
    /// @dev Can be called only once by GatewayVaultGovernance
    /// @param strategy The address to which all NFTs will be approved (strategy)
    /// @param nfts Subvault NFTs to add
    function setApprovalsForStrategy(address strategy, uint256[] memory nfts) external;
}
