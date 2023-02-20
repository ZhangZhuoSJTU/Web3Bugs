// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../Controller.sol";
import "../tokenomics/KeeperGauge.sol";

contract MockKeeperGauge is KeeperGauge {
    constructor(IController _controller, address _pool) KeeperGauge(_controller, _pool) {}

    function advanceEpoch() external override returns (bool) {
        return true;
    }
}
