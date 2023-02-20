pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(uint256 supply) ERC20("MockToken", "MTO") {
        _mint(msg.sender, supply);
    }
}
