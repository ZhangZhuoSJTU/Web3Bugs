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

    function givenDebt(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint112 debtIn
    ) internal view returns (uint112 yIncrease, uint112 zIncrease) {
        uint256 feeBase = 0x10000 - pair.fee();

        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 _yIncrease = debtIn;
        _yIncrease -= assetOut;
        _yIncrease <<= 32;
        _yIncrease /= maturity - block.timestamp;
        yIncrease = _yIncrease.toUint112();

        uint256 xAdjust = cp.x;
        xAdjust -= assetOut;

        uint256 yAdjust = cp.y;
        yAdjust <<= 16;
        yAdjust += _yIncrease * feeBase;

        uint256 _zIncrease = cp.x;
        _zIncrease *= cp.y;
        _zIncrease <<= 16;
        uint256 subtrahend = xAdjust;
        subtrahend *= yAdjust;
        _zIncrease -= subtrahend;
        uint256 denominator = xAdjust;
        denominator *= yAdjust;
        denominator *= feeBase;
        _zIncrease = _zIncrease.mulDivUp(uint256(cp.z) << 16, denominator);
        zIncrease = _zIncrease.toUint112();
    }

    function givenCollateral(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint112 collateralIn
    ) internal view returns (uint112 yIncrease, uint112 zIncrease) {
        uint256 feeBase = 0x10000 - pair.fee();

        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 xAdjust = cp.x;
        xAdjust -= assetOut;

        uint256 _zIncrease = collateralIn;
        _zIncrease *= xAdjust;
        uint256 subtrahend = cp.z;
        subtrahend *= assetOut;
        _zIncrease -= subtrahend;
        _zIncrease <<= 25;
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator *= xAdjust;
        _zIncrease /= denominator;
        zIncrease = _zIncrease.toUint112();

        uint256 zAdjust = cp.z;
        zAdjust <<= 16;
        zAdjust += _zIncrease * feeBase;
        uint256 _yIncrease = cp.x;
        _yIncrease *= cp.z;
        _yIncrease <<= 16;
        subtrahend = xAdjust;
        subtrahend *= zAdjust;
        _yIncrease -= subtrahend;
        denominator = xAdjust;
        denominator *= zAdjust;
        denominator *= feeBase;
        _yIncrease = _yIncrease.mulDivUp(uint256(cp.y) << 16, denominator);
        yIncrease = _yIncrease.toUint112();
    }

    function givenPercent(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint40 percent
    ) internal view returns (uint112 yIncrease, uint112 zIncrease) {
        uint256 feeBase = 0x10000 - pair.fee();

        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 xAdjust = cp.x;
        xAdjust -= assetOut;

        if (percent <= 0x80000000) {
            uint256 yMid = cp.y;
            yMid *= cp.y;
            yMid <<= 32;
            uint256 denominator = xAdjust;
            denominator *= feeBase;
            denominator *= feeBase;
            yMid = yMid.mulDivUp(cp.x, denominator);
            yMid = yMid.sqrtUp();
            uint256 subtrahend = cp.y;
            subtrahend <<= 16;
            subtrahend /= feeBase;
            yMid -= subtrahend;

            uint256 yMin = assetOut;
            yMin *= cp.y;
            yMin <<= 12;
            denominator = xAdjust;
            denominator *= feeBase;
            yMin = yMin.divUp(denominator);

            uint256 _yIncrease = yMid;
            _yIncrease -= yMin;
            _yIncrease *= percent;
            _yIncrease = _yIncrease.shiftRightUp(31);
            _yIncrease += yMin;
            yIncrease = _yIncrease.toUint112();

            uint256 yAdjust = cp.y;
            yAdjust <<= 16;
            yAdjust += _yIncrease * feeBase;

            uint256 _zIncrease = cp.x;
            _zIncrease *= cp.y;
            _zIncrease <<= 16;
            subtrahend = xAdjust;
            subtrahend *= yAdjust;
            _zIncrease -= subtrahend;
            denominator = xAdjust;
            denominator *= yAdjust;
            denominator *= feeBase;
            _zIncrease = _zIncrease.mulDivUp(uint256(cp.z) << 16, denominator);
            zIncrease = _zIncrease.toUint112();
        } else {
            uint256 zMid = cp.z;
            zMid *= cp.z;
            zMid <<= 32;
            uint256 denominator = xAdjust;
            denominator *= feeBase;
            denominator *= feeBase;
            zMid = zMid.mulDivUp(cp.x, denominator);
            zMid = zMid.sqrtUp();
            uint256 subtrahend = cp.z;
            subtrahend <<= 16;
            subtrahend /= feeBase;
            zMid -= subtrahend;

            percent = 0x100000000 - percent;

            uint256 _zIncrease = zMid;
            _zIncrease *= percent;
            _zIncrease = _zIncrease.shiftRightUp(31);
            zIncrease = _zIncrease.toUint112();

            uint256 zAdjust = cp.z;
            zAdjust <<= 16;
            zAdjust += _zIncrease * feeBase;
            uint256 _yIncrease = cp.x;
            _yIncrease *= cp.z;
            _yIncrease <<= 16;
            subtrahend = xAdjust;
            subtrahend *= zAdjust;
            _yIncrease -= subtrahend;
            denominator = xAdjust;
            denominator *= zAdjust;
            denominator *= feeBase;
            _yIncrease = _yIncrease.mulDivUp(uint256(cp.y) << 16, denominator);
            yIncrease = _yIncrease.toUint112();
        }
    }
}
