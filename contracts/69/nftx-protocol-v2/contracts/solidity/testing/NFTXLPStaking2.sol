// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../NFTXLPStaking.sol";

contract NFTXLPStaking2 is NFTXLPStaking {
    function sum(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b;
    }
}
