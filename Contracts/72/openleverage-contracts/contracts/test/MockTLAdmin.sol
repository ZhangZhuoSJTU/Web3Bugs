// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;



contract MockTLAdmin {
    address public admin;
    uint public decimal;
    constructor (address _admin) {
        admin = _admin;
    }

    function changeDecimal(uint _decimal) public {
        require(msg.sender == admin, 'sender is not admin');
        decimal = _decimal;
    }
}
