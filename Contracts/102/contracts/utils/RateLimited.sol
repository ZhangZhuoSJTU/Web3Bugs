// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../refs/CoreRef.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title abstract contract for putting a rate limit on how fast a contract can perform an action e.g. Minting
/// @author Fei Protocol
abstract contract RateLimited is CoreRef {
    /// @notice maximum rate limit per second governance can set for this contract
    uint256 public immutable MAX_RATE_LIMIT_PER_SECOND;

    /// @notice the rate per second for this contract
    uint256 public rateLimitPerSecond;

    /// @notice the last time the buffer was used by the contract
    uint256 public lastBufferUsedTime;

    /// @notice the cap of the buffer that can be used at once
    uint256 public bufferCap;

    /// @notice a flag for whether to allow partial actions to complete if the buffer is less than amount
    bool public doPartialAction;

    /// @notice the buffer at the timestamp of lastBufferUsedTime
    uint256 public bufferStored;

    event BufferUsed(uint256 amountUsed, uint256 bufferRemaining);
    event BufferCapUpdate(uint256 oldBufferCap, uint256 newBufferCap);
    event RateLimitPerSecondUpdate(
        uint256 oldRateLimitPerSecond,
        uint256 newRateLimitPerSecond
    );

    constructor(
        uint256 _maxRateLimitPerSecond,
        uint256 _rateLimitPerSecond,
        uint256 _bufferCap,
        bool _doPartialAction
    ) {
        lastBufferUsedTime = block.timestamp;

        _setBufferCap(_bufferCap);
        bufferStored = _bufferCap;

        require(
            _rateLimitPerSecond <= _maxRateLimitPerSecond,
            "RateLimited: rateLimitPerSecond too high"
        );
        _setRateLimitPerSecond(_rateLimitPerSecond);

        MAX_RATE_LIMIT_PER_SECOND = _maxRateLimitPerSecond;
        doPartialAction = _doPartialAction;
    }

    /// @notice set the rate limit per second
    function setRateLimitPerSecond(uint256 newRateLimitPerSecond)
        external
        virtual
        onlyGovernorOrAdmin
    {
        require(
            newRateLimitPerSecond <= MAX_RATE_LIMIT_PER_SECOND,
            "RateLimited: rateLimitPerSecond too high"
        );
        _updateBufferStored();

        _setRateLimitPerSecond(newRateLimitPerSecond);
    }

    /// @notice set the buffer cap
    function setBufferCap(uint256 newBufferCap)
        external
        virtual
        onlyGovernorOrAdmin
    {
        _setBufferCap(newBufferCap);
    }

    /// @notice the amount of action used before hitting limit
    /// @dev replenishes at rateLimitPerSecond per second up to bufferCap
    function buffer() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastBufferUsedTime;
        return
            Math.min(bufferStored + (rateLimitPerSecond * elapsed), bufferCap);
    }

    /** 
        @notice the method that enforces the rate limit. Decreases buffer by "amount". 
        If buffer is <= amount either
        1. Does a partial mint by the amount remaining in the buffer or
        2. Reverts
        Depending on whether doPartialAction is true or false
    */
    function _depleteBuffer(uint256 amount) internal virtual returns (uint256) {
        uint256 newBuffer = buffer();

        uint256 usedAmount = amount;
        if (doPartialAction && usedAmount > newBuffer) {
            usedAmount = newBuffer;
        }

        require(newBuffer != 0, "RateLimited: no rate limit buffer");
        require(usedAmount <= newBuffer, "RateLimited: rate limit hit");

        bufferStored = newBuffer - usedAmount;

        lastBufferUsedTime = block.timestamp;

        emit BufferUsed(usedAmount, bufferStored);

        return usedAmount;
    }

    /// @notice function to replenish buffer
    /// @param amount to increase buffer by if under buffer cap
    function _replenishBuffer(uint256 amount) internal {
        uint256 newBuffer = buffer();

        uint256 _bufferCap = bufferCap; /// gas opti, save an SLOAD

        /// cannot replenish any further if already at buffer cap
        if (newBuffer == _bufferCap) {
            return;
        }

        /// ensure that bufferStored cannot be gt buffer cap
        bufferStored = Math.min(newBuffer + amount, _bufferCap);
    }

    function _setRateLimitPerSecond(uint256 newRateLimitPerSecond) internal {
        uint256 oldRateLimitPerSecond = rateLimitPerSecond;
        rateLimitPerSecond = newRateLimitPerSecond;

        emit RateLimitPerSecondUpdate(
            oldRateLimitPerSecond,
            newRateLimitPerSecond
        );
    }

    function _setBufferCap(uint256 newBufferCap) internal {
        _updateBufferStored();

        uint256 oldBufferCap = bufferCap;
        bufferCap = newBufferCap;

        emit BufferCapUpdate(oldBufferCap, newBufferCap);
    }

    function _resetBuffer() internal {
        bufferStored = bufferCap;
    }

    function _updateBufferStored() internal {
        bufferStored = buffer();
        lastBufferUsedTime = block.timestamp;
    }
}
