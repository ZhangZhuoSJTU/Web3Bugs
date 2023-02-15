// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/tokenomics/IKeeperGauge.sol";

import "../tokenomics/InflationManager.sol";

contract MockInflationManager is InflationManager {
    constructor(IAddressProvider addressProvider) InflationManager(addressProvider) {}

    function callKillKeeperGauge(address _keeperGauge) external {
        IKeeperGauge(_keeperGauge).kill();
    }
}
