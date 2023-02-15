// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {SafeCast} from './SafeCast.sol';

library BlockNumber {
    using SafeCast for uint256;

    function get() internal view returns (uint32 blockNumber) {
        blockNumber = block.number.modUint32();
    }
}