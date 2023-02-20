// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IConverter {
    /* ========== FUNCTIONS ========== */

    function convert(bytes32[] calldata proof, uint256 amount, uint256 minVader)
        external
        returns (uint256 vaderReceived);

    /* ========== EVENTS ========== */

    event Conversion(
        address indexed user,
        uint256 vetherAmount,
        uint256 vaderAmount
    );
}
