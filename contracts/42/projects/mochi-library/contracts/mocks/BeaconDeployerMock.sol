// SPDX-License-Identifier: AGPL-3.0

/**
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

pragma solidity ^0.8.0;

import "../BeaconProxyDeployer.sol";

contract BeaconDeployerMock {
    address private beacon;
    
    constructor(address beaconAddr) {
        beacon = beaconAddr;
    }
    
    function deploy(string calldata _name) external returns (address addr) {
        bytes memory initCode = abi.encodeWithSelector(
                bytes4(keccak256("initialize(string)")),
                _name
            );

        addr = BeaconProxyDeployer.deploy(beacon, initCode);
    }

    function deployCalculate(string calldata _name) external view returns (address addr) {
        bytes memory initCode = abi.encodeWithSelector(
                bytes4(keccak256("initialize(string)")),
                _name
            );

        addr = BeaconProxyDeployer.calculateAddress(address(this), beacon, initCode);
    }
}
