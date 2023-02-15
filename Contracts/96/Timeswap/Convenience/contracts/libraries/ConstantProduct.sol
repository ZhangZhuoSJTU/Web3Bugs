// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';

library ConstantProduct {
    struct CP {
        uint112 x;
        uint112 y;
        uint112 z;
    }

    function get(IPair pair, uint256 maturity) internal view returns (CP memory cp) {
        (uint112 x, uint112 y, uint112 z) = pair.constantProduct(maturity);
        cp = CP(x, y, z);
    }
}
