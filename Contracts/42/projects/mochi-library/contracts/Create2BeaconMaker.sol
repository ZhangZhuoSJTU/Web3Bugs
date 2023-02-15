// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

contract Create2BeaconMaker {
    constructor(address beacon, bytes memory initializationCalldata)
        payable
    {
        (, bytes memory returnData) = beacon.staticcall("");
        address template = abi.decode(returnData, (address));
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = template.delegatecall(initializationCalldata);
        if (!success) {
            // pass along failure message from delegatecall and revert.
            // solhint-disable-next-line no-inline-assembly
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }

        // place eip-1167 runtime code in memory.
        bytes memory runtimeCode =
            abi.encodePacked(
                bytes6(0x3d3d3d3d3d73),
                beacon,
                bytes32(0x5afa3d82803e368260203750808036602082515af43d82803e903d91603a57fd),
                bytes2(0x5bf3)
            );

        // return Beacon Minimal Proxy code to write it to spawned contract runtime.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            return(add(0x20, runtimeCode), 60) // Beacon Minimal Proxy runtime code, length
        }
    }
}
