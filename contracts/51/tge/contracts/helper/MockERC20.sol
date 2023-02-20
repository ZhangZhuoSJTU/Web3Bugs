// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Generic ERC20 token
 * @notice This contract simulates a generic ERC20 token that is mintable and burnable.
 */
contract MockERC20 is ERC20, Ownable {
    /**
     * @notice Deploy this contract with given name, symbol, and decimals
     * @dev the caller of this constructor will become the owner of this contract
     * @param name_ name of this token
     * @param symbol_ symbol of this token
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
    }

    /**
     * @notice Mints given amount of tokens to recipient
     * @dev only owner can call this mint function
     * @param recipient address of account to receive the tokens
     * @param amount amount of tokens to mint
     */
    function mint(address recipient, uint256 amount) external onlyOwner {
        require(amount != 0, "amount == 0");
        _mint(recipient, amount);
    }
}
