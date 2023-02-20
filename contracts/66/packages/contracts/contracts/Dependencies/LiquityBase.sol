// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "./LiquityMath.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/ILiquityBase.sol";
import "./YetiCustomBase.sol";


/* 
* Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
* common functions. 
*/
contract LiquityBase is ILiquityBase, YetiCustomBase {

    uint constant public _100pct = 1e18; // 1e18 == 100%

    uint constant public _110pct = 11e17; // 1.1e18 == 110%

    // Minimum collateral ratio for individual troves
    uint constant public MCR = 11e17; // 110%

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public CCR = 15e17; // 150%

    // Amount of YUSD to be locked in gas pool on opening troves
    uint constant public YUSD_GAS_COMPENSATION = 200e18;

    // Minimum amount of net YUSD debt a must have
    uint constant public MIN_NET_DEBT = 1800e18;
    // uint constant public MIN_NET_DEBT = 0; 

    uint constant public PERCENT_DIVISOR = 200; // dividing by 200 yields 0.5%

    uint constant public BORROWING_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%
    uint constant public REDEMPTION_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%

    IActivePool internal activePool;

    IDefaultPool internal defaultPool;

    // --- Gas compensation functions ---

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal pure returns (uint) {
        return _debt.add(YUSD_GAS_COMPENSATION);
    }


    function _getNetDebt(uint _debt) internal pure returns (uint) {
        return _debt.sub(YUSD_GAS_COMPENSATION);
    }



    // Return the system's Total Virtual Coin Balance
    // Virtual Coins are a way to keep track of the system collateralization given
    // the collateral ratios of each collateral type
    function getEntireSystemColl() public view returns (uint) {
        uint activeColl = activePool.getVC();
        uint liquidatedColl = defaultPool.getVC();

        return activeColl.add(liquidatedColl);
    }


    function getEntireSystemDebt() public override view returns (uint) {
        uint activeDebt = activePool.getYUSDDebt();
        uint closedDebt = defaultPool.getYUSDDebt();

        return activeDebt.add(closedDebt);
    }


    function _getICRColls(newColls memory _colls, uint _debt) internal view returns (uint ICR) {
        uint totalVC = _getVCColls(_colls);
        ICR = LiquityMath._computeCR(totalVC, _debt);
    }


    function _getVC(address[] memory _tokens, uint[] memory _amounts) internal view returns (uint totalVC) {
        uint256 tokensLen = _tokens.length;
        require(tokensLen == _amounts.length, "Not same length");
        for (uint256 i; i < tokensLen; ++i) {
            uint tokenVC = whitelist.getValueVC(_tokens[i], _amounts[i]);
            totalVC = totalVC.add(tokenVC);
        }
    }


    function _getVCColls(newColls memory _colls) internal view returns (uint VC) {
        uint256 tokensLen = _colls.tokens.length;
        for (uint256 i; i < tokensLen; ++i) {
            uint valueVC = whitelist.getValueVC(_colls.tokens[i], _colls.amounts[i]);
            VC = VC.add(valueVC);
        }
    }


    function _getUSDColls(newColls memory _colls) internal view returns (uint USDValue) {
        uint256 tokensLen = _colls.tokens.length;
        for (uint256 i; i < tokensLen; ++i) {
            uint valueUSD = whitelist.getValueUSD(_colls.tokens[i], _colls.amounts[i]);
            USDValue = USDValue.add(valueUSD);
        }
    }


    function _getTCR() internal view returns (uint TCR) {
        uint entireSystemColl = getEntireSystemColl();
        uint entireSystemDebt = getEntireSystemDebt();
        
        TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt);
    }


    function _checkRecoveryMode() internal view returns (bool) {
        uint TCR = _getTCR();
        return TCR < CCR;
    }

    // fee and amount are denominated in dollar
    function _requireUserAcceptsFee(uint _fee, uint _amount, uint _maxFeePercentage) internal pure {
        uint feePercentage = _fee.mul(DECIMAL_PRECISION).div(_amount);
        require(feePercentage <= _maxFeePercentage, "Fee > max");
    }

    // checks coll has a nonzero balance of at least one token in coll.tokens
    function _CollsIsNonZero(newColls memory _colls) internal pure returns (bool) {
        uint256 tokensLen = _colls.tokens.length;
        for (uint256 i; i < tokensLen; ++i) {
            if (_colls.amounts[i] != 0) {
                return true;
            }
        }
        return false;
    }


    // Check whether or not the system *would be* in Recovery Mode, given the entire system coll and debt.
    // returns true if the system would be in recovery mode and false if not
    function _checkPotentialRecoveryMode(uint _entireSystemColl, uint _entireSystemDebt)
    internal
    pure
    returns (bool)
    {
        uint TCR = LiquityMath._computeCR(_entireSystemColl, _entireSystemDebt);

        return TCR < CCR;
    }



}
