// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "./../utils/GlobalRateLimitedMinter.sol";

contract MockMinter {
    GlobalRateLimitedMinter globalRateLimitedMinter;

    constructor(GlobalRateLimitedMinter _globalRateLimitedMinter) {
        globalRateLimitedMinter = _globalRateLimitedMinter;
    }

    function mintFei(address to, uint256 amount) external {
        globalRateLimitedMinter.mintVolt(to, amount);
    }

    function mintAllFei(address to) external {
        globalRateLimitedMinter.mintMaxAllowableVolt(to);
    }
}
