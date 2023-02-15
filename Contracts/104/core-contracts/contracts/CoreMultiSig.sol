//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {MultiSigWallet} from "./MultiSigWallet.sol";

contract CoreMultiSig is MultiSigWallet {
    using SafeERC20 for IERC20;

    constructor(address[] memory _owners, uint256 _required)
        MultiSigWallet(_owners, _required)
    {}

    function withdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyWallet {
        require(IERC20(token).balanceOf(address(this)) >= amount);
        IERC20(token).safeTransfer(to, amount);
    }
}
