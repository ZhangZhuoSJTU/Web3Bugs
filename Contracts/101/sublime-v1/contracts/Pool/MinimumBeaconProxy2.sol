// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/proxy/IBeacon.sol';

contract MinimumBeaconProxy {
    address private immutable beacon;

    constructor(address _beacon) {
        require(_beacon != address(0), 'MBP2:C1');
        beacon = _beacon;
    }

    function _implementation() internal view virtual returns (address) {
        return IBeacon(beacon).implementation();
    }

    fallback() external {
        address impl = _implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
