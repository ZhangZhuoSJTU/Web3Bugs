// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "../AccountAccessController.sol";

contract MockAccountAccessController is AccountAccessController {
    constructor() {}

    function getAllowedAccountsIndex() external view returns (uint16) {
        return _allowedAccountsIndex;
    }

    function getBlockedAccountsIndex() external view returns (uint16) {
        return _blockedAccountsIndex;
    }
}
