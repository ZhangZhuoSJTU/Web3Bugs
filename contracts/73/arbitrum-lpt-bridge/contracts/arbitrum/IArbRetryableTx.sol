// SPDX-License-Identifier: Apache-2.0

/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

pragma solidity ^0.8.0;

/**
 * @title precompiled contract in every Arbitrum chain for retryable transaction related data retrieval and interactions. Exists at 0x000000000000000000000000000000000000006E
 */
interface ArbRetryableTx {
    /**
    * @notice Redeem a redeemable tx.
    * Revert if called by an L2 contract, or if txId does not exist, or if txId reverts.
    * If this returns, txId has been completed and is no longer available for redemption.
    * If this reverts, txId is still available for redemption (until it times out or is canceled).
    @param txId unique identifier of retryable message: keccak256(keccak256(ArbchainId, inbox-sequence-number), uint(0) )
     */
    function redeem(bytes32 txId) external;

    /**
     * @notice Return the minimum lifetime of redeemable txn.
     * @return lifetime in seconds
     */
    function getLifetime() external view returns (uint256);

    /**
     * @notice Return the timestamp when ticketId will age out, or zero if ticketId does not exist.
     * The timestamp could be in the past, because aged-out tickets might not be discarded immediately.
     * @param ticketId unique ticket identifier
     * @return timestamp for ticket's deadline
     */
    function getTimeout(bytes32 ticketId) external view returns (uint256);

    /**
     * @notice Return the price, in wei, of submitting a new retryable tx with a given calldata size.
     * @param calldataSize call data size to get price of (in wei)
     * @return (price, nextUpdateTimestamp). Price is guaranteed not to change until nextUpdateTimestamp.
     */
    function getSubmissionPrice(uint256 calldataSize)
        external
        view
        returns (uint256, uint256);

    /**
     * @notice Return the price, in wei, of extending the lifetime of ticketId by an additional lifetime period. Revert if ticketId doesn't exist.
     * @param ticketId unique ticket identifier
     * @return (price, nextUpdateTimestamp). Price is guaranteed not to change until nextUpdateTimestamp.
     */
    function getKeepalivePrice(bytes32 ticketId)
        external
        view
        returns (uint256, uint256);

    /** 
    @notice Deposits callvalue into the sender's L2 account, then adds one lifetime period to the life of ticketId.
    * If successful, emits LifetimeExtended event.
    * Revert if ticketId does not exist, or if the timeout of ticketId is already at least one lifetime period in the future, or if the sender has insufficient funds (after the deposit).
    * @param ticketId unique ticket identifier
    * @return New timeout of ticketId.
    */
    function keepalive(bytes32 ticketId) external payable returns (uint256);

    /**
     * @notice Return the beneficiary of ticketId.
     * Revert if ticketId doesn't exist.
     * @param ticketId unique ticket identifier
     * @return address of beneficiary for ticket
     */
    function getBeneficiary(bytes32 ticketId) external view returns (address);

    /**
     * @notice Cancel ticketId and refund its callvalue to its beneficiary.
     * Revert if ticketId doesn't exist, or if called by anyone other than ticketId's beneficiary.
     * @param ticketId unique ticket identifier
     */
    function cancel(bytes32 ticketId) external;

    event TicketCreated(bytes32 indexed ticketId);
    event LifetimeExtended(bytes32 indexed ticketId, uint256 newTimeout);
    event Redeemed(bytes32 indexed ticketId);
    event Canceled(bytes32 indexed ticketId);
}
