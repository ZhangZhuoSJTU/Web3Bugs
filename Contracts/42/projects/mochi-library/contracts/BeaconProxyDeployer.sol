// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "./Create2BeaconMaker.sol";
library BeaconProxyDeployer {
    function deploy(address beacon, bytes memory initializationCalldata)
        internal
        returns (address result)
    {
        bytes memory createCode =
            abi.encodePacked(
                type(Create2BeaconMaker).creationCode,
                abi.encode(address(beacon), initializationCalldata)
            );
        bytes32 salt = bytes32(0);

        // solhint-disable-next-line no-inline-assembly
        assembly {
            let encoded_data := add(0x20, createCode) // load initialization code.
            let encoded_size := mload(createCode) // load the init code's length.
            result := create2(
                // call `CREATE2` w/ 4 arguments.
                0, // forward any supplied endowment.
                encoded_data, // pass in initialization code.
                encoded_size, // pass in init code's length.
                salt // pass in the salt value.
            )

            // pass along failure message from failed contract deployment and revert.
            if iszero(result) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    function calculateAddress(
        address deployer,
        address beacon,
        bytes memory initializationCalldata
    ) internal view returns (address addr) {
        bytes memory createCode =
            abi.encodePacked(
                type(Create2BeaconMaker).creationCode,
                abi.encode(address(beacon), initializationCalldata)
            );

        bytes32 salt = bytes32(0);
        // get the keccak256 hash of the init code for address derivation.
        bytes32 initCodeHash = keccak256(createCode);
        addr = address( // derive the target deployment address.
            uint160( // downcast to match the address type.
                uint256( // cast to uint to truncate upper digits.
                    keccak256( // compute CREATE2 hash using 4 inputs.
                        abi.encodePacked( // pack all inputs to the hash together.
                            bytes1(0xff), // pass in the control character.
                            deployer, // pass in the address of this contract.
                            salt, // pass in the salt from above.
                            initCodeHash // pass in hash of contract creation code.
                        )
                    )
                )
            )
        );
    }
}
