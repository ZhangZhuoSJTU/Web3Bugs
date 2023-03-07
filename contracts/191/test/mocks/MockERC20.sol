// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract MockERC20 is ERC20Upgradeable {
    constructor(string memory _name, string memory _symbol) initializer {
        __ERC20_init(_name, _symbol);
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}
