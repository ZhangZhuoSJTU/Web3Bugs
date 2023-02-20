//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../lib/LibPerpetuals.sol";
import "../lib/LibPrices.sol";

interface Types {
    struct SignedLimitOrder {
        Perpetuals.Order order;
        bytes32 sigR;
        bytes32 sigS;
        uint8 sigV;
    }
}
