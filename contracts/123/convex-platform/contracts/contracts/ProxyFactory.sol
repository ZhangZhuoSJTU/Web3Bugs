// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * @title  ProxyFactory
 * @author Optionality
 * @notice Simply clones a smart contract at a given address
 * @dev    Original code https://github.com/optionality/clone-factory/blob/master/contracts/CloneFactory.sol
 */
contract ProxyFactory {
    function clone(address target) external returns (address result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let clone := mload(0x40)
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            mstore(add(clone, 0x14), targetBytes)
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            result := create(0, clone, 0x37)
        }
    }
}
