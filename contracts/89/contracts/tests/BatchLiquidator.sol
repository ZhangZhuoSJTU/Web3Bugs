// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IClearingHouse, IMarginAccount } from "../Interfaces.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BatchLiquidator is Ownable {
    using SafeERC20 for IERC20;

    IClearingHouse public immutable clearingHouse;
    IMarginAccount public immutable  marginAccount;

    constructor(
        IClearingHouse _clearingHouse,
        IMarginAccount _marginAccount
    ) {
        clearingHouse = _clearingHouse;
        marginAccount = _marginAccount;
    }

    function liquidate(address[] calldata traders) external {
        for (uint i = 0; i < traders.length; i++) {
            clearingHouse.liquidate(traders[i]);
        }
    }

    function liquidateMakers(address[] calldata traders) external {
        for (uint i = 0; i < traders.length; i++) {
            clearingHouse.liquidateMaker(traders[i]);
        }
    }

    function liquidateTakers(address[] calldata traders) external {
        for (uint i = 0; i < traders.length; i++) {
            clearingHouse.liquidateTaker(traders[i]);
        }
    }

    function withdraw(IERC20 token) external {
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }
}
