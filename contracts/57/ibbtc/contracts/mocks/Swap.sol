// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {ISwap} from "../interfaces/ISwap.sol";

contract Swap is ISwap {
    function get_virtual_price() override external view returns (uint) {
        return 1e18;
    }

    function exchange(int128 i, int128 j, uint dx, uint min_dy) override external {}
}
