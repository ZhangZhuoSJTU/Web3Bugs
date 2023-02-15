
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Create a ERC20 token with additional functions in order 
///         to demo the working of vesting contract
contract Token is ERC20{
    address public admin;

    constructor() ERC20("Boot Token", "BOOT") {
        _mint(msg.sender, 10_000_000_000 * (10 ** uint256(decimals())));        // mint 10 B tokens
        admin = msg.sender;
    }

}