// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {DateTime} from '../libraries/DateTime.sol';

contract DateTimeCallee {
    function timestampToDateTime(uint256 timestamp)
        public
        pure
        returns (
            uint256 year,
            uint256 month,
            uint256 day,
            uint256 hour,
            uint256 minute,
            uint256 second
        )
    {
        return DateTime.timestampToDateTime(timestamp);
    }
}
