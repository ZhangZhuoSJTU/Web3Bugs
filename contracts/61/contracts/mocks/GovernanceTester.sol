// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract GovernanceTester {
    address public gov;
    uint256 public value;

    event valueUpdated(address indexed governance, address indexed sender, uint256 v);

    modifier onlyGov() {
        require(msg.sender == gov, 'Only Governance should be able to hit');
        _;
    }

    constructor(address _gov, uint256 _val) {
        gov = _gov;
        value = _val;
    }

    function update(uint256 _value) public onlyGov {
        value = _value;
        emit valueUpdated(gov, msg.sender, _value);
    }
}
