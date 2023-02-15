// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface Hevm {
    // Sets block timestamp to `x`
    function warp(uint256 x) external view;

    // Sets slot `loc` of contract `c` to value `val`
    function store(
        address c,
        bytes32 loc,
        bytes32 val
    ) external view;

    // Reads the slot `loc` of contract `c`
    function load(address c, bytes32 loc) external view returns (bytes32 val);

    // Generates address derived from private key `sk`
    function addr(uint256 sk) external view returns (address _addr);

    // Signs `digest` with private key `sk` (WARNING: this is insecure as it leaks the private key)
    function sign(uint256 sk, bytes32 digest)
        external
        view
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        );
}
