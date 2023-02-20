// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IERC20 } from '../interfaces/IERC20.sol';

contract TokenSwapper {
    address tokenA;
    address tokenB;

    constructor(address tokenA_, address tokenB_) {
        tokenA = tokenA_;
        tokenB = tokenB_;
    }

    function swap(
        address tokenAddress,
        uint256 amount,
        address toTokenAddress,
        address recipient
    ) external returns (uint256 convertedAmount) {
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);

        if (tokenAddress == tokenA) {
            require(toTokenAddress == tokenB, 'WRONG TOKEN PAIR');
            convertedAmount = amount * 2;
        } else {
            require(tokenAddress == tokenB && toTokenAddress == tokenA, 'WRONG TOKEN PAIR');
            convertedAmount = amount / 2;
        }

        IERC20(toTokenAddress).transfer(recipient, convertedAmount);
    }
}
