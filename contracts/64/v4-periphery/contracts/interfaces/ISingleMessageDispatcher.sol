// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

/**
 * @title ERC-5164: Cross-Chain Execution Standard, optional SingleMessageDispatcher extension
 * @dev See https://eips.ethereum.org/EIPS/eip-5164
 */
interface ISingleMessageDispatcher {
    /**
     * @notice Dispatch a message to the receiving chain.
     * @dev Must compute and return an ID uniquely identifying the message.
     * @dev Must emit the `MessageDispatched` event when successfully dispatched.
     * @param toChainId ID of the receiving chain
     * @param to Address on the receiving chain that will receive `data`
     * @param data Data dispatched to the receiving chain
     * @return bytes32 ID uniquely identifying the message
     */
    function dispatchMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    ) external returns (bytes32);
}
