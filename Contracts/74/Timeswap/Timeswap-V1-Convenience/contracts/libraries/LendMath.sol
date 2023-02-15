// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {Math} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/Math.sol';
import {SquareRoot} from './SquareRoot.sol';
import {FullMath} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/FullMath.sol';
import {ConstantProduct} from './ConstantProduct.sol';
import {SafeCast} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/SafeCast.sol';

library LendMath {
    using Math for uint256;
    using SquareRoot for uint256;
    using FullMath for uint256;
    using ConstantProduct for IPair;
    using ConstantProduct for ConstantProduct.CP;
    using SafeCast for uint256;

    function givenBond(
        IPair pair,
        uint256 maturity,
        uint112 assetIn,
        uint128 bondOut
    ) internal view returns (uint112 yDecrease, uint112 zDecrease) {
        uint256 feeBase = 0x10000 + pair.fee();

        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 _yDecrease = bondOut;
        _yDecrease -= assetIn;
        _yDecrease <<= 32;
        _yDecrease = _yDecrease.divUp(maturity - block.timestamp);
        yDecrease = _yDecrease.toUint112();

        uint256 xAdjust = cp.x;
        xAdjust += assetIn;

        uint256 yAdjust = cp.y;
        yAdjust <<= 16;
        yAdjust -= _yDecrease * feeBase;

        uint256 _zDecrease = xAdjust;
        _zDecrease *= yAdjust;
        uint256 subtrahend = cp.x;
        subtrahend *= cp.y;
        subtrahend <<= 16;
        _zDecrease -= subtrahend;
        uint256 denominator = xAdjust;
        denominator *= yAdjust;
        denominator *= feeBase;
        _zDecrease = _zDecrease.mulDiv(uint256(cp.z) << 16, denominator);
        zDecrease = _zDecrease.toUint112();
    }

    function givenInsurance(
        IPair pair,
        uint256 maturity,
        uint112 assetIn,
        uint128 insuranceOut
    ) internal view returns (uint112 yDecrease, uint112 zDecrease) {
        uint256 feeBase = 0x10000 + pair.fee();
        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 xAdjust = cp.x;
        xAdjust += assetIn;
        uint256 _zDecrease = insuranceOut;
        _zDecrease *= xAdjust;
        uint256 subtrahend = cp.z;
        subtrahend *= assetIn;
        _zDecrease -= subtrahend;
        _zDecrease <<= 25;
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator *= xAdjust;
        _zDecrease = _zDecrease.divUp(denominator);
        zDecrease = _zDecrease.toUint112();
        uint256 zAdjust = cp.z;
        zAdjust <<= 16;
        zAdjust -= zDecrease * feeBase;

        uint256 _yDecrease = xAdjust;
        _yDecrease *= zAdjust;
        subtrahend = cp.x;
        subtrahend *= cp.z;
        subtrahend <<= 16;
        _yDecrease -= subtrahend;
        denominator = xAdjust;
        denominator *= zAdjust;
        denominator *= feeBase;
        _yDecrease = _yDecrease.mulDiv(uint256(cp.y) << 16, denominator);
        yDecrease = _yDecrease.toUint112();
    }

    function givenPercent(
        IPair pair,
        uint256 maturity,
        uint112 assetIn,
        uint40 percent
    ) internal view returns (uint112 yDecrease, uint112 zDecrease) {
        uint256 feeBase = 0x10000 + pair.fee();

        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 xAdjust = cp.x;
        xAdjust += assetIn;

        if (percent <= 0x80000000) {
            uint256 yMid = cp.y;
            yMid <<= 16;
            yMid /= feeBase;
            uint256 subtrahend = cp.y;
            subtrahend *= cp.y;
            subtrahend <<= 32;
            uint256 denominator = xAdjust;
            denominator *= feeBase;
            denominator *= feeBase;
            subtrahend = subtrahend.mulDivUp(cp.x, denominator);
            subtrahend = subtrahend.sqrtUp();
            yMid -= subtrahend;

            uint256 yMin = assetIn;
            yMin *= cp.y;
            yMin <<= 12;
            denominator = xAdjust;
            denominator *= feeBase;
            yMin /= denominator;

            uint256 _yDecrease = yMid;
            _yDecrease -= yMin;
            _yDecrease *= percent;
            _yDecrease >>= 31;
            _yDecrease += yMin;
            yDecrease = _yDecrease.toUint112();

            uint256 yAdjust = cp.y;
            yAdjust <<= 16;
            yAdjust -= _yDecrease * feeBase;

            uint256 _zDecrease = xAdjust;
            _zDecrease *= yAdjust;
            subtrahend = cp.x;
            subtrahend *= cp.y;
            subtrahend <<= 16;
            _zDecrease -= subtrahend;
            denominator = xAdjust;
            denominator *= yAdjust;
            denominator *= feeBase;
            _zDecrease = _zDecrease.mulDiv(uint256(cp.z) << 16, denominator);
            zDecrease = _zDecrease.toUint112();
        } else {
            uint256 zMid = cp.z;
            zMid <<= 16;
            zMid /= feeBase;
            uint256 subtrahend = cp.z;
            subtrahend *= cp.z;
            subtrahend <<= 32;
            uint256 denominator = xAdjust;
            denominator *= feeBase;
            denominator *= feeBase;
            subtrahend = subtrahend.mulDivUp(cp.x, denominator);
            subtrahend = subtrahend.sqrtUp();
            zMid -= subtrahend;

            percent = 0x100000000 - percent;

            uint256 _zDecrease = zMid;
            _zDecrease *= percent;
            _zDecrease >>= 31;
            zDecrease = _zDecrease.toUint112();

            uint256 zAdjust = cp.z;
            zAdjust <<= 16;
            zAdjust -= zDecrease * feeBase;

            uint256 _yDecrease = xAdjust;
            _yDecrease *= zAdjust;
            subtrahend = cp.x;
            subtrahend *= cp.z;
            subtrahend <<= 16;
            _yDecrease -= subtrahend;
            denominator = xAdjust;
            denominator *= zAdjust;
            denominator *= feeBase;
            _yDecrease = _yDecrease.mulDiv(uint256(cp.y) << 16, denominator);
            yDecrease = _yDecrease.toUint112();
        }
    }
}
