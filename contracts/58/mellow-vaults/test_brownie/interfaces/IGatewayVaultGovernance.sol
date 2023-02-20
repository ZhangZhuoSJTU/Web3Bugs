// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IVaultGovernance.sol";

interface IGatewayVaultGovernance is IVaultGovernance {
    /// @notice Params that could be changed by Strategy or Protocol Governance with Protocol Governance delay.
    /// @param redirects Redirects[i] is the nft of subvault that will receive deposit to i-th subvault. If the array is empty there is no redirects
    struct DelayedStrategyParams {
        uint256[] redirects;
    }
    /// @notice Params that could be changed by Strategy or Protocol Governance immediately.
    /// @param limits Token limits for the vault
    struct StrategyParams {
        uint256[] limits;
    }

    /// @notice Delayed Strategy Params, i.e. Params that could be changed by Strategy or Protocol Governance with Protocol Governance delay.
    /// @param nft VaultRegistry NFT of the vault
    function delayedStrategyParams(uint256 nft) external view returns (DelayedStrategyParams memory);

    /// @notice Delayed Strategy Params staged for commit after delay.
    /// @param nft VaultRegistry NFT of the vault
    function stagedDelayedStrategyParams(uint256 nft) external view returns (DelayedStrategyParams memory);

    /// @notice Strategy Params.
    /// @param nft VaultRegistry NFT of the vault
    function strategyParams(uint256 nft) external view returns (StrategyParams memory);

    /// @notice Stage Delayed Strategy Params, i.e. Params that could be changed by Strategy or Protocol Governance with Protocol Governance delay.
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params
    function stageDelayedStrategyParams(uint256 nft, DelayedStrategyParams calldata params) external;

    /// @notice Commit Delayed Strategy Params, i.e. Params that could be changed by Strategy or Protocol Governance with Protocol Governance delay.
    /// @dev Can only be called after delayedStrategyParamsTimestamp
    /// @param nft VaultRegistry NFT of the vault
    function commitDelayedStrategyParams(uint256 nft) external;

    /// @notice Set Strategy params, i.e. Params that could be changed by Strategy or Protocol Governance immediately.
    /// @param nft Nft of the vault
    /// @param params New params
    function setStrategyParams(uint256 nft, StrategyParams calldata params) external;
}
