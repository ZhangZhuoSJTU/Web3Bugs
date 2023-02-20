// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../../libraries/ExtendedSafeCastLib.sol";

contract ExtendedSafeCastLibHarness {
    using ExtendedSafeCastLib for uint256;

    function toUint104(uint256 value) external pure returns (uint104) {
        return value.toUint104();
    }

    function toUint208(uint256 value) external pure returns (uint208) {
        return value.toUint208();
    }

    function toUint224(uint256 value) external pure returns (uint224) {
        return value.toUint224();
    }
}
