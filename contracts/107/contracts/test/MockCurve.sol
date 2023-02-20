// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ICurve.sol";

contract MockCurve is ICurve {
    IERC20 internal poolToken;
    IERC20[] internal tokens;

    constructor(IERC20 _poolToken, IERC20[] memory _tokens) {
        poolToken = _poolToken;
        tokens = _tokens;
    }

    function add_liquidity(uint256[4] memory amounts, uint256 minOut) external override {
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            if (amount > 0)
                tokens[i].transferFrom(msg.sender, address(this), amount);
        }

        uint256 balance = poolToken.balanceOf(address(this));
        require(balance >= minOut, "INSUFFICIENT_TOKENS");
        poolToken.transfer(msg.sender, balance);
    }

    function balances(uint256 index) external view override returns (uint256) {
        return tokens[index].balanceOf(address(this));
    }
}
