// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {}

    function mint(uint256 _amount, address _issuer) external {
        _mint(_issuer, _amount);
    }

    function burn(uint256 _amount, address _from) external {
        _burn(_from, _amount);
    }
}
