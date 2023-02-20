// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

// Interfaces
import "./interfaces/iERC20.sol";
import "./interfaces/iVADER.sol";
import "./interfaces/iROUTER.sol";
import "./interfaces/iPOOLS.sol";
import "./interfaces/iFACTORY.sol";
import "./interfaces/iSYNTH.sol";

import "hardhat/console.sol";

contract Utils {

    uint private one = 10**18;
    uint private _10k = 10000;
    uint private _year = 31536000; // One Year (in seconds)

    bool private inited;

    address public VADER;
    address public USDV;
    address public ROUTER;
    address public POOLS;
    address public FACTORY;

    constructor () {}

    function init(address _vader, address _usdv, address _router, address _pools, address _factory) public {
        require(inited == false,  "inited");
        inited = true;
        VADER = _vader;
        USDV = _usdv;
        ROUTER = _router;
        POOLS = _pools;
        FACTORY = _factory;
    }
    //====================================SYSTEM FUNCTIONS====================================//
    // VADER FeeOnTransfer
    function getFeeOnTransfer(uint totalSupply, uint maxSupply) external pure returns(uint){
        return calcShare(totalSupply, maxSupply, 100); // 0->100BP
    }

    function assetChecks(address collateralAsset, address debtAsset) external {
        if(collateralAsset == VADER){
            require(iPOOLS(POOLS).isAnchor(debtAsset), "Bad Combo"); // Can borrow Anchor with VADER/ANCHOR-SYNTH
        } else if(collateralAsset == USDV){
            require(iPOOLS(POOLS).isAsset(debtAsset), "Bad Combo"); // Can borrow Asset with VADER/ASSET-SYNTH
        } else if(iPOOLS(POOLS).isSynth(collateralAsset) && iPOOLS(POOLS).isAnchor(iSYNTH(collateralAsset).TOKEN())){
            require(iPOOLS(POOLS).isAnchor(debtAsset), "Bad Combo"); // Can borrow Anchor with VADER/ANCHOR-SYNTH
        } else if(iPOOLS(POOLS).isSynth(collateralAsset) && iPOOLS(POOLS).isAsset(iSYNTH(collateralAsset).TOKEN())){
            require(iPOOLS(POOLS).isAsset(debtAsset), "Bad Combo"); // Can borrow Anchor with VADER/ANCHOR-SYNTH
        }
    }

    function isBase(address token) public view returns(bool base) {
        if(token == VADER || token == USDV){
            return true;
        }
    }
    function isPool(address token) public view returns(bool pool) {
        if(iPOOLS(POOLS).isAnchor(token) || iPOOLS(POOLS).isAsset(token)){
            pool = true;
        }
    }

    //====================================PRICING====================================//

    function calcValueInBase(address token, uint amount) public view returns (uint value){
       (uint _baseAmt, uint _tokenAmt) = iPOOLS(POOLS).getPoolAmounts(token);
       if(_baseAmt > 0 && _tokenAmt > 0){
            return (amount * _baseAmt) / _tokenAmt;
       }
    }

    function calcValueInToken(address token, uint amount) public view returns (uint value){
        (uint _baseAmt, uint _tokenAmt) = iPOOLS(POOLS).getPoolAmounts(token);
        if(_baseAmt > 0 && _tokenAmt > 0){
            return (amount * _tokenAmt) / _baseAmt;
       }
    }
    function calcValueOfTokenInToken(address token1, uint amount, address token2) public view returns (uint value){
            return calcValueInToken(token2, calcValueInBase(token1, amount));
    }

    function calcSwapValueInBase(address token, uint amount) public view returns (uint){
        (uint _baseAmt, uint _tokenAmt) = iPOOLS(POOLS).getPoolAmounts(token);
        return calcSwapOutput(amount, _tokenAmt, _baseAmt);
    }
    function calcSwapValueInToken(address token, uint amount) public view returns (uint){
        (uint _baseAmt, uint _tokenAmt) = iPOOLS(POOLS).getPoolAmounts(token);
        return calcSwapOutput(amount, _baseAmt, _tokenAmt);
    }

    function requirePriceBounds(address token, uint bound, bool inside, uint targetPrice) external view {
        uint _testingPrice = calcValueInBase(token, one);
        uint _lower = calcPart((_10k - bound), targetPrice);                // ie 98% of price
        uint _upper = (targetPrice * (_10k + bound)) / _10k;                // ie 105% of price
        if(inside){
            require((_testingPrice >= _lower && _testingPrice <= _upper), "Not inside");
        } else {
            require((_testingPrice <= _lower || _testingPrice >= _upper), "Not outside");
        }
    }

    //====================================INCENTIVES========================================//

    function getRewardShare(address token, uint rewardReductionFactor) external view returns (uint rewardShare) {
        if(iVADER(VADER).emitting() && iROUTER(ROUTER).isCurated(token)){
            uint _baseAmount = iPOOLS(POOLS).getBaseAmount(token);
            if (iPOOLS(POOLS).isAsset(token)) {
                uint _share = calcShare(_baseAmount, iPOOLS(POOLS).pooledUSDV(), iROUTER(ROUTER).reserveUSDV());
                rewardShare = getReducedShare(_share, rewardReductionFactor);
            } else if(iPOOLS(POOLS).isAnchor(token)) {
                uint _share = calcShare(_baseAmount, iPOOLS(POOLS).pooledVADER(), iROUTER(ROUTER).reserveVADER());
                rewardShare = getReducedShare(_share, rewardReductionFactor);
            }
        }
    }

    function getReducedShare(uint amount, uint rewardReductionFactor) public pure returns(uint) {
        return calcShare(1, rewardReductionFactor, amount); // Reduce to stop depleting fast
    }

    //=================================IMPERMANENT LOSS=====================================//

    // Actual protection with 100 day rule and Reserve balance
    function getProtection(address member, address token, uint basisPoints, uint timeForFullProtection) public view returns(uint protection) {
        uint _coverage = getCoverage(member, token);
        if(iROUTER(ROUTER).isCurated(token)){
            uint _duration = block.timestamp - iROUTER(ROUTER).getMemberLastDeposit(member, token);
            if(_duration <= timeForFullProtection) {
                protection = calcShare(_duration, timeForFullProtection, _coverage); // Apply 100 day rule
            } else {
                protection = _coverage;
            }
        }
        return calcPart(basisPoints, protection);
    }
    // Theoretical coverage based on deposit/redemption values
    function getCoverage(address member, address token) public view returns (uint) {
        uint _B0 = iROUTER(ROUTER).getMemberBaseDeposit(member, token); uint _T0 = iROUTER(ROUTER).getMemberTokenDeposit(member, token);
        uint _units = iPOOLS(POOLS).getMemberUnits(token, member);
        uint _B1 = calcShare(_units, iPOOLS(POOLS).getUnits(token), iPOOLS(POOLS).getBaseAmount(token));
        uint _T1 = calcShare(_units, iPOOLS(POOLS).getUnits(token), iPOOLS(POOLS).getTokenAmount(token));
        return calcCoverage(_B0, _T0, _B1, _T1);
    }

    //==================================== LENDING ====================================//

    function getCollateralValueInBase(address member, uint collateral, address collateralAsset, address debtAsset) external view returns (uint debt, uint baseValue) {
        uint _collateralAdjusted = (collateral * 6666) / 10000; // 150% collateral Ratio
        if(isBase(collateralAsset)){
            baseValue = _collateralAdjusted;
        }else if(isPool(collateralAsset)){
            baseValue = calcAsymmetricShare(_collateralAdjusted, iPOOLS(POOLS).getMemberUnits(collateralAsset, member), iPOOLS(POOLS).getBaseAmount(collateralAsset)); // calc units to BASE
        }else if(iFACTORY(FACTORY).isSynth(collateralAsset)){
            baseValue = calcSwapValueInBase(iSYNTH(collateralAsset).TOKEN(), _collateralAdjusted); // Calc swap value
        }
        debt = calcSwapValueInToken(debtAsset, baseValue);        // get debt output
        return (debt, baseValue);
    }

    function getDebtValueInCollateral(address member, uint debt, address collateralAsset, address debtAsset) external view returns(uint, uint) {
        uint _memberDebt = iROUTER(ROUTER).getMemberDebt(member, collateralAsset, debtAsset); // Outstanding Debt
        uint _memberCollateral = iROUTER(ROUTER).getMemberCollateral(member, collateralAsset, debtAsset); // Collateral
        uint _collateral = iROUTER(ROUTER).getSystemCollateral(collateralAsset, debtAsset);
        uint _interestPaid = iROUTER(ROUTER).getSystemInterestPaid(collateralAsset, debtAsset);
        uint _memberInterestShare = calcShare(_memberCollateral, _collateral, _interestPaid); // Share of interest based on collateral
        uint _collateralUnlocked = calcShare(debt, _memberDebt, _memberCollateral); 
        return (_collateralUnlocked, _memberInterestShare);
    }

    function getInterestOwed(address collateralAsset, address debtAsset, uint timeElapsed) external view returns(uint interestOwed) {
        uint _interestPayment = calcShare(timeElapsed, _year, getInterestPayment(collateralAsset, debtAsset)); // Share of the payment over 1 year
        if(isBase(collateralAsset)){
            interestOwed = calcValueInBase(debtAsset, _interestPayment); // Back to base
        } else if(iFACTORY(FACTORY).isSynth(collateralAsset)) {
            interestOwed = calcValueOfTokenInToken(debtAsset, _interestPayment, collateralAsset); // Get value of Synth in debtAsset (doubleSwap)
        }
    }
    function getInterestPayment(address collateralAsset, address debtAsset) public view returns(uint) {
        uint _debtLoading = getDebtLoading(collateralAsset, debtAsset);
        return (_debtLoading * iROUTER(ROUTER).getSystemDebt(collateralAsset, debtAsset)) / 10000; 
    }
    function getDebtLoading(address collateralAsset, address debtAsset) public view returns(uint) {
        uint _debtIssued = iROUTER(ROUTER).getSystemDebt(collateralAsset, debtAsset);
        uint _debtDepth = iPOOLS(POOLS).getTokenAmount(debtAsset);
        return (_debtIssued * 10000) / _debtDepth; 
    }

    //====================================CORE-MATH====================================//

    function calcPart(uint bp, uint total) public pure returns (uint){
        // 10,000 basis points = 100.00%
        require((bp <= 10000) && (bp >= 0), "Must be correct BP");
        return calcShare(bp, 10000, total);
    }

    function calcShare(uint part, uint total, uint amount) public pure returns (uint share){
        // share = amount * part/total
        if(part > total){
            part = total;
        }
        if(total > 0){
            share = (amount * part) / total;
        }
    }

    function calcSwapOutput(uint x, uint X, uint Y) public pure returns (uint){
        // y = (x * X * Y )/(x + X)^2
        uint numerator = (x * X * Y);
        uint denominator = (x + X) * (x + X);
        return (numerator / denominator);
    }

    function calcSwapFee(uint x, uint X, uint Y) external pure returns (uint){
        // fee = (x * x * Y) / (x + X)^2
        uint numerator = (x * x * Y);
        uint denominator = (x + X) * (x + X);
        return (numerator / denominator);
    }
    function calcSwapSlip(uint x, uint X) external pure returns (uint){
        // slip = (x) / (x + X)
        return (x*10000) / (x + X);
    }

    function calcLiquidityUnits(uint b, uint B, uint t, uint T, uint P) external view returns (uint){
        if(P == 0){
            return b;
        } else {
            // units = ((P (t B + T b))/(2 T B)) * slipAdjustment
            // P * (part1 + part2) / (part3) * slipAdjustment
            uint slipAdjustment = getSlipAdustment(b, B, t, T);
            uint part1 = (t * B);
            uint part2 = (T * b);
            uint part3 = (T * B) * 2;
            uint _units = (((P * part1) + part2) / part3);
            return (_units * slipAdjustment) / one;  // Divide by 10**18
        }
    }

    function getSlipAdustment(uint b, uint B, uint t, uint T) public view returns (uint){
        // slipAdjustment = (1 - ABS((B t - b T)/((2 b + B) (t + T))))
        // 1 - ABS(part1 - part2)/(part3 * part4))
        uint part1 = B * t;
        uint part2 = b * T;
        uint part3 = (b * 2) + B;
        uint part4 = t + T;
        uint numerator;
        if(part1 > part2){
            numerator = (part1 - part2);
        } else {
            numerator = (part2 - part1);
        }
        uint denominator = (part3 * part4);
        return one - (numerator * one) / denominator; // Multiply by 10**18
    }

    function calcSynthUnits(uint b, uint B, uint P) external pure returns(uint){
        // (P * b)/(2*(b + B))
        return (P * b) / (2 * (b + B));
    }

    function calcAsymmetricShare(uint u, uint U, uint A) public pure returns (uint){
        // share = (u * U * (2 * A^2 - 2 * U * u + U^2))/U^3
        // (part1 * (part2 - part3 + part4)) / part5
        uint part1 = (u * A);
        uint part2 = ((U * U) * 2);
        uint part3 = ((U * u) * 2);
        uint part4 = (u * u);
        uint numerator = ((part1 * part2) - part3) + part4;
        uint part5 = ((U * U) * U);
        return (numerator / part5);
    }
    function calcCoverage(uint B0, uint T0, uint B1, uint T1) public pure returns(uint coverage){
        if(B0 > 0 && T1 > 0){
            uint _depositValue = B0 + (T0 * B1) / T1; // B0+(T0*B1/T1)
            uint _redemptionValue = B1 + (T1 * B1) / T1; // B1+(T1*B1/T1)
            if(_redemptionValue <= _depositValue){
                coverage = (_depositValue - _redemptionValue);
            }
        }
    }

    // Sorts array in memory from low to high, returns in-memory (Does not need to modify storage)
    function sortArray(uint[] memory array) external pure returns (uint[] memory) {
        uint l = array.length;
        for(uint i = 0; i < l; i++){
            for(uint j = i+1; j < l; j++){
                if(array[i] > array[j]){
                    uint temp = array[i];
                    array[i] = array[j];
                    array[j] = temp;
                }
            }
        }
        return array;
    }

}