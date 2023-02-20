// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ILiFi {
    /* ========== Structs ========== */

    struct LiFiData {
        bytes32 transactionId;
        string integrator;
        address referrer;
        address sendingAssetId;
        address receivingAssetId;
        address receiver;
        uint256 destinationChainId;
        uint256 amount;
    }

    /* ========== Events ========== */

    event LiFiTransferStarted(
        bytes32 indexed transactionId,
        string integrator,
        address referrer,
        address sendingAssetId,
        address receivingAssetId,
        address receiver,
        uint256 amount,
        uint256 destinationChainId,
        uint256 timestamp
    );

    event LiFiTransferCompleted(
        bytes32 indexed transactionId,
        address receivingAssetId,
        address receiver,
        uint256 amount,
        uint256 timestamp
    );

    event LiFiTransferConfirmed(
        bytes32 indexed transactionId,
        string integrator,
        address referrer,
        address sendingAssetId,
        address receivingAssetId,
        address receiver,
        uint256 amount,
        uint256 destinationChainId,
        uint256 timestamp
    );
    event LiFiTransferRefunded(
        bytes32 indexed transactionId,
        string integrator,
        address referrer,
        address sendingAssetId,
        address receivingAssetId,
        address receiver,
        uint256 amount,
        uint256 destinationChainId,
        uint256 timestamp
    );
    event Inited(address indexed bridge, uint64 chainId);
}
