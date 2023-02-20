// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '../interfaces/IPair.sol';
import {Math} from './Math.sol';
import {FullMath} from './FullMath.sol';
import {ConstantProduct} from './ConstantProduct.sol';
import {SafeCast} from './SafeCast.sol';
import {BlockNumber} from './BlockNumber.sol';

library TimeswapMath {
    using Math for uint256;
    using FullMath for uint256;
    using ConstantProduct for IPair.State;
    using SafeCast for uint256;

    uint256 private constant BASE = 0x10000000000;

    function mint(
        uint256 maturity,
        IPair.State memory state,
        uint112 xIncrease, 
        uint112 yIncrease, 
        uint112 zIncrease
    ) 
        external 
        view 
        returns(
            uint256 liquidityOut,
            IPair.Due memory dueOut,
            uint256 feeStoredIncrease
        )
    {
        if (state.totalLiquidity == 0) {
            liquidityOut = xIncrease;
            liquidityOut <<= 16;
        } else {
            uint256 fromX = state.totalLiquidity.mulDiv(xIncrease, state.x);
            uint256 fromY = state.totalLiquidity.mulDiv(yIncrease, state.y);
            uint256 fromZ = state.totalLiquidity.mulDiv(zIncrease, state.z);

            require(fromY <= fromX,'E214');
            require(fromZ <= fromX, 'E215');

            liquidityOut = fromY <= fromZ ? fromY : fromZ;

            feeStoredIncrease = state.feeStored.mulDivUp(liquidityOut, state.totalLiquidity);
        }

        uint256 _debtIn = maturity;
        _debtIn -= block.timestamp;
        _debtIn *= yIncrease;
        _debtIn = _debtIn.shiftRightUp(32);
        _debtIn += xIncrease;
        dueOut.debt = _debtIn.toUint112();

        uint256 _collateralIn = maturity;
        _collateralIn -= block.timestamp; 
        _collateralIn *= zIncrease;
        _collateralIn = _collateralIn.shiftRightUp(25); 
        _collateralIn += zIncrease; 
        dueOut.collateral = _collateralIn.toUint112();

        dueOut.startBlock = BlockNumber.get();
    }

    function burn(
        IPair.State memory state,
        uint256 liquidityIn
    )
        external
        pure
        returns (
            uint128 assetOut,
            uint128 collateralOut,
            uint256 feeOut
        )
    {
        uint256 totalAsset = state.reserves.asset;
        uint256 totalCollateral = state.reserves.collateral;
        uint256 totalBond = state.totalClaims.bondPrincipal;
        totalBond += state.totalClaims.bondInterest;

        if (totalAsset >= totalBond) {
            uint256 _assetOut = totalAsset;
            unchecked { _assetOut -= totalBond; }
            _assetOut = _assetOut.mulDiv(liquidityIn, state.totalLiquidity);
            assetOut = _assetOut.toUint128();

            uint256 _collateralOut = totalCollateral;
            _collateralOut = _collateralOut.mulDiv(liquidityIn, state.totalLiquidity);
            collateralOut = _collateralOut.toUint128();
        } else {
            uint256 deficit = totalBond;
            unchecked { deficit -= totalAsset; }

            uint256 totalInsurance = state.totalClaims.insurancePrincipal;
            totalInsurance += state.totalClaims.insuranceInterest;

            if (totalCollateral * totalBond > deficit * totalInsurance) {
                uint256 _collateralOut = totalCollateral;
                uint256 subtrahend = deficit;
                subtrahend *= totalInsurance;
                subtrahend = subtrahend.divUp(totalBond);
                _collateralOut -= subtrahend;
                _collateralOut = _collateralOut.mulDiv(liquidityIn, state.totalLiquidity);
                collateralOut = _collateralOut.toUint128();
            }
        }

        feeOut = state.feeStored.mulDiv(liquidityIn, state.totalLiquidity);
    }

    function lend(
        uint256 maturity,
        IPair.State memory state,
        uint112 xIncrease,
        uint112 yDecrease,
        uint112 zDecrease,
        uint16 fee,
        uint16 protocolFee
    )
        external
        view
        returns (
            IPair.Claims memory claimsOut,
            uint256 feeStoredIncrease,
            uint256 protocolFeeStoredIncrease
        ) 
    {   
        lendCheck(state, xIncrease, yDecrease, zDecrease);

        claimsOut.bondPrincipal = xIncrease;
        claimsOut.bondInterest = getBondInterest(maturity, yDecrease);
        claimsOut.insurancePrincipal = getInsurancePrincipal(state, xIncrease);
        claimsOut.insuranceInterest = getInsuranceInterest(maturity, zDecrease);

        (feeStoredIncrease, protocolFeeStoredIncrease) = lendGetFees(
            maturity,
            xIncrease,
            fee,
            protocolFee
        );
    }

    function lendCheck(
        IPair.State memory state,
        uint112 xIncrease,
        uint112 yDecrease,
        uint112 zDecrease
    ) private pure {
        uint112 xReserve = state.x + xIncrease;
        uint112 yReserve = state.y - yDecrease;
        uint112 zReserve = state.z - zDecrease;
        state.checkConstantProduct(xReserve, yReserve, zReserve);
    }

    function getBondInterest(
        uint256 maturity,
        uint112 yDecrease
    ) private view returns (uint112 bondInterestOut) {
        uint256 _bondInterestOut = maturity;
        _bondInterestOut -= block.timestamp;
        _bondInterestOut *= yDecrease;
        _bondInterestOut >>= 32;
        bondInterestOut = _bondInterestOut.toUint112();
    }

    function getInsurancePrincipal(
        IPair.State memory state,
        uint112 xIncrease
    ) private pure returns (uint112 insurancePrincipalOut) {
        uint256 _insurancePrincipalOut = state.z;
        _insurancePrincipalOut *= xIncrease;
        uint256 denominator = state.x;
        denominator += xIncrease;
        _insurancePrincipalOut /= denominator;
        insurancePrincipalOut = _insurancePrincipalOut.toUint112();
    }

    function getInsuranceInterest(
        uint256 maturity,
        uint112 zDecrease
    ) private view returns (uint112 insuranceInterestOut) {
        uint256 _insuranceInterestOut = maturity;
        _insuranceInterestOut -= block.timestamp;
        _insuranceInterestOut *= zDecrease;
        _insuranceInterestOut >>= 25;
        insuranceInterestOut = _insuranceInterestOut.toUint112();
    }

    function lendGetFees(
        uint256 maturity,
        uint112 xIncrease,
        uint16 fee,
        uint16 protocolFee
    ) private view returns (
        uint256 feeStoredIncrease,
        uint256 protocolFeeStoredIncrease
        )
    {
        uint256 totalFee = fee;
        totalFee += protocolFee;

        uint256 numerator = maturity;
        numerator -= block.timestamp;
        numerator *= totalFee;
        numerator += BASE;

        uint256 adjusted = xIncrease;
        adjusted *= numerator;
        adjusted = adjusted.divUp(BASE);
        uint256 totalFeeStoredIncrease = adjusted;
        unchecked { totalFeeStoredIncrease -= xIncrease; }

        feeStoredIncrease = totalFeeStoredIncrease;
        feeStoredIncrease *= fee;
        feeStoredIncrease /= totalFee;
        protocolFeeStoredIncrease = totalFeeStoredIncrease;
        unchecked { protocolFeeStoredIncrease -= feeStoredIncrease; }
    }

    function withdraw(
        IPair.State memory state,
        IPair.Claims memory claimsIn
    ) external pure returns (IPair.Tokens memory tokensOut) {
        uint256 totalAsset = state.reserves.asset;
        uint256 totalBondPrincipal = state.totalClaims.bondPrincipal;
        uint256 totalBondInterest = state.totalClaims.bondInterest;
        uint256 totalBond = totalBondPrincipal;
        totalBond += totalBondInterest;

        if (totalAsset >= totalBond) {
            tokensOut.asset = claimsIn.bondPrincipal;
            tokensOut.asset += claimsIn.bondInterest;
        } else {
            if (totalAsset >= totalBondPrincipal) {
                uint256 remaining = totalAsset;
                unchecked { remaining -= totalBondPrincipal; }
                uint256 _assetOut = claimsIn.bondInterest;
                _assetOut *= remaining;
                _assetOut /= totalBondInterest;
                _assetOut += claimsIn.bondPrincipal;
                tokensOut.asset = _assetOut.toUint128();
            } else {
                uint256 _assetOut = claimsIn.bondPrincipal;
                _assetOut *= totalAsset;
                _assetOut /= totalBondPrincipal;
                tokensOut.asset = _assetOut.toUint128();
            }
            
            uint256 deficit = totalBond;
            unchecked { deficit -= totalAsset; }

            uint256 totalInsurancePrincipal = state.totalClaims.insurancePrincipal;
            totalInsurancePrincipal *= deficit;
            uint256 totalInsuranceInterest = state.totalClaims.insuranceInterest;
            totalInsuranceInterest *= deficit;
            uint256 totalInsurance = totalInsurancePrincipal;
            totalInsurance += totalInsuranceInterest;

            uint256 totalCollateral = state.reserves.collateral;
            totalCollateral *= totalBond;

            if (totalCollateral >= totalInsurance) {
                uint256 _collateralOut = claimsIn.insurancePrincipal;
                _collateralOut += claimsIn.insuranceInterest;
                _collateralOut *= deficit;
                _collateralOut /= totalBond;
                tokensOut.collateral = _collateralOut.toUint128();
            } else if (totalCollateral >= totalInsurancePrincipal) {
                uint256 remaining = totalCollateral;
                unchecked { remaining -= totalInsurancePrincipal; }
                uint256 _collateralOut = claimsIn.insuranceInterest;
                _collateralOut *= deficit;
                uint256 denominator = totalInsuranceInterest;
                denominator *= totalBond;
                _collateralOut = _collateralOut.mulDiv(remaining, denominator);
                uint256 addend = claimsIn.insurancePrincipal;
                addend *= deficit;
                addend /= totalBond;
                _collateralOut += addend;
                tokensOut.collateral = _collateralOut.toUint128();
            } else {
                uint256 _collateralOut = claimsIn.insurancePrincipal;
                _collateralOut *= deficit;
                uint256 denominator = totalInsurancePrincipal;
                denominator *= totalBond;
                _collateralOut = _collateralOut.mulDiv(totalCollateral, denominator);
                tokensOut.collateral = _collateralOut.toUint128();
            }
        }
    }

    function borrow(
        uint256 maturity,
        IPair.State memory state,
        uint112 xDecrease,
        uint112 yIncrease,
        uint112 zIncrease,
        uint16 fee,
        uint16 protocolFee
    )
        external
        view
        returns (
            IPair.Due memory dueOut,
            uint256 feeStoredIncrease,
            uint256 protocolFeeStoredIncrease
        )
    {
        borrowCheck(state, xDecrease, yIncrease, zIncrease);

        dueOut.debt = getDebt(maturity, xDecrease, yIncrease);
        dueOut.collateral = getCollateral(maturity, state, xDecrease, zIncrease);
        dueOut.startBlock = BlockNumber.get();

        (feeStoredIncrease, protocolFeeStoredIncrease) = borrowGetFees(
            maturity,
            xDecrease,
            fee,
            protocolFee
        );
    }

    function borrowCheck(
        IPair.State memory state,
        uint112 xDecrease,
        uint112 yIncrease,
        uint112 zIncrease
    ) private pure {
        uint112 xReserve = state.x - xDecrease;
        uint112 yReserve = state.y + yIncrease;
        uint112 zReserve = state.z + zIncrease;
        state.checkConstantProduct(xReserve, yReserve, zReserve);

        uint256 yMax = xDecrease;
        yMax *= state.y;
        yMax = yMax.divUp(xReserve);
        require(yIncrease <= yMax, 'E214');

        uint256 zMax = xDecrease;
        zMax *= state.z;
        zMax = zMax.divUp(xReserve);
        require(zIncrease <= zMax, 'E215');
    }

    function getDebt(
        uint256 maturity,
        uint112 xDecrease,
        uint112 yIncrease
    ) private view returns (uint112 debtIn) {
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
    ) private view returns (uint112 collateralIn) {
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

    function borrowGetFees(
        uint256 maturity,
        uint112 xDecrease,
        uint16 fee,
        uint16 protocolFee
    ) private view returns (
            uint256 feeStoredIncrease,
            uint256 protocolFeeStoredIncrease
        )
    {

        uint256 totalFee = fee;
        totalFee += protocolFee;

        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator *= totalFee;
        denominator += BASE;

        uint256 adjusted = xDecrease;
        adjusted *= BASE;
        adjusted /= denominator;
        uint256 totalFeeStoredIncrease = xDecrease;
        unchecked { totalFeeStoredIncrease -= adjusted; }

        feeStoredIncrease = totalFeeStoredIncrease;
        feeStoredIncrease *= fee;
        feeStoredIncrease /= totalFee;
        protocolFeeStoredIncrease = totalFeeStoredIncrease;
        unchecked { protocolFeeStoredIncrease -= feeStoredIncrease; }
    }
}