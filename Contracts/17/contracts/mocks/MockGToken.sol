// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IToken.sol";

abstract contract MockGToken is ERC20, Ownable, IToken {
    function mint(
        address account,
        uint256 factor,
        uint256 amount
    ) external override {
        factor;
        require(account != address(0), "Account is empty.");
        require(amount > 0, "amount is less than zero.");
        _mint(account, amount);
    }

    function burn(
        address account,
        uint256 factor,
        uint256 amount
    ) external override {
        factor;
        require(account != address(0), "Account is empty.");
        require(amount > 0, "amount is less than zero.");
        _burn(account, amount);
    }

    function factor() external view override returns (uint256) {}

    function factor(uint256 totalAssets) external view override returns (uint256) {
        totalAssets;
    }

    function burnAll(address account) external override {
        _burn(account, balanceOf(account));
    }

    function totalAssets() external view override returns (uint256) {
        return totalSupply();
    }

    function getPricePerShare() external view override returns (uint256) {}

    function getShareAssets(uint256 shares) external view override returns (uint256) {
        return shares;
    }

    function getAssets(address account) external view override returns (uint256) {
        return balanceOf(account);
    }
}
