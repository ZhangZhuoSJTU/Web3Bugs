// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "./trader/interfaces/ITrader.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./interfaces/IERC20VaultGovernance.sol";
import "./VaultGovernance.sol";

/// @notice Governance that manages all ERC20 Vaults params and can deploy a new ERC20 Vault.
contract ERC20VaultGovernance is IERC20VaultGovernance, VaultGovernance {
    /// @notice Creates a new contract.
    /// @param internalParams_ Initial Internal Params
    /// @param delayedProtocolParams_ Initial Protocol Params
    constructor(InternalParams memory internalParams_, DelayedProtocolParams memory delayedProtocolParams_)
        VaultGovernance(internalParams_)
    {
        _delayedProtocolParams = abi.encode(delayedProtocolParams_);
    }

    /// @inheritdoc IERC20VaultGovernance
    function delayedProtocolParams() public view returns (DelayedProtocolParams memory) {
        if (_delayedProtocolParams.length == 0) return DelayedProtocolParams({trader: ITrader(address(0))});

        return abi.decode(_delayedProtocolParams, (DelayedProtocolParams));
    }

    /// @inheritdoc IERC20VaultGovernance
    function stagedDelayedProtocolParams() external view returns (DelayedProtocolParams memory) {
        if (_stagedDelayedProtocolParams.length == 0) return DelayedProtocolParams({trader: ITrader(address(0))});

        return abi.decode(_stagedDelayedProtocolParams, (DelayedProtocolParams));
    }

    /// @inheritdoc IERC20VaultGovernance
    function stageDelayedProtocolParams(DelayedProtocolParams calldata params) external {
        _stageDelayedProtocolParams(abi.encode(params));
        emit StageDelayedProtocolParams(tx.origin, msg.sender, params, _delayedProtocolParamsTimestamp);
    }

    /// @inheritdoc IERC20VaultGovernance
    function commitDelayedProtocolParams() external {
        _commitDelayedProtocolParams();
        emit CommitDelayedProtocolParams(
            tx.origin,
            msg.sender,
            abi.decode(_delayedProtocolParams, (DelayedProtocolParams))
        );
    }

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
