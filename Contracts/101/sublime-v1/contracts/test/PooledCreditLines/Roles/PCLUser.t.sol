//SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../../roles/User.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '../../../Verification/Verification.sol';
import '../../../mocks/MockAdminVerifier.sol';

contract PCLUser is IPooledCreditLineDeclarations, User {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    PooledCreditLine pcl;
    LenderPool lp;

    constructor(address _pclAddress, address _lpAddress) {
        pcl = PooledCreditLine(_pclAddress);
        lp = LenderPool(_lpAddress);
    }

    function updatePCL(address _pclAddress) public {
        pcl = PooledCreditLine(_pclAddress);
    }

    function updateLP(address _lpAddress) public {
        lp = LenderPool(_lpAddress);
    }

    function registerSelf(address _verifier) public {
        MockAdminVerifier verifier = MockAdminVerifier(payable(_verifier));
        verifier.registerSelf();
    }

    /******************************************************************************
     ******* PCL Borrower-specific functions **************************************
     ******************************************************************************/

    function createRequest(Request memory _request) public returns (uint256) {
        uint256 _id = pcl.request(_request);
        return _id;
    }

    function cancelRequest(uint256 _id) public {
        pcl.cancelRequest(_id);
    }

    function depositCollateral(
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount
    ) public {
        pcl.depositCollateral(_id, _amount, _fromSavingsAccount);
    }

    function withdrawCollateral(
        uint256 _id,
        uint256 _amount,
        bool _toSavingsAccount
    ) public {
        pcl.withdrawCollateral(_id, _amount, _toSavingsAccount);
    }

    function withdrawAllCollateral(uint256 _id, bool _toSavingsAccount) public {
        pcl.withdrawAllCollateral(_id, _toSavingsAccount);
    }

    function borrow(uint256 _id, uint256 _amount) public {
        pcl.borrow(_id, _amount);
    }

    function repay(uint256 _id, uint256 _amount) public {
        pcl.repay(_id, _amount);
    }

    function close(uint256 _id) public {
        pcl.close(_id);
    }

    function calculateTotalCollateralTokens(uint256 _id) public returns (uint256) {
        return pcl.calculateTotalCollateralTokens(_id);
    }

    function getRequiredCollateral(uint256 _id, uint256 _amount) public view returns (uint256) {
        return pcl.getRequiredCollateral(_id, _amount);
    }

    function calculateBorrowableAmount(uint256 _id) public returns (uint256) {
        return pcl.calculateBorrowableAmount(_id);
    }

    function calculateInterestAccrued(uint256 _id) public view returns (uint256) {
        return pcl.calculateInterestAccrued(_id);
    }

    function withdrawableCollateral(uint256 _id) public returns (uint256) {
        return pcl.withdrawableCollateral(_id);
    }

    function calculateCurrentDebt(uint256 _id) public view returns (uint256) {
        return pcl.calculateCurrentDebt(_id);
    }

    function getPrincipal(uint256 _id) public view {
        pcl.getPrincipal(_id);
    }

    function getStatus(uint256 _id) public returns (PooledCreditLineStatus) {
        return pcl.getStatusAndUpdate(_id);
    }

    function calculateCurrentCollateralRatio(uint256 _id) public returns (uint256) {
        return pcl.calculateCurrentCollateralRatio(_id);
    }

    /******************************************************************************
     ******* End of PCL Borrower-specific functions *******************************
     ******************************************************************************/

    /******************************************************************************
     ******* PCL Lender-specific functions ****************************************
     ******************************************************************************/

    function start(uint256 _id) public {
        lp.start(_id);
    }

    function lend(uint256 _id, uint256 _amount) public {
        lp.lend(_id, _amount);
    }

    function liquidate(uint256 _id, bool _withdraw) public {
        lp.liquidate(_id, _withdraw);
    }

    function withdrawTokensAfterLiquidation(uint256 _id) public {
        lp.withdrawTokensAfterLiquidation(_id);
    }

    function withdrawInterest(uint256 _id) public {
        lp.withdrawInterest(_id);
    }

    function withdrawLiquidity(uint256 _id) public {
        lp.withdrawLiquidity(_id);
    }

    function withdrawLiquidation(uint256 _id) public {
        lp.withdrawTokensAfterLiquidation(_id);
    }

    function calculatePrincipalWithdrawable(uint256 _id, address _lender) public returns (uint256) {
        return lp.calculatePrincipalWithdrawable(_id, _lender);
    }

    function transferLPTokens(
        address _to,
        uint256 _id,
        uint256 _amount
    ) public {
        bytes memory emptyBytes;
        lp.safeTransferFrom(address(this), _to, _id, _amount, emptyBytes);
    }

    function getLenderInterest(uint256 _id, address _lender) public returns (uint256) {
        uint256 interest = lp.getLenderInterestWithdrawable(_id, _lender);
        return interest;
    }

    /******************************************************************************
     ******* End of PCL Lender-specific functions **********************
     *******************************************************************************/

    /******************************************************************************
     ******* PCL invalid functions **********************
     *******************************************************************************/

    function accept(uint256 _id, uint256 _amount) public {
        pcl.accept(_id, _amount, address(this));
    }

    function cancelRequestOnLowCollection(uint256 _id) public {
        pcl.cancelRequestOnLowCollection(_id);
    }

    function collateralTokensToLiquidate(uint256 _id, uint256 _borrowTokens) public view returns (uint256) {
        return pcl.getEquivalentCollateralTokens(_id, _borrowTokens);
    }

    // To check for failure scenarios, can't be invoked in general
    function noAccessLiquidate(uint256 _id) public {
        pcl.liquidate(_id);
    }

    function terminate(uint256 _id) public {
        pcl.terminate(_id);
    }

    /******************************************************************************
     ******* END PCL invalid functions **********************
     *******************************************************************************/
}
