// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {Math} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/Math.sol';
import {ConstantProduct} from './ConstantProduct.sol';
import {SafeCast} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/SafeCast.sol';
library MintMath {
    using Math for uint256;
    using ConstantProduct for IPair;
    using SafeCast for uint256;

    function givenNew(
        uint256 maturity,
        uint112 assetIn,
        uint112 debtIn,
        uint112 collateralIn
    )
        internal
        view
        returns (
            uint112 xIncrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        xIncrease = assetIn;
        uint256 duration = maturity;
        duration -= block.timestamp;
        uint256 _yIncrease = debtIn;
        _yIncrease -= assetIn;
        _yIncrease <<= 32;
        _yIncrease /= duration;
        yIncrease = _yIncrease.toUint112();
        uint256 _zIncrease = collateralIn;
        _zIncrease <<= 25;
        uint256 denominator = duration;
        denominator += 0x2000000;
        _zIncrease /= denominator;
        zIncrease = _zIncrease.toUint112();
    }

    function givenAsset(
        IPair pair,
        uint256 maturity,
        uint112 assetIn
    )
        internal
        view
        returns (
            uint112 xIncrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 _xIncrease = assetIn;
        _xIncrease *= cp.x;
        uint256 denominator = cp.x;
        denominator += pair.feeStored(maturity);
        _xIncrease /= denominator;
        xIncrease = _xIncrease.toUint112();

        uint256 _yIncrease = cp.y;
        _yIncrease *= assetIn;
        _yIncrease /= cp.x;
        yIncrease = _yIncrease.toUint112();

        uint256 _zIncrease = cp.z;
        _zIncrease *= assetIn;
        _zIncrease /= cp.x;
        zIncrease = _zIncrease.toUint112();
    }

    function givenDebt(
        IPair pair,
        uint256 maturity,
        uint112 debtIn
    )
        internal
        view
        returns (
            uint112 xIncrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 _yIncrease = debtIn;
        _yIncrease *= cp.y;
        _yIncrease <<= 32;
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator *= cp.y;
        uint256 addend = cp.x;
        addend <<= 32;
        denominator += addend;
        _yIncrease /= denominator;
        yIncrease = _yIncrease.toUint112();

        uint256 _xIncrease = cp.x;
        _xIncrease *= _yIncrease;
        _xIncrease = _xIncrease.divUp(cp.y);
        xIncrease = _xIncrease.toUint112();

        uint256 _zIncrease = cp.z;
        _zIncrease *= _yIncrease;
        _zIncrease /= cp.y;
        zIncrease = _zIncrease.toUint112();
    }

    function givenCollateral(
        IPair pair,
        uint256 maturity,
        uint112 collateralIn
    )
        internal
        view
        returns (
            uint112 xIncrease,
            uint112 yIncrease,
            uint112 zIncrease
        )
    {
        ConstantProduct.CP memory cp = pair.get(maturity);

        uint256 _zIncrease = collateralIn;
        _zIncrease <<= 25;
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator += 0x2000000;
        _zIncrease /= denominator;
        zIncrease = _zIncrease.toUint112();

        uint256 _xIncrease = cp.x;
        _xIncrease *= _zIncrease;
        _xIncrease = _xIncrease.divUp(cp.z);
        xIncrease = _xIncrease.toUint112();

        uint256 _yIncrease = cp.y;
        _yIncrease *= _zIncrease;
        _yIncrease /= cp.z;
        yIncrease = _yIncrease.toUint112();
    }
}
