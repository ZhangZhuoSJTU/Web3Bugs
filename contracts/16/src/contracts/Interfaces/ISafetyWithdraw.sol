//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

interface ISafetyWithdraw {
    function withdrawERC20Token(
        address tokenAddress,
        address to,
        uint256 amount
    ) external;
}
