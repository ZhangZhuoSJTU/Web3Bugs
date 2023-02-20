// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

/// @title interface for putting a rate limit on how fast a contract can perform an action, e.g. Minting
/// @author Fei Protocol
interface IMultiRateLimited {
    // ----------- Events -----------

    /// @notice emitted when a buffer is eaten into
    event IndividualBufferUsed(
        address rateLimitedAddress,
        uint256 amountUsed,
        uint256 bufferRemaining
    );

    /// @notice emitted when rate limit is updated
    event IndividualRateLimitPerSecondUpdate(
        address rateLimitedAddress,
        uint256 oldRateLimitPerSecond,
        uint256 newRateLimitPerSecond
    );

    /// @notice emitted when the non gov buffer cap max is updated
    event MultiBufferCapUpdate(uint256 oldBufferCap, uint256 newBufferCap);

    /// @notice emitted when the non gov buffer rate limit per second max is updated
    event MultiMaxRateLimitPerSecondUpdate(
        uint256 oldMaxRateLimitPerSecond,
        uint256 newMaxRateLimitPerSecond
    );

    // ----------- View API -----------

    /// @notice the rate per second for each address
    function getRateLimitPerSecond(address) external view returns (uint256);

    /// @notice the last time the buffer was used by each address
    function getLastBufferUsedTime(address) external view returns (uint256);

    /// @notice the cap of the buffer that can be used at once
    function getBufferCap(address) external view returns (uint256);

    /// @notice the amount of action that can be used before hitting limit
    /// @dev replenishes at rateLimitPerSecond per second up to bufferCap
    function individualBuffer(address) external view returns (uint112);

    // ----------- Governance State Changing API -----------

    /// @notice update the non gov max rate limit per second
    function updateMaxRateLimitPerSecond(uint256 newMaxRateLimitPerSecond)
        external;

    /// @notice update the non gov max buffer cap
    function updateMaxBufferCap(uint256 newBufferCap) external;

    /// @notice add an authorized contract, its per second replenishment and buffer set to the non governor caps
    function addAddressWithCaps(address) external;

    /// @notice add an authorized contract, its per second replenishment and buffer
    function addAddress(
        address,
        uint112,
        uint112
    ) external;

    /// @notice update an authorized contract
    function updateAddress(
        address,
        uint112,
        uint112
    ) external;

    /// @notice remove an authorized contract
    function removeAddress(address) external;
}
