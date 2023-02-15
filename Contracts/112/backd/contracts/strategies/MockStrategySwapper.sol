// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "./StrategySwapper.sol";

contract MockStrategySwapper is StrategySwapper {
    constructor(address addressProvider_, uint256 slippageTolerance_)
        StrategySwapper(addressProvider_, slippageTolerance_)
    {}

    function overrideSlippageTolerance(uint256 slippageTolerance_) external {
        slippageTolerance = slippageTolerance_;
    }
}
