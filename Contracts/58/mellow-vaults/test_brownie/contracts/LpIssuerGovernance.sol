// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./interfaces/ILpIssuerGovernance.sol";
import "./interfaces/ILpIssuer.sol";
import "./libraries/CommonLibrary.sol";
import "./VaultGovernance.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Governance that manages all Lp Issuers params and can deploy a new LpIssuer Vault.
contract LpIssuerGovernance is IERC721Receiver, ILpIssuerGovernance, VaultGovernance {
    uint256 public immutable MAX_PROTOCOL_FEE;
    uint256 public immutable MAX_MANAGEMENT_FEE;
    uint256 public immutable MAX_PERFORMANCE_FEE;

    /// @notice Creates a new contract.
    /// @param internalParams_ Initial Internal Params
    /// @param delayedProtocolParams_ Initial Protocol Params
    constructor(InternalParams memory internalParams_, DelayedProtocolParams memory delayedProtocolParams_)
        VaultGovernance(internalParams_)
    {
        _delayedProtocolParams = abi.encode(delayedProtocolParams_);
        MAX_PROTOCOL_FEE = 5 * CommonLibrary.DENOMINATOR;
        MAX_MANAGEMENT_FEE = 10 * CommonLibrary.DENOMINATOR;
        MAX_PERFORMANCE_FEE = 50 * CommonLibrary.DENOMINATOR;
    }

    /// @inheritdoc ILpIssuerGovernance
    function delayedProtocolParams() public view returns (DelayedProtocolParams memory) {
        if (_delayedProtocolParams.length == 0) {
            return DelayedProtocolParams({managementFeeChargeDelay: 0});
        }
        return abi.decode(_delayedProtocolParams, (DelayedProtocolParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function stagedDelayedProtocolParams() external view returns (DelayedProtocolParams memory) {
        if (_stagedDelayedProtocolParams.length == 0) {
            return DelayedProtocolParams({managementFeeChargeDelay: 0});
        }
        return abi.decode(_stagedDelayedProtocolParams, (DelayedProtocolParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function delayedProtocolPerVaultParams(uint256 nft) external view returns (DelayedProtocolPerVaultParams memory) {
        if (_delayedProtocolPerVaultParams[nft].length == 0) {
            return DelayedProtocolPerVaultParams({protocolFee: 0});
        }
        return abi.decode(_delayedProtocolPerVaultParams[nft], (DelayedProtocolPerVaultParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function stagedDelayedProtocolPerVaultParams(uint256 nft)
        external
        view
        returns (DelayedProtocolPerVaultParams memory)
    {
        if (_stagedDelayedProtocolPerVaultParams[nft].length == 0) {
            return DelayedProtocolPerVaultParams({protocolFee: 0});
        }
        return abi.decode(_stagedDelayedProtocolPerVaultParams[nft], (DelayedProtocolPerVaultParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function stagedDelayedStrategyParams(uint256 nft) external view returns (DelayedStrategyParams memory) {
        if (_stagedDelayedStrategyParams[nft].length == 0) {
            return
                DelayedStrategyParams({
                    strategyTreasury: address(0),
                    strategyPerformanceTreasury: address(0),
                    managementFee: 0,
                    performanceFee: 0
                });
        }
        return abi.decode(_stagedDelayedStrategyParams[nft], (DelayedStrategyParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function delayedStrategyParams(uint256 nft) external view returns (DelayedStrategyParams memory) {
        if (_delayedStrategyParams[nft].length == 0) {
            return
                DelayedStrategyParams({
                    strategyTreasury: address(0),
                    strategyPerformanceTreasury: address(0),
                    managementFee: 0,
                    performanceFee: 0
                });
        }
        return abi.decode(_delayedStrategyParams[nft], (DelayedStrategyParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function strategyParams(uint256 nft) external view returns (StrategyParams memory) {
        if (_strategyParams[nft].length == 0) {
            return StrategyParams({tokenLimitPerAddress: 0});
        }
        return abi.decode(_strategyParams[nft], (StrategyParams));
    }

    /// @inheritdoc ILpIssuerGovernance
    function stageDelayedStrategyParams(uint256 nft, DelayedStrategyParams calldata params) external {
        require(params.managementFee <= MAX_MANAGEMENT_FEE, ExceptionsLibrary.MAX_MANAGEMENT_FEE);
        require(params.performanceFee <= MAX_PERFORMANCE_FEE, ExceptionsLibrary.MAX_PERFORMANCE_FEE);
        _stageDelayedStrategyParams(nft, abi.encode(params));
        emit StageDelayedStrategyParams(tx.origin, msg.sender, nft, params, _delayedStrategyParamsTimestamp[nft]);
    }

    /// @inheritdoc ILpIssuerGovernance
    function commitDelayedStrategyParams(uint256 nft) external {
        _commitDelayedStrategyParams(nft);
        emit CommitDelayedStrategyParams(
            tx.origin,
            msg.sender,
            nft,
            abi.decode(_delayedStrategyParams[nft], (DelayedStrategyParams))
        );
    }

    /// @inheritdoc ILpIssuerGovernance
    function stageDelayedProtocolPerVaultParams(uint256 nft, DelayedProtocolPerVaultParams calldata params) external {
        require(params.protocolFee <= MAX_PROTOCOL_FEE, ExceptionsLibrary.MAX_PROTOCOL_FEE);
        _stageDelayedProtocolPerVaultParams(nft, abi.encode(params));
        emit StageDelayedProtocolPerVaultParams(
            tx.origin,
            msg.sender,
            nft,
            params,
            _delayedStrategyParamsTimestamp[nft]
        );
    }

    /// @inheritdoc ILpIssuerGovernance
    function commitDelayedProtocolPerVaultParams(uint256 nft) external {
        _commitDelayedProtocolPerVaultParams(nft);
        emit CommitDelayedProtocolPerVaultParams(
            tx.origin,
            msg.sender,
            nft,
            abi.decode(_delayedProtocolPerVaultParams[nft], (DelayedProtocolPerVaultParams))
        );
    }

    function setStrategyParams(uint256 nft, StrategyParams calldata params) external {
        _setStrategyParams(nft, abi.encode(params));
        emit SetStrategyParams(tx.origin, msg.sender, nft, params);
    }

    /// @inheritdoc ILpIssuerGovernance
    function stageDelayedProtocolParams(DelayedProtocolParams calldata params) external {
        _stageDelayedProtocolParams(abi.encode(params));
        emit StageDelayedProtocolParams(tx.origin, msg.sender, params, _delayedProtocolParamsTimestamp);
    }

    /// @inheritdoc ILpIssuerGovernance
    function commitDelayedProtocolParams() external {
        _commitDelayedProtocolParams();
        emit CommitDelayedProtocolParams(
            tx.origin,
            msg.sender,
            abi.decode(_delayedProtocolParams, (DelayedProtocolParams))
        );
    }

    /// @notice Required for intermediate vault token transfer in deploy
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external view returns (bytes4) {
        IVaultRegistry registry = _internalParams.registry;
        require(msg.sender == address(registry), ExceptionsLibrary.NFT_VAULT_REGISTRY);
        return this.onERC721Received.selector;
    }

    /// @notice Deploy a new vault.
    /// @param vaultTokens ERC20 tokens under vault management
    /// @param options Abi encoded uint256 - an nfts of the gateway subvault. It is required that nft subvault is approved by the caller to this address and that it is a gateway vault
    /// @return vault Address of the new vault
    /// @return nft Nft of the vault in the vault registry
    function deployVault(
        address[] memory vaultTokens,
        bytes memory options,
        address
    ) public override(VaultGovernance, IVaultGovernance) returns (IVault vault, uint256 nft) {
        (uint256 subvaultNft, string memory name, string memory symbol) = abi.decode(
            options,
            (uint256, string, string)
        );
        (vault, nft) = super.deployVault(vaultTokens, abi.encode(name, symbol), msg.sender);
        IVaultRegistry registry = _internalParams.registry;
        ILpIssuer(address(vault)).addSubvault(subvaultNft);
        registry.safeTransferFrom(msg.sender, address(vault), subvaultNft);
    }

    /// @notice Emitted when new DelayedProtocolPerVaultParams are staged for commit
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params that were staged for commit
    /// @param when When the params could be committed
    event StageDelayedProtocolPerVaultParams(
        address indexed origin,
        address indexed sender,
        uint256 indexed nft,
        DelayedProtocolPerVaultParams params,
        uint256 when
    );

    /// @notice Emitted when new DelayedProtocolPerVaultParams are committed
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params that are committed
    event CommitDelayedProtocolPerVaultParams(
        address indexed origin,
        address indexed sender,
        uint256 indexed nft,
        DelayedProtocolPerVaultParams params
    );

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

    /// @notice Emitted when new StrategyParams are set.
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param params New params that are set
    event SetStrategyParams(address indexed origin, address indexed sender, uint256 indexed nft, StrategyParams params);

    /// @notice Emitted when new DelayedProtocolParams are staged for commit
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param params New params that were staged for commit
    /// @param when When the params could be committed
    event StageDelayedProtocolParams(
        address indexed origin,
        address indexed sender,
        DelayedProtocolParams params,
        uint256 when
    );

    /// @notice Emitted when new DelayedProtocolParams are committed
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param params New params that are committed
    event CommitDelayedProtocolParams(address indexed origin, address indexed sender, DelayedProtocolParams params);
}
