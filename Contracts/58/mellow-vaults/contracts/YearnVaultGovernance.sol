// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./interfaces/IYearnVaultGovernance.sol";
import "./VaultGovernance.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Governance that manages all Aave Vaults params and can deploy a new Aave Vault.
contract YearnVaultGovernance is IYearnVaultGovernance, VaultGovernance {
    mapping(address => address) private _yTokens;

    /// @notice Creates a new contract
    /// @param internalParams_ Initial Internal Params
    /// @param delayedProtocolParams_ Initial Protocol Params
    constructor(InternalParams memory internalParams_, DelayedProtocolParams memory delayedProtocolParams_)
        VaultGovernance(internalParams_)
    {
        _delayedProtocolParams = abi.encode(delayedProtocolParams_);
    }

    /// @inheritdoc IYearnVaultGovernance
    function yTokenForToken(address token) external view returns (address) {
        address yToken = _yTokens[token];
        if (yToken != address(0)) {
            return yToken;
        }
        IYearnVaultRegistry yearnRegistry = delayedProtocolParams().yearnVaultRegistry;
        try yearnRegistry.latestVault(token) returns (address _vault) {
            return _vault;
        } catch (bytes memory) {
            return address(0);
        }
    }

    /// @inheritdoc IYearnVaultGovernance
    function stagedDelayedProtocolParams() external view returns (DelayedProtocolParams memory) {
        if (_stagedDelayedProtocolParams.length == 0) {
            return DelayedProtocolParams({yearnVaultRegistry: IYearnVaultRegistry(address(0))});
        }
        return abi.decode(_stagedDelayedProtocolParams, (DelayedProtocolParams));
    }

    /// @inheritdoc IYearnVaultGovernance
    function delayedProtocolParams() public view returns (DelayedProtocolParams memory) {
        return abi.decode(_delayedProtocolParams, (DelayedProtocolParams));
    }

    /// @inheritdoc IYearnVaultGovernance
    function stageDelayedProtocolParams(DelayedProtocolParams calldata params) external {
        _stageDelayedProtocolParams(abi.encode(params));
        emit StageDelayedProtocolParams(tx.origin, msg.sender, params, _delayedProtocolParamsTimestamp);
    }

    /// @inheritdoc IYearnVaultGovernance
    function commitDelayedProtocolParams() external {
        _commitDelayedProtocolParams();
        emit CommitDelayedProtocolParams(
            tx.origin,
            msg.sender,
            abi.decode(_delayedProtocolParams, (DelayedProtocolParams))
        );
    }

    /// @inheritdoc IYearnVaultGovernance
    function setYTokenForToken(address token, address yToken) external {
        _requireProtocolAdmin();
        _yTokens[token] = yToken;
        emit SetYToken(tx.origin, msg.sender, token, yToken);
    }

    /// @notice Emitted when new yToken is set
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param token ERC-20 token for the yToken
    /// @param yToken yToken for ERC-20 token
    event SetYToken(address indexed origin, address indexed sender, address indexed token, address yToken);

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
