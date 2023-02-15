// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DAI is ERC20 {
    constructor() ERC20("", "DAI") {}

    function mint(uint256 amount, address to) external {
        _mint(to, amount);
    }
}
