// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract MockERC20 is ERC20, Ownable {
    function mint(address account, uint256 amount) external onlyOwner {
        require(account != address(0), "Account is empty.");
        require(amount > 0, "amount is less than zero.");
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        require(account != address(0), "Account is empty.");
        require(amount > 0, "amount is less than zero.");
        _burn(account, amount);
    }
}
