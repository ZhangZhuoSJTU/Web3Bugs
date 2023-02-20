// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import { IMapleProxyFactory } from "../modules/maple-proxy-factory/contracts/interfaces/IMapleProxyFactory.sol";

import { ERC20Helper }  from "../modules/erc20-helper/src/ERC20Helper.sol";
import { Liquidator }   from "../modules/liquidations/contracts/Liquidator.sol";
import { MapleProxied } from "../modules/maple-proxy-factory/contracts/MapleProxied.sol";

import { IDebtLocker }                                                                from "./interfaces/IDebtLocker.sol";
import { IERC20Like, IMapleGlobalsLike, IMapleLoanLike, IPoolLike, IPoolFactoryLike } from "./interfaces/Interfaces.sol";

import { DebtLockerStorage } from "./DebtLockerStorage.sol";

/// @title DebtLocker interacts with Loans on behalf of PoolV1
contract DebtLocker is IDebtLocker, DebtLockerStorage, MapleProxied {

    /*****************/
    /*** Modifiers ***/
    /*****************/

    modifier whenProtocolNotPaused() {
        require(!IMapleGlobalsLike(_getGlobals()).protocolPaused(), "DL:PROTOCOL_PAUSED");
        _;
    }

    /********************************/
    /*** Administrative Functions ***/
    /********************************/

    function migrate(address migrator_, bytes calldata arguments_) external override {
        require(msg.sender == _factory(),        "DL:M:NOT_FACTORY");
        require(_migrate(migrator_, arguments_), "DL:M:FAILED");
    }

    function setImplementation(address newImplementation_) external override {
        require(msg.sender == _factory(),               "DL:SI:NOT_FACTORY");
        require(_setImplementation(newImplementation_), "DL:SI:FAILED");
    }

    function upgrade(uint256 toVersion_, bytes calldata arguments_) external override {
        require(msg.sender == _getPoolDelegate(), "DL:U:NOT_POOL_DELEGATE");

        emit Upgraded(toVersion_, arguments_);

        IMapleProxyFactory(_factory()).upgradeInstance(toVersion_, arguments_);
    }

    /*******************************/
    /*** Pool Delegate Functions ***/
    /*******************************/

    function acceptNewTerms(address refinancer_, bytes[] calldata calls_, uint256 amount_) external override whenProtocolNotPaused {
        require(msg.sender == _getPoolDelegate(), "DL:ANT:NOT_PD");

        IMapleLoanLike loan_ = IMapleLoanLike(_loan);

        require(
            (loan_.claimableFunds() + _fundsToCapture == 0) &&
            (loan_.principal() == _principalRemainingAtLastClaim),
            "DL:ANT:NEED_TO_CLAIM"
        );

        require(amount_ == uint256(0) || ERC20Helper.transfer(loan_.fundsAsset(), address(_loan), amount_), "DL:ANT:TRANSFER_FAILED");

        loan_.acceptNewTerms(refinancer_, calls_, uint256(0));

        // NOTE: This must be set after accepting the new terms, which affects the loan principal.
        _principalRemainingAtLastClaim = loan_.principal();
    }

    function claim() external override whenProtocolNotPaused returns (uint256[7] memory details_) {
        require(msg.sender == _pool, "DL:C:NOT_POOL");

        return _repossessed ? _handleClaimOfRepossessed() : _handleClaim();
    }

    // TODO: Discuss pros/cons of pause on this function
    function pullFundsFromLiquidator(address token_, address destination_, uint256 amount_) external override {
        require(msg.sender == _getPoolDelegate(), "DL:SA:NOT_PD");
        
        Liquidator(_liquidator).pullFunds( token_,  destination_,  amount_);
    }

    function setAllowedSlippage(uint256 allowedSlippage_) external override whenProtocolNotPaused {
        require(msg.sender == _getPoolDelegate(), "DL:SAS:NOT_PD");

        emit AllowedSlippageSet(_allowedSlippage = allowedSlippage_);
    }

    function setAuctioneer(address auctioneer_) external override whenProtocolNotPaused {
        require(msg.sender == _getPoolDelegate(), "DL:SA:NOT_PD");

        emit AuctioneerSet(auctioneer_);

        Liquidator(_liquidator).setAuctioneer(auctioneer_);
    }

    function setFundsToCapture(uint256 amount_) override external whenProtocolNotPaused {
        require(msg.sender == _getPoolDelegate(), "DL:SFTC:NOT_PD");

        emit FundsToCaptureSet(_fundsToCapture = amount_);
    }

    function setMinRatio(uint256 minRatio_) external override whenProtocolNotPaused {
        require(msg.sender == _getPoolDelegate(), "DL:SMR:NOT_PD");

        emit MinRatioSet(_minRatio = minRatio_);
    }

    // Pool delegate can prematurely stop liquidation when there's still significant amount to be liquidated.
    function stopLiquidation() external override {
        require(msg.sender == _getPoolDelegate(), "DL:SL:NOT_PD");

        _liquidator = address(0);

        emit LiquidationStopped();
    }

    function triggerDefault() external override whenProtocolNotPaused {
        require(msg.sender == _pool, "DL:TD:NOT_POOL");

        require(
            (IMapleLoanLike(_loan).claimableFunds() == 0) &&
            (IMapleLoanLike(_loan).principal() == _principalRemainingAtLastClaim),
            "DL:TD:NEED_TO_CLAIM"
        );

        _repossessed = true;

        // Ensure that principal is always up to date, claim function will clear out all payments, but on refinance we need to ensure that
        // accounting is updated properly when principal is updated and there are no claimable funds.

        // Repossess collateral and funds from Loan.
        ( uint256 collateralAssetAmount, ) = IMapleLoanLike(_loan).repossess(address(this));

        address collateralAsset = IMapleLoanLike(_loan).collateralAsset();
        address fundsAsset      = IMapleLoanLike(_loan).fundsAsset();

        if (collateralAsset == fundsAsset || collateralAssetAmount == 0) return;

        // Deploy Liquidator contract and transfer collateral.
        require(
            ERC20Helper.transfer(
                collateralAsset,
                _liquidator = address(new Liquidator(address(this), collateralAsset, fundsAsset, address(this), address(this))),
                collateralAssetAmount
            ),
            "DL:TD:TRANSFER"
       );
    }

    /**************************/
    /*** Internal Functions ***/
    /**************************/

    function _handleClaim() internal returns (uint256[7] memory details_) {
        // Get loan state variables needed
        uint256 claimableFunds = IMapleLoanLike(_loan).claimableFunds();

        require(claimableFunds > uint256(0), "DL:HC:NOTHING_TO_CLAIM");

        // Send funds to pool
        IMapleLoanLike(_loan).claimFunds(claimableFunds, _pool);

        uint256 currentPrincipalRemaining = IMapleLoanLike(_loan).principal();

        // Determine how much of `claimableFunds` is principal
        uint256 principalPortion = _principalRemainingAtLastClaim - currentPrincipalRemaining;

        // Update state variables
        _principalRemainingAtLastClaim = currentPrincipalRemaining;

        // Set return values
        // Note: All fees get deducted and transferred during `loan.fundLoan()` that omits the need to
        // return the fees distribution to the pool.
        details_[0] = claimableFunds;
        details_[1] = claimableFunds - principalPortion;
        details_[2] = principalPortion;

        uint256 amountOfFundsToCapture = _fundsToCapture;

        if (amountOfFundsToCapture > uint256(0)) {
            details_[0] += amountOfFundsToCapture;
            details_[2] += amountOfFundsToCapture;

            _fundsToCapture = uint256(0);

            require(ERC20Helper.transfer(IMapleLoanLike(_loan).fundsAsset(), _pool, amountOfFundsToCapture), "DL:HC:CAPTURE_FAILED");
        }
    }

    function _handleClaimOfRepossessed() internal returns (uint256[7] memory details_) {
        require(!_isLiquidationActive(), "DL:HCOR:LIQ_NOT_FINISHED");

        address fundsAsset       = IMapleLoanLike(_loan).fundsAsset();
        uint256 principalToCover = _principalRemainingAtLastClaim;      // Principal remaining at time of liquidation
        uint256 fundsCaptured    = _fundsToCapture;

        // Funds recovered from liquidation and any unclaimed previous payment amounts
        uint256 recoveredFunds = IERC20Like(fundsAsset).balanceOf(address(this)) - fundsCaptured;

        // If `recoveredFunds` is greater than `principalToCover`, the remaining amount is treated as interest in the context of the pool.
        // If `recoveredFunds` is less than `principalToCover`, the difference is registered as a shortfall.
        details_[0] = recoveredFunds + fundsCaptured;
        details_[1] = recoveredFunds > principalToCover ? recoveredFunds - principalToCover : 0;
        details_[2] = fundsCaptured;
        details_[5] = recoveredFunds > principalToCover ? principalToCover : recoveredFunds;
        details_[6] = principalToCover > recoveredFunds ? principalToCover - recoveredFunds : 0;

        _fundsToCapture = uint256(0);
        _repossessed    = false;

        require(ERC20Helper.transfer(fundsAsset, _pool, recoveredFunds + fundsCaptured), "DL:HCOR:TRANSFER");
    }

    /**********************/
    /*** View Functions ***/
    /**********************/

    function allowedSlippage() external view override returns (uint256 allowedSlippage_) {
        return _allowedSlippage;
    }

    function amountRecovered() external view override returns (uint256 amountRecovered_) {
        return _amountRecovered;
    }

    function factory() external view override returns (address factory_) {
        return _factory();
    }

    function fundsToCapture() external view override returns (uint256 fundsToCapture_) {
        return _fundsToCapture;
    }

    function getExpectedAmount(uint256 swapAmount_) external view override whenProtocolNotPaused returns (uint256 returnAmount_) {
        address collateralAsset = IMapleLoanLike(_loan).collateralAsset();
        address fundsAsset      = IMapleLoanLike(_loan).fundsAsset();

        uint256 oracleAmount =
            swapAmount_
                * IMapleGlobalsLike(_getGlobals()).getLatestPrice(collateralAsset)  // Convert from `fromAsset` value.
                * 10 ** IERC20Like(fundsAsset).decimals()                           // Convert to `toAsset` decimal precision.
                * (10_000 - _allowedSlippage)                                       // Multiply by allowed slippage basis points
                / IMapleGlobalsLike(_getGlobals()).getLatestPrice(fundsAsset)       // Convert to `toAsset` value.
                / 10 ** IERC20Like(collateralAsset).decimals()                      // Convert from `fromAsset` decimal precision.
                / 10_000;                                                           // Divide basis points for slippage

        uint256 minRatioAmount = swapAmount_ * _minRatio / 10 ** IERC20Like(collateralAsset).decimals();

        return oracleAmount > minRatioAmount ? oracleAmount : minRatioAmount;
    }

    function implementation() external view override returns (address) {
        return _implementation();
    }

    function investorFee() external view override returns (uint256 investorFee_) {
        return IMapleGlobalsLike(_getGlobals()).investorFee();
    }

    function liquidator() external view override returns (address liquidator_) {
        return _liquidator;
    }

    function loan() external view override returns (address loan_) {
        return _loan;
    }

    function mapleTreasury() external view override returns (address mapleTreasury_) {
        return IMapleGlobalsLike(_getGlobals()).mapleTreasury();
    }

    function minRatio() external view override returns (uint256 minRatio_) {
        return _minRatio;
    }

    function pool() external view override returns (address pool_) {
        return _pool;
    }

    function poolDelegate() external override view returns(address) {
        return _getPoolDelegate();
    }

    function principalRemainingAtLastClaim() external view override returns (uint256 principalRemainingAtLastClaim_) {
        return _principalRemainingAtLastClaim;
    }

    function repossessed() external view override returns (bool repossessed_) {
        return _repossessed;
    }

    function treasuryFee() external view override returns (uint256 treasuryFee_) {
        return IMapleGlobalsLike(_getGlobals()).treasuryFee();
    }

    /*******************************/
    /*** Internal View Functions ***/
    /*******************************/

    function _getGlobals() internal view returns (address) {
        return IPoolFactoryLike(IPoolLike(_pool).superFactory()).globals();
    }

    function _getPoolDelegate() internal view returns(address) {
        return IPoolLike(_pool).poolDelegate();
    }

    function _isLiquidationActive() internal view returns (bool) {
        return (_liquidator != address(0)) && (IERC20Like(IMapleLoanLike(_loan).collateralAsset()).balanceOf(_liquidator) > 0);
    }

}
