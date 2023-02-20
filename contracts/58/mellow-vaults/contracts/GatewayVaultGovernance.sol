// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "./interfaces/IProtocolGovernance.sol";
import "./interfaces/IGatewayVaultGovernance.sol";
import "./interfaces/IGatewayVault.sol";
import "./VaultGovernance.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Governance that manages all Gateway Vaults params and can deploy a new Gateway Vault.
contract GatewayVaultGovernance is VaultGovernance, IGatewayVaultGovernance {
    /// @notice Creates a new contract.
    /// @param internalParams_ Initial Internal Params
    constructor(InternalParams memory internalParams_) VaultGovernance(internalParams_) {}

    /// @inheritdoc IGatewayVaultGovernance
    function delayedStrategyParams(uint256 nft) public view returns (DelayedStrategyParams memory) {
        if (_delayedStrategyParams[nft].length == 0) {
            return DelayedStrategyParams({redirects: new uint256[](0)});
        }
        return abi.decode(_delayedStrategyParams[nft], (DelayedStrategyParams));
    }

    /// @inheritdoc IGatewayVaultGovernance
    function stagedDelayedStrategyParams(uint256 nft) external view returns (DelayedStrategyParams memory) {
        if (_stagedDelayedStrategyParams[nft].length == 0) {
            return DelayedStrategyParams({redirects: new uint256[](0)});
        }
        return abi.decode(_stagedDelayedStrategyParams[nft], (DelayedStrategyParams));
    }

    /// @inheritdoc IGatewayVaultGovernance
    function strategyParams(uint256 nft) external view returns (StrategyParams memory) {
        if (_strategyParams[nft].length == 0) {
            return StrategyParams({limits: new uint256[](0)});
        }
        return abi.decode(_strategyParams[nft], (StrategyParams));
    }

    /// @inheritdoc IGatewayVaultGovernance
    function stageDelayedStrategyParams(uint256 nft, DelayedStrategyParams calldata params) external {
        IGatewayVault vault = IGatewayVault(_internalParams.registry.vaultForNft(nft));
        require(
            (params.redirects.length == 0) || (params.redirects.length == vault.subvaultNfts().length),
            ExceptionsLibrary.REDIRECTS_AND_VAULT_TOKENS_LENGTH
        );
        _stageDelayedStrategyParams(nft, abi.encode(params));
        emit StageDelayedStrategyParams(tx.origin, msg.sender, nft, params, _delayedStrategyParamsTimestamp[nft]);
    }

    /// @notice Deploy a new vault
    /// @param vaultTokens ERC20 tokens under vault management
    /// @param options Abi encoded uint256[] - an array of Nfts of subvaults. It is required that each nft subvault is approved by the caller to this address.
    /// @param strategy Strategy that will be approved to manage subvaults
    /// @return vault Address of the new vault
    /// @return nft Nft of the vault in the vault registry
    function deployVault(
        address[] memory vaultTokens,
        bytes memory options,
        address strategy
    ) public override(VaultGovernance, IVaultGovernance) returns (IVault vault, uint256 nft) {
        for (uint256 i = 0; i < vaultTokens.length; ++i) {
            require(_internalParams.protocolGovernance.isAllowedToken(vaultTokens[i]), "TNA");
        }
        (vault, nft) = super.deployVault(vaultTokens, "", msg.sender);
        uint256[] memory subvaultNfts = abi.decode(options, (uint256[]));
        IVaultRegistry registry = _internalParams.registry;
        IGatewayVault(address(vault)).addSubvaults(subvaultNfts);
        for (uint256 i = 0; i < subvaultNfts.length; i++) {
            registry.safeTransferFrom(msg.sender, address(vault), subvaultNfts[i]);
        }
        IGatewayVault gw = IGatewayVault(address(vault));
        gw.setApprovalsForStrategy(strategy, subvaultNfts);
    }

    /// @inheritdoc IGatewayVaultGovernance
    function commitDelayedStrategyParams(uint256 nft) external {
        _commitDelayedStrategyParams(nft);
        emit CommitDelayedStrategyParams(
            tx.origin,
            msg.sender,
            nft,
            abi.decode(_delayedStrategyParams[nft], (DelayedStrategyParams))
        );
    }

    /// @inheritdoc IGatewayVaultGovernance
    function setStrategyParams(uint256 nft, StrategyParams calldata params) external {
        _setStrategyParams(nft, abi.encode(params));
        emit SetStrategyParams(tx.origin, msg.sender, nft, params);
    }

    /// @notice Emitted when new DelayedStrategyParams are staged for commit
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params that were staged for commit
    /// @param when When the params could be committed
    event StageDelayedStrategyParams(
        address indexed origin,
        address indexed sender,
        uint256 indexed nft,
        DelayedStrategyParams params,
        uint256 when
    );

    /// @notice Emitted when new DelayedStrategyParams are committed
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params that are committed
    event CommitDelayedStrategyParams(
        address indexed origin,
        address indexed sender,
        uint256 indexed nft,
        DelayedStrategyParams params
    );

    /// @notice Emitted when new StrategyParams are set
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params that are set
    event SetStrategyParams(address indexed origin, address indexed sender, uint256 indexed nft, StrategyParams params);
}
