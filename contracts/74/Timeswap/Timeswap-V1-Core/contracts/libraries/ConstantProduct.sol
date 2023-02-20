// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '../interfaces/IPair.sol';
import {FullMath} from './FullMath.sol';

library ConstantProduct {
    using FullMath for uint256;

    function checkConstantProduct(
        IPair.State memory state,
        uint112 xReserve,
        uint128 yAdjusted,
        uint128 zAdjusted
    ) internal pure {
        (uint256 prod0, uint256 prod1) = (uint256(yAdjusted) * zAdjusted).mul512(xReserve);
        (uint256 _prod0, uint256 _prod1) = ((uint256(state.y) * state.z) << 32).mul512(state.x);

        require(prod1 >= _prod1, 'E301');
        if (prod1 == _prod1) require(prod0 >= _prod0, 'E301');
    }
}
