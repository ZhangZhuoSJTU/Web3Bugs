// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../../libraries/OverflowSafeComparatorLib.sol";

contract OverflowSafeComparatorLibHarness {
    using OverflowSafeComparatorLib for uint32;

    function ltHarness(
        uint32 _a,
        uint32 _b,
        uint32 _timestamp
    ) external pure returns (bool) {
        return _a.lt(_b, _timestamp);
    }

    function lteHarness(
        uint32 _a,
        uint32 _b,
        uint32 _timestamp
    ) external pure returns (bool) {
        return _a.lte(_b, _timestamp);
    }

    function checkedSub(
        uint256 _a,
        uint256 _b,
        uint256 _timestamp
    ) external pure returns (uint32) {
        return uint32(_a).checkedSub(uint32(_b), uint32(_timestamp));
    }
}
