// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { MarginAccount } from "../MarginAccount.sol";

contract MockMarginAccount is MarginAccount {

    constructor(address _trustedForwarder) MarginAccount(_trustedForwarder) {}

    function setMargin(address trader, uint idx, int amount) external {
        margin[idx][trader] = amount;
    }
}
