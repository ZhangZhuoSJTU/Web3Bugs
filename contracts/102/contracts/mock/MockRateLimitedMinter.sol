// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../volt/minter/RateLimitedMinter.sol";

contract MockRateLimitedMinter is RateLimitedMinter {
    constructor(
        address _core,
        uint256 _feiLimitPerSecond,
        uint256 _mintingBufferCap,
        bool _doPartialMint
    )
        CoreRef(_core)
        RateLimitedMinter(_feiLimitPerSecond, _mintingBufferCap, _doPartialMint)
    {}

    function setDoPartialMint(bool _doPartialMint) public {
        doPartialAction = _doPartialMint;
    }

    function mint(address to, uint256 amount) public {
        _mintVolt(to, amount);
    }
}
