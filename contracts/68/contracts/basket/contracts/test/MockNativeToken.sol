// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MockToken.sol";

contract MockNativeToken is MockToken {
    constructor(string memory _name, string memory _symbol)
        MockToken(_name, _symbol)
    {}

    fallback() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        _burn(msg.sender, wad);
        msg.sender.transfer(wad);
    }
}
