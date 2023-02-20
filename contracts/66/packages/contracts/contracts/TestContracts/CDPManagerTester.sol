// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../TroveManager.sol";

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract TroveManagerTester is TroveManager {

    function computeICR(address[] memory _tokens, uint[] memory _amounts, uint _debt) external view returns (uint) {
        uint sumCollateralVCs;
        for (uint i = 0; i < _amounts.length; i++) {
            sumCollateralVCs = sumCollateralVCs.add(whitelist.getValueVC(_tokens[i], _amounts[i]));
        }
        return LiquityMath._computeCR(sumCollateralVCs, _debt);
    }

//    function getCollGasCompensation(address[] memory _tokens, uint[] memory _amounts) external view returns (address[] memory, uint[] memory) {
//        newColls memory coll;
//        coll.tokens = _tokens;
//        coll.amounts = _amounts;
//        newColls memory CollGasCompensation = _getCollGasCompensation(coll);
//        return (CollGasCompensation.tokens,  CollGasCompensation.amounts);
//    }

    function getYUSDGasCompensation() external pure returns (uint) {
        return YUSD_GAS_COMPENSATION;
    }

    function getCompositeDebt(uint _debt) external pure returns (uint) {
        return _getCompositeDebt(_debt);
    }

    function unprotectedDecayBaseRateFromBorrowing() external returns (uint) {
        baseRate = calcDecayedBaseRate();
        require(baseRate >= 0 && baseRate <= DECIMAL_PRECISION, "unprotectedDecayBaseRateFromBorrowing: bad baseRate");
        
        _updateLastFeeOpTime();
        return baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint) {
        return _minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint _baseRate) external {
        baseRate = _baseRate;
    }

    function callGetRedemptionFee(uint _YUSDRedeemed) external view returns (uint) {
        _getRedemptionFee(_YUSDRedeemed);
    }  

    function getActualDebtFromComposite(uint _debtVal) external pure returns (uint) {
        return _getNetDebt(_debtVal);
    }

    function callInternalRemoveTroveOwner(address _troveOwner) external {
        // uint troveOwnersArrayLength = getTroveOwnersCount();
        // _removeTroveOwner(_troveOwner, troveOwnersArrayLength);
    }

    function getTotalStakes(address _collADdress) external view returns (uint) {
        return totalStakes[_collADdress];
    }

    function getTroveIndex(address _troveAddress) external view returns (uint) {
        return Troves[_troveAddress].arrayIndex;
    }

    // _price is no longer used but just useful so we don't have to rewrite test cases
    // function getCurrentICR(address _troveAddress, uint _price) external view returns (uint) {
    //     return getCurrentICR(_troveAddress);
    // }

    function getEDC(address _troveAddress) external view returns (address[] memory, uint[] memory, uint) {
        (newColls memory colls, uint YUSDdebt) = _getCurrentTroveState(_troveAddress);
        return (colls.tokens, colls.amounts, YUSDdebt);
    }
    // for testing-easier to convert getCollGasCompensation calls to use this
    function getCollGasCompensation(address _token, uint _amount) external pure returns (uint) {
        address[] memory tokens = new address[](1);
        tokens[0] = _token;

        uint[] memory amounts = new uint[](1);
        amounts[0] = _amount;

        newColls memory totalColl = newColls(tokens, amounts);

        newColls memory compensation = _getCollGasCompensation(totalColl);
        uint ans = compensation.amounts[0];
        return ans;
    }

    function getVC(address[] memory _tokens, uint[] memory _amounts) external view returns (uint) {
        return _getVC(_tokens, _amounts);
    }

    function getUSD(address[] memory _tokens, uint[] memory _amounts) external view returns (uint) {
        newColls memory coll;
        coll.tokens = _tokens;
        coll.amounts = _amounts;
        return _getUSDColls(coll);
    }

    // Return the amount of collateral to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(newColls memory _coll) internal pure returns (newColls memory) {
        require(_coll.tokens.length == _coll.amounts.length, "Not same length");

        uint[] memory amounts = new uint[](_coll.tokens.length);
        for (uint256 i; i < _coll.tokens.length; ++i) {
            amounts[i] = _coll.amounts[i] / PERCENT_DIVISOR;
        }
        return newColls(_coll.tokens, amounts);
    }

}
