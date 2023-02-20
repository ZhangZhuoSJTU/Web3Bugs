// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.2;

import "../libraries/TridentMath.sol";

contract TridentMathConsumerMock {
    function sqrt(uint256 x) public pure returns (uint256) {
        return TridentMath.sqrt(x);
    }
}
