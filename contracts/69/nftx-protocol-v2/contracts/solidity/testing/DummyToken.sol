// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract DummyToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }
}
