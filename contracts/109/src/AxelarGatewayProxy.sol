// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGateway } from './interfaces/IAxelarGateway.sol';

import { EternalStorage } from './EternalStorage.sol';

contract AxelarGatewayProxy is EternalStorage {
    error SetupFailed();

    /// @dev Storage slot with the address of the current factory. `keccak256('eip1967.proxy.implementation') - 1`.
    bytes32 internal constant KEY_IMPLEMENTATION =
        bytes32(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc);

    constructor(address gatewayImplementation, bytes memory params) {
        _setAddress(KEY_IMPLEMENTATION, gatewayImplementation);

        (bool success, ) = gatewayImplementation.delegatecall(
            abi.encodeWithSelector(IAxelarGateway.setup.selector, params)
        );

        if (!success) revert SetupFailed();
    }

    function setup(bytes calldata params) external {}

    fallback() external payable {
        address implementation = getAddress(KEY_IMPLEMENTATION);

        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

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

    receive() external payable {
        revert('NO_ETHER');
    }
}
