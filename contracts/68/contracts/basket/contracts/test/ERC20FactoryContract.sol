// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "./MockToken.sol";

contract ERC20FactoryContract {
    event TokenCreated(address tokenAddress);

    function deployNewToken(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _issuer
    ) public returns (address) {
        MockToken t = new MockToken(_name, _symbol);
        t.mint(_totalSupply, _issuer);
        emit TokenCreated(address(t));
    }
}
