// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface ISwapQueue {
    /* ========== STRUCTS ========== */

    struct Node {
        uint256 value;
        uint256 previous;
        uint256 next;
    }

    struct Queue {
        mapping(uint256 => Node) linkedList;
        uint256 start;
        uint256 end;
        uint256 size;
    }

    /* ========== FUNCTIONS ========== */
    /* ========== EVENTS ========== */
}
