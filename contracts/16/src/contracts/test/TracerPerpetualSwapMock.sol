//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.0;

import "../lib/LibPerpetuals.sol";

contract TracerPerpetualSwapMock {
    function matchOrders(
        Perpetuals.Order memory order1,
        Perpetuals.Order memory order2,
        uint256 fillAmount
    ) external {}
}
