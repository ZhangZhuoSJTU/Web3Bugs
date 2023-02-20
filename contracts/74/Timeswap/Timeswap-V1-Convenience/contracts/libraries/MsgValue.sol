// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {ETH} from './ETH.sol';
import {SafeCast} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/SafeCast.sol';

library MsgValue {
    using SafeCast for uint256;

    function getUint112() internal returns (uint112 value) {
        value = msg.value.truncateUint112();
        if (msg.value > value) ETH.transfer(payable(msg.sender), msg.value - value);
    }
}
