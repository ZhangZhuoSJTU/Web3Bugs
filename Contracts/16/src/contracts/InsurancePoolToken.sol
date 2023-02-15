// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InsurancePoolToken is ERC20, Ownable, ERC20Burnable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external onlyOwner() {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) public override onlyOwner() {
        // override the burnFrom function and allow only the owner to burn
        // pool tokens on behalf of a holder
        _burn(from, amount);
    }
}
