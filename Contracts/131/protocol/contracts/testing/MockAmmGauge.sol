// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../Controller.sol";
import "../tokenomics/AmmGauge.sol";

contract MockAmmGauge is AmmGauge {
    constructor(IController _controller, address _ammToken) AmmGauge(_controller, _ammToken) {}

    function stake(uint256) external override returns (bool) {
        return true;
    }

    function unstake(uint256) external override returns (bool) {
        return true;
    }

    // solhint-disable-next-line no-unused-vars
    function claimableRewards(address user) external view override returns (uint256) {
        return 0;
    }

    function claimRewards(address) external pure override returns (uint256) {
        return 0;
    }

    function poolCheckpoint() public pure override returns (bool) {
        return true;
    }
}
