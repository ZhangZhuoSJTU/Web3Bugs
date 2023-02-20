// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "./ISingleMessageDispatcher.sol";

/**
 * @title MessageExecutor interface
 * @notice MessageExecutor interface of the ERC-5164 standard as defined in the EIP.
 */
interface IMessageExecutor {
    /**
     * @notice Message data structure
     * @param to Address that will be dispatched on the receiving chain
     * @param data Data that will be sent to the `to` address
     */
    struct Message {
        address to;
        bytes data;
    }

    /**
     * @notice Emitted when a message has successfully been executed.
     * @param fromChainId ID of the chain that dispatched the message
     * @param messageId ID uniquely identifying the message that was executed
     */
    event MessageIdExecuted(uint256 indexed fromChainId, bytes32 indexed messageId);

    /**
     * @notice Execute message from the origin chain.
     * @dev Should authenticate that the call has been performed by the bridge transport layer.
     * @dev Must revert if the message fails.
     * @dev Must emit the `ExecutedMessage` event once the message has been executed.
     * @param to Address that will receive `data`
     * @param data Data forwarded to address `to`
     * @param messageId ID uniquely identifying the message
     * @param fromChainId ID of the chain that dispatched the message
     * @param from Address of the sender on the origin chain
     */
    function executeMessage(
        address to,
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) external;

    /**
     * @notice Execute a batch messages from the origin chain.
     * @dev Should authenticate that the call has been performed by the bridge transport layer.
     * @dev Must revert if one of the messages fails.
     * @dev Must emit the `ExecutedMessageBatch` event once messages have been executed.
     * @param messages Array of messages being executed
     * @param messageId ID uniquely identifying the messages
     * @param fromChainId ID of the chain that dispatched the messages
     * @param from Address of the sender on the origin chain
     */
    function executeMessageBatch(
        Message[] calldata messages,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) external;
}
