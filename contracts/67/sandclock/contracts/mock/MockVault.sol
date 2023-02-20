// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Vault} from "../Vault.sol";

contract MockVault is Vault {
    constructor(
        IERC20 _underlying,
        uint256 _minLockPeriod,
        uint256 _investPerc
    ) Vault(_underlying, _minLockPeriod, _investPerc, msg.sender) {}
}
