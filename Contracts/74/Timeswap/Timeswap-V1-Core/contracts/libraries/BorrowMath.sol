// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '../interfaces/IPair.sol';
import {Math} from './Math.sol';
import {FullMath} from './FullMath.sol';
import {ConstantProduct} from './ConstantProduct.sol';
import {SafeCast} from './SafeCast.sol';


library BorrowMath {
    using Math for uint256;
    using FullMath for uint256;
    using ConstantProduct for IPair.State;
    using SafeCast for uint256;

    function check(
        IPair.State memory state,
        uint112 xDecrease,
        uint112 yIncrease,
        uint112 zIncrease,
        uint16 fee
    ) internal pure {
        uint128 feeBase = 0x10000 - fee;
        uint112 xReserve = state.x - xDecrease;
        uint128 yAdjusted = adjust(state.y, yIncrease, feeBase);
        uint128 zAdjusted = adjust(state.z, zIncrease, feeBase);
        state.checkConstantProduct(xReserve, yAdjusted, zAdjusted);

        uint256 minimum = xDecrease;
        minimum *= state.y;
        minimum <<= 12;
        uint256 denominator = xReserve;
        denominator *= feeBase;
        minimum = minimum.divUp(denominator);
        require(yIncrease >= minimum, 'E302');
    }

    function adjust(
        uint112 reserve,
        uint112 increase,
        uint128 feeBase
    ) private pure returns (uint128 adjusted) {
        adjusted = reserve;
        adjusted <<= 16;
        adjusted += feeBase * increase;
    }

    function getDebt(
        uint256 maturity,
        uint112 xDecrease,
        uint112 yIncrease
    ) internal view returns (uint112 debtIn) {
        uint256 _debtIn = maturity;
        _debtIn -= block.timestamp;
        _debtIn *= yIncrease;
        _debtIn = _debtIn.shiftRightUp(32);
        _debtIn += xDecrease;
        debtIn = _debtIn.toUint112();
    }

    function getCollateral(
        uint256 maturity,
        IPair.State memory state,
        uint112 xDecrease,
        uint112 zIncrease
    ) internal view returns (uint112 collateralIn) {
        uint256 _collateralIn = maturity;
        _collateralIn -= block.timestamp;
        _collateralIn *= zIncrease;
        _collateralIn = _collateralIn.shiftRightUp(25);
        uint256 minimum = state.z;
        minimum *= xDecrease;
        uint256 denominator = state.x;
        denominator -= xDecrease;
        minimum = minimum.divUp(denominator);
        _collateralIn += minimum;
        collateralIn = _collateralIn.toUint112();
    }
}
