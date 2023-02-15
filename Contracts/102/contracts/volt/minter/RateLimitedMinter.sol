// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../../utils/RateLimited.sol";

/// @title abstract contract for putting a rate limit on how fast a contract can mint FEI
/// @author Fei Protocol
abstract contract RateLimitedMinter is RateLimited {
    uint256 private constant MAX_FEI_LIMIT_PER_SECOND = 10_000e18; // 10000 volt/s or ~860m volt/day

    constructor(
        uint256 _feiLimitPerSecond,
        uint256 _mintingBufferCap,
        bool _doPartialMint
    )
        RateLimited(
            MAX_FEI_LIMIT_PER_SECOND,
            _feiLimitPerSecond,
            _mintingBufferCap,
            _doPartialMint
        )
    {}

    /// @notice override the FEI minting behavior to enforce a rate limit
    function _mintVolt(address to, uint256 amount) internal virtual override {
        uint256 mintAmount = _depleteBuffer(amount);
        super._mintVolt(to, mintAmount);
    }
}
