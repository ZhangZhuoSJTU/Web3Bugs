// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IVerifier {
    /**
     * @notice emitted when a user is registered
     * @param user address of user registered
     * @param isMasterLinked if true, master address is also considered to be linked to itself
     * @param metadata any metadata related to registered user
     */
    event UserRegistered(address user, bool isMasterLinked, string metadata);

    /**
     * @notice emitted when a user is unregistered
     * @param user address of the user unregistered
     */
    event UserUnregistered(address user);
}
