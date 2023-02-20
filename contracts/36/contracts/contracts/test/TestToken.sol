pragma solidity =0.8.7;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) public {

    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}