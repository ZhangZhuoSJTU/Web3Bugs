// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

// Generic address whitelist impl as a merkle tree.
interface IMerkleAddressWhitelist {
    // Checks if address exists in whitelist.
    function exists(address addr, bytes32[] calldata merkleProof)
        external
        returns (bool);
}
