// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Mochi is ERC20 {
    constructor() ERC20("Mochi", "MOCHI") {
        _mint(msg.sender, 1000000000000e18);
    }
}
