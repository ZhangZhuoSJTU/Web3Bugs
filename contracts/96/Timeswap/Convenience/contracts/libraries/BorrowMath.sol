// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {Math} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/Math.sol';
import {SquareRoot} from './SquareRoot.sol';
import {FullMath} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/FullMath.sol';
import {ConstantProduct} from './ConstantProduct.sol';
import {SafeCast} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/SafeCast.sol';

library BorrowMath {
    using Math for uint256;
    using SquareRoot for uint256;
    using FullMath for uint256;
    using ConstantProduct for IPair;
    using ConstantProduct for ConstantProduct.CP;
    using SafeCast for uint256;

    uint256 private constant BASE = 0x10000000000;

    function givenDebt(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint112 debtIn
    )
        internal
        view
        returns (
            uint112 xDecrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        ConstantProduct.CP memory cp = pair.get(maturity);

        xDecrease = getX(pair, maturity, assetOut);

        uint256 xReserve = cp.x;
        xReserve -= xDecrease;

        uint256 _yIncrease = debtIn;
        _yIncrease -= xDecrease;
        _yIncrease <<= 32;
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        _yIncrease /= denominator;
        yIncrease = _yIncrease.toUint112();

        uint256 yReserve = cp.y;
        yReserve += _yIncrease;

        uint256 zReserve = cp.x;
        zReserve *= cp.y;
        denominator = xReserve;
        denominator *= yReserve;
        zReserve = zReserve.mulDivUp(cp.z, denominator);

        uint256 _zIncrease = zReserve;
        _zIncrease -= cp.z;
        zIncrease = _zIncrease.toUint112();
    }

    function givenCollateral(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint112 collateralIn
    )
        internal
        view
        returns (
            uint112 xDecrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        ConstantProduct.CP memory cp = pair.get(maturity);

        xDecrease = getX(pair, maturity, assetOut);

        uint256 xReserve = cp.x;
        xReserve -= xDecrease;

        uint256 _zIncrease = collateralIn;
        _zIncrease = xReserve;
        uint256 subtrahend = cp.z;
        subtrahend *= xDecrease;
        _zIncrease -= subtrahend;
        _zIncrease <<= 25;
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator *= xReserve;
        _zIncrease /= denominator;
        zIncrease = _zIncrease.toUint112();

        uint256 zReserve = cp.z;
        zReserve += _zIncrease;

        uint256 yReserve = cp.x;
        yReserve *= cp.z;
        denominator = xReserve;
        denominator *= zReserve;
        yReserve = yReserve.mulDivUp(cp.y, denominator);

        uint256 _yIncrease = yReserve;
        _yIncrease -= cp.y;
        yIncrease = _yIncrease.toUint112();
    }

    function givenPercent(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint40 percent
    )
        internal
        view
        returns (
            uint112 xDecrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        ConstantProduct.CP memory cp = pair.get(maturity);

        xDecrease = getX(pair, maturity, assetOut);

        uint256 xReserve = cp.x;
        xReserve -= xDecrease;

        if (percent <= 0x80000000) {
            uint256 yMid = cp.y;
            yMid *= cp.y;
            yMid = yMid.mulDivUp(cp.x, xReserve);
            yMid = yMid.sqrtUp();
            yMid -= cp.y;

            uint256 _yIncrease = yMid;
            _yIncrease *= percent;
            _yIncrease = _yIncrease.shiftRightUp(31);
            yIncrease = _yIncrease.toUint112();

            uint256 yReserve = cp.y;
            yReserve += _yIncrease;

            uint256 zReserve = cp.x;
            zReserve *= cp.y;
            uint256 denominator = xReserve;
            denominator *= yReserve;
            zReserve = zReserve.mulDivUp(cp.z, denominator);

            uint256 _zIncrease = zReserve;
            _zIncrease -= cp.z;
            zIncrease = _zIncrease.toUint112();
        } else {
            percent = 0x100000000 - percent;

            uint256 zMid = cp.z;
            zMid *= cp.z;
            zMid = zMid.mulDivUp(cp.x, xReserve);
            zMid = zMid.sqrtUp();
            zMid -= cp.z;

            uint256 _zIncrease = zMid;
            _zIncrease *= percent;
            _zIncrease = _zIncrease.shiftRightUp(31);
            zIncrease = _zIncrease.toUint112();

            uint256 zReserve = cp.z;
            zReserve += _zIncrease;

            uint256 yReserve = cp.x;
            yReserve *= cp.z;
            uint256 denominator = xReserve;
            denominator *= zReserve;
            yReserve = yReserve.mulDivUp(cp.y, denominator);

            uint256 _yIncrease = yReserve;
            _yIncrease -= cp.y;
            yIncrease = _yIncrease.toUint112();
        }
    }

    function getX(
        IPair pair,
        uint256 maturity,
        uint112 assetOut
    ) private view returns (uint112 xDecrease) {
        // uint256 duration = maturity;
        // duration -= block.timestamp;

        uint256 totalFee = pair.fee();
        totalFee += pair.protocolFee();

        uint256 numerator = maturity;
        numerator -= block.timestamp;
        numerator *= totalFee;
        numerator += BASE;

        uint256 _xDecrease = assetOut;
        _xDecrease *= numerator;
        _xDecrease = _xDecrease.divUp(BASE);
        xDecrease = _xDecrease.toUint112();

        // uint256 numerator = duration;
        // numerator *= pair.fee();
        // numerator += BASE;

        // uint256 _xDecrease = assetOut;
        // _xDecrease *= numerator;
        // _xDecrease = _xDecrease.divUp(BASE);

        // numerator = duration;
        // numerator *= pair.protocolFee();
        // numerator += BASE;

        // _xDecrease *= numerator;
        // _xDecrease = _xDecrease.divUp(BASE);
        // xDecrease = _xDecrease.toUint112();
    }
}
