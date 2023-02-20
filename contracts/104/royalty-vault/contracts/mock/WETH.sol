// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
    constructor() ERC20("Wrapped Eth", "WETH") {
        _mint(msg.sender, 10000000 * 10**decimals());
    }
}
