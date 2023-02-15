// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "./Interfaces/IWAsset.sol";
import "./Dependencies/TroveManagerBase.sol";
import "./Dependencies/SafeERC20.sol";

/** 
 * TroveManagerRedemptions is derived from TroveManager and handles all redemption activity of troves. 
 * Instead of calculating redemption fees in ETH like Liquity used to, we now calculate it as a portion 
 * of YUSD passed in to redeem. The YUSDAmount is still how much we would like to redeem, but the 
 * YUSDFee is now the maximum amount of YUSD extra that will be paid and must be in the balance of the 
 * redeemer for the redemption to succeed. This fee is the same as before in terms of percentage of value, 
 * but now it is in terms of YUSD. We now use a helper function to be able to estimate how much YUSD will 
 * be actually needed to perform a redemption of a certain amount, and also given an amount of YUSD balance,
 * the max amount of YUSD that can be used for a redemption, and a max fee such that it will always go through. 
 * 
 * Given a balance of YUSD, Z, the amount that can actually be redeemed is : 
 * Y = YUSD you can actually redeem
 * BR = decayed base rate 
 * X = YUSD Fee
 * S = Total YUSD Supply
 * The redemption fee rate is = (Y / S * 1 / BETA + BR + 0.5%)
 * This is because the new base rate = BR + Y / S * 1 / BETA
 * We pass in X + Y = Z, and want to find X and Y. 
 * Y is calculated to be = S * (sqrt((1.005 + BR)**2 + BETA * Z / S) - 1.005 - BR)
 * through the quadratic formula, and X = Z - Y. 
 * Therefore the amount we can actually redeem given Z is Y, and the max fee is X. 
 * 
 * To find how much the fee is given Y, we can multiply Y by the new base rate, which is BR + Y / S * 1 / BETA. 
 * 
 * To the redemption function, we pass in Y and X. 
 */

contract TroveManagerRedemptions is TroveManagerBase, ITroveManagerRedemptions {
    bytes32 constant public NAME = "TroveManagerRedemptions";

    using SafeERC20 for IYUSDToken;


    address internal borrowerOperationsAddress;

    IStabilityPool internal stabilityPoolContract;

    ITroveManager internal troveManager;

    IYUSDToken internal yusdTokenContract;

    IYETIToken internal yetiTokenContract;

    ISYETI internal sYETIContract;

    ITroveManagerRedemptions internal troveManagerRedemptions;

    address internal gasPoolAddress;

    ISortedTroves internal sortedTroves;

    ICollSurplusPool internal collSurplusPool;

    struct RedemptionTotals {
        uint256 remainingYUSD;
        uint256 totalYUSDToRedeem;
        newColls CollsDrawn;
        uint256 YUSDfee;
        uint256 decayedBaseRate;
        uint256 totalYUSDSupplyAtStart;
        uint256 maxYUSDFeeAmount;
    }
    struct Hints {
        address upper;
        address lower;
        address target;
        uint256 icr;
    }

    /*
     * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
     * Corresponds to (1 / ALPHA) in the white paper.
     */
    uint256 public constant BETA = 2;

    uint256 public constant BOOTSTRAP_PERIOD = 14 days;

    event Redemption(
        uint256 _attemptedYUSDAmount,
        uint256 _actualYUSDAmount,
        uint256 YUSDfee,
        address[] tokens,
        uint256[] amounts
    );

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _yusdTokenAddress,
        address _sortedTrovesAddress,
        address _yetiTokenAddress,
        address _sYETIAddress,
        address _whitelistAddress,
        address _troveManagerAddress
    ) external onlyOwner {
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_yusdTokenAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_yetiTokenAddress);
        checkContract(_sYETIAddress);
        checkContract(_whitelistAddress);
        checkContract(_troveManagerAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPoolContract = IStabilityPool(_stabilityPoolAddress);
        whitelist = IWhitelist(_whitelistAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        yusdTokenContract = IYUSDToken(_yusdTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        yetiTokenContract = IYETIToken(_yetiTokenAddress);
        sYETIContract = ISYETI(_sYETIAddress);
        troveManager = ITroveManager(_troveManagerAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit YUSDTokenAddressChanged(_yusdTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit YETITokenAddressChanged(_yetiTokenAddress);
        emit SYETIAddressChanged(_sYETIAddress);

        _renounceOwnership();
    }

    /** 
     * Main function for redeeming collateral. See above for how YUSDMaxFee is calculated.
     * @param _YUSDamount is equal to the amount of YUSD to actually redeem. 
     * @param _YUSDMaxFee is equal to the max fee in YUSD that the sender is willing to pay
     * _YUSDamount + _YUSDMaxFee must be less than the balance of the sender.
     */
    function redeemCollateral(
        uint256 _YUSDamount,
        uint256 _YUSDMaxFee,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintICR,
        uint256 _maxIterations,
        address _redeemer
    ) external override {
        _requireCallerisTroveManager();
        ContractsCache memory contractsCache = ContractsCache(
            activePool,
            defaultPool,
            yusdTokenContract,
            sYETIContract,
            sortedTroves,
            collSurplusPool,
            gasPoolAddress
        );
        RedemptionTotals memory totals;

        _requireValidMaxFee(_YUSDamount, _YUSDMaxFee);
        _requireAfterBootstrapPeriod();
        _requireTCRoverMCR();
        _requireAmountGreaterThanZero(_YUSDamount);

        totals.totalYUSDSupplyAtStart = getEntireSystemDebt();

        // Confirm redeemer's balance is less than total YUSD supply
        require(contractsCache.yusdToken.balanceOf(_redeemer) <= totals.totalYUSDSupplyAtStart, "TMR: redeemer balance too high");

        totals.remainingYUSD = _YUSDamount;
        address currentBorrower;
        if (_isValidFirstRedemptionHint(contractsCache.sortedTroves, _firstRedemptionHint)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = contractsCache.sortedTroves.getLast();
            // Find the first trove with ICR >= MCR
            while (
                currentBorrower != address(0) && troveManager.getCurrentICR(currentBorrower) < MCR
            ) {
                currentBorrower = contractsCache.sortedTroves.getPrev(currentBorrower);
            }
        }
        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of YUSD is exchanged for collateral
        if (_maxIterations == 0) {
            _maxIterations = uint256(-1);
        }
        while (currentBorrower != address(0) && totals.remainingYUSD != 0 && _maxIterations != 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = contractsCache.sortedTroves.getPrev(currentBorrower);

            if (troveManager.getCurrentICR(currentBorrower) >= MCR) {
                troveManager.applyPendingRewards(currentBorrower);

                SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
                    contractsCache,
                    currentBorrower,
                    totals.remainingYUSD,
                    _upperPartialRedemptionHint,
                    _lowerPartialRedemptionHint,
                    _partialRedemptionHintICR
                );

                if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

                totals.totalYUSDToRedeem = totals.totalYUSDToRedeem.add(singleRedemption.YUSDLot); 

                totals.CollsDrawn = _sumColls(totals.CollsDrawn, singleRedemption.CollLot);
                totals.remainingYUSD = totals.remainingYUSD.sub(singleRedemption.YUSDLot);
            }

            currentBorrower = nextUserToCheck;
        }

        require(isNonzero(totals.CollsDrawn), "TMR: not nonzero collsDrawn");
        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total YUSD supply value, from before it was reduced by the redemption.
        _updateBaseRateFromRedemption(totals.totalYUSDToRedeem, totals.totalYUSDSupplyAtStart);

        totals.YUSDfee = _getRedemptionFee(totals.totalYUSDToRedeem);
        // check user has enough YUSD to pay fee and redemptions
        _requireYUSDBalanceCoversRedemption(
            contractsCache.yusdToken,
            _redeemer,
            _YUSDamount.add(totals.YUSDfee)
        );

        // check to see that the fee doesn't exceed the max fee
        _requireUserAcceptsFeeRedemption(totals.YUSDfee, _YUSDMaxFee);

        // send fee from user to YETI stakers
        contractsCache.yusdToken.safeTransferFrom(
            _redeemer,
            address(contractsCache.sYETI),
            totals.YUSDfee
        );

        emit Redemption(
            _YUSDamount,
            totals.totalYUSDToRedeem,
            totals.YUSDfee,
            totals.CollsDrawn.tokens,
            totals.CollsDrawn.amounts
        );
        // Burn the total YUSD that is cancelled with debt
        contractsCache.yusdToken.burn(_redeemer, totals.totalYUSDToRedeem);
        // Update Active Pool YUSD, and send Collaterals to account
        contractsCache.activePool.decreaseYUSDDebt(totals.totalYUSDToRedeem);

        contractsCache.activePool.sendCollateralsUnwrap(
            address(this), // This contract accumulates rewards for all the wrapped assets short term.
            _redeemer,
            totals.CollsDrawn.tokens,
            totals.CollsDrawn.amounts
        );
    }

    /** 
     * Secondary function for redeeming collateral. See above for how YUSDMaxFee is calculated.
     * @param _YUSDamount is equal to the amount of YUSD to actually redeem. 
     * @param _YUSDMaxFee is equal to the max fee in YUSD that the sender is willing to pay
     * _YUSDamount + _YUSDMaxFee must be less than the balance of the sender.
     */
    function redeemCollateralSingle(
        uint256 _YUSDamount,
        uint256 _YUSDMaxFee,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintICR,
        address _collToRedeem
    ) external {
        // _requireCallerisTroveManager();
        ContractsCache memory contractsCache = ContractsCache(
            activePool,
            defaultPool,
            yusdTokenContract,
            sYETIContract,
            sortedTroves,
            collSurplusPool,
            gasPoolAddress
        );
        RedemptionTotals memory totals;
        Hints memory hints;

        hints.target=_firstRedemptionHint;
        hints.icr=_partialRedemptionHintICR;
        hints.upper=_upperPartialRedemptionHint;
        hints.lower=_lowerPartialRedemptionHint;
        
        _requireValidMaxFee(_YUSDamount, _YUSDMaxFee);
        _requireAfterBootstrapPeriod();
        _requireTCRoverMCR();
        _requireAmountGreaterThanZero(_YUSDamount);
        // address _redeemer = msg.sender;
        totals.totalYUSDSupplyAtStart = getEntireSystemDebt();

        // Confirm redeemer's balance is less than total YUSD supply
        require(contractsCache.yusdToken.balanceOf(msg.sender) <= totals.totalYUSDSupplyAtStart, "TMR:Redeemer YUSD Bal too high");

        totals.remainingYUSD = _YUSDamount;
        require(_isValidFirstRedemptionHint(contractsCache.sortedTroves, hints.target), "TMR:Invalid first redemption hint");
        require(troveManager.getCurrentICR(hints.target) >= MCR, "TMR:Trove is underwater");
        troveManager.applyPendingRewards(hints.target);

        // Stitched in _redeemCollateralFromTrove
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        SingleRedemptionValues memory singleRedemption;
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        uint troveDebt = troveManager.getTroveDebt(hints.target);
        singleRedemption.YUSDLot = LiquityMath._min(
            totals.remainingYUSD,
            troveDebt.sub(YUSD_GAS_COMPENSATION)
        );

        newColls memory colls;
        (colls.tokens, colls.amounts, ) = troveManager.getCurrentTroveState(hints.target);

        uint256 i; //FYI: i term will be used as the index of the collateral to redeem later too
        uint256 tokensLen = colls.tokens.length;
        {//Limit scope
            //Make sure single collateral to redeem exists in trove
            bool foundCollateral;
            
            for (i = 0; i < tokensLen; ++i) {
                if (colls.tokens[i] == _collToRedeem) {
                    foundCollateral = true;
                    break;
                }
            }
            require(foundCollateral, "TMR:Coll not in trove");
        }

        {// Limit scope
            uint256 singleCollUSD = whitelist.getValueUSD(_collToRedeem, colls.amounts[i]); //Get usd value of only the collateral being redeemed
            
            //Cap redemption amount to the max amount of collateral that can be redeemed
            singleRedemption.YUSDLot = LiquityMath._min(
                singleCollUSD,
                singleRedemption.YUSDLot
            );
            

            // redemption addresses are the same as coll addresses for trove
            // Calculation for how much collateral to send of each type. 
            singleRedemption.CollLot.tokens = colls.tokens;
            singleRedemption.CollLot.amounts = new uint256[](tokensLen);
            
            uint tokenAmountToRedeem = singleRedemption.YUSDLot.mul(colls.amounts[i]).div(singleCollUSD);
            colls.amounts[i] = colls.amounts[i].sub(tokenAmountToRedeem);
            singleRedemption.CollLot.amounts[i] = tokenAmountToRedeem;
        }

        
        // Decrease the debt and collateral of the current Trove according to the YUSD lot and corresponding Collateral to send
        troveDebt = troveDebt.sub(singleRedemption.YUSDLot);
        

        if (troveDebt == YUSD_GAS_COMPENSATION) {
            // No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
            troveManager.removeStakeTMR(hints.target);
            troveManager.closeTroveRedemption(hints.target);
            _redeemCloseTrove(
                contractsCache,
                hints.target,
                YUSD_GAS_COMPENSATION,
                colls.tokens,
                colls.amounts
            );

            address[] memory emptyTokens = new address[](0);
            uint256[] memory emptyAmounts = new uint256[](0);

            emit TroveUpdated(
                hints.target,
                0,
                emptyTokens,
                emptyAmounts,
                TroveManagerOperation.redeemCollateral
            );
        } else {
            
            uint256 newICR = LiquityMath._computeCR(_getVC(colls.tokens, colls.amounts), troveDebt);

            /*
            * If the provided hint is too inaccurate of date, we bail since trying to reinsert without a good hint will almost
            * certainly result in running out of gas. Arbitrary measures of this mean newICR must be greater than hint ICR - 2%, 
            * and smaller than hint ICR + 2%.
            *
            * If the resultant net debt of the partial is less than the minimum, net debt we bail.
            */
            {//Stack scope
                if (newICR >= hints.icr.add(2e16) || 
                    newICR <= hints.icr.sub(2e16) || 
                    _getNetDebt(troveDebt) < MIN_NET_DEBT) {
                    revert("Invalid partial redemption hint or remaining debt is too low");
                    // singleRedemption.cancelledPartial = true;
                    // return singleRedemption;
                }
            
                contractsCache.sortedTroves.reInsert(
                    hints.target,
                    newICR,
                    hints.upper,
                    hints.lower
                );
            }
            troveManager.updateTroveDebt(hints.target, troveDebt);
            // for (uint256 k = 0; k < colls.tokens.length; k++) {
            //     colls.amounts[k] = finalAmounts[k];
            // }
            troveManager.updateTroveCollTMR(hints.target, colls.tokens, colls.amounts);
            troveManager.updateStakeAndTotalStakes(hints.target);

            emit TroveUpdated(
                hints.target,
                troveDebt,
                colls.tokens,
                colls.amounts,
                TroveManagerOperation.redeemCollateral
            );
        }
    
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////


        totals.totalYUSDToRedeem = singleRedemption.YUSDLot; 

        totals.CollsDrawn = singleRedemption.CollLot;
        // totals.remainingYUSD = totals.remainingYUSD.sub(singleRedemption.YUSDLot);

        require(isNonzero(totals.CollsDrawn), "TMR: non zero collsDrawn");
        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total YUSD supply value, from before it was reduced by the redemption.
        _updateBaseRateFromRedemption(totals.totalYUSDToRedeem, totals.totalYUSDSupplyAtStart);

        totals.YUSDfee = _getRedemptionFee(totals.totalYUSDToRedeem);
        // check user has enough YUSD to pay fee and redemptions
        _requireYUSDBalanceCoversRedemption(
            contractsCache.yusdToken,
            msg.sender,
            totals.remainingYUSD.add(totals.YUSDfee)
        );

        // check to see that the fee doesn't exceed the max fee
        _requireUserAcceptsFeeRedemption(totals.YUSDfee, _YUSDMaxFee);

        // send fee from user to YETI stakers
        contractsCache.yusdToken.safeTransferFrom(
            msg.sender,
            address(contractsCache.sYETI),
            totals.YUSDfee
        );

        emit Redemption(
            totals.remainingYUSD,
            totals.totalYUSDToRedeem,
            totals.YUSDfee,
            totals.CollsDrawn.tokens,
            totals.CollsDrawn.amounts
        );
        // Burn the total YUSD that is cancelled with debt
        contractsCache.yusdToken.burn(msg.sender, totals.totalYUSDToRedeem);
        // Update Active Pool YUSD, and send Collaterals to account
        contractsCache.activePool.decreaseYUSDDebt(totals.totalYUSDToRedeem);

        contractsCache.activePool.sendCollateralsUnwrap(
            hints.target, // rewards from
            msg.sender, // tokens to
            totals.CollsDrawn.tokens,
            totals.CollsDrawn.amounts
        );
    }

    /** 
     * Redeem as much collateral as possible from _borrower's Trove in exchange for YUSD up to _maxYUSDamount
     * Special calculation for determining how much collateral to send of each type to send. 
     * We want to redeem equivalent to the USD value instead of the VC value here, so we take the YUSD amount
     * which we are redeeming from this trove, and calculate the ratios at which we would redeem a single 
     * collateral type compared to all others. 
     * For example if we are redeeming 10,000 from this trove, and it has collateral A with a safety ratio of 1, 
     * collateral B with safety ratio of 0.5. Let's say their price is each 1. The trove is composed of 10,000 A and 
     * 10,000 B, so we would redeem 5,000 A and 5,000 B, instead of 6,666 A and 3,333 B. To do calculate this we take 
     * the USD value of that collateral type, and divide it by the total USD value of all collateral types. The price 
     * actually cancels out here so we just do YUSD amount * token amount / total USD value, instead of
     * YUSD amount * token value / total USD value / token price, since we are trying to find token amount.
     */
    function _redeemCollateralFromTrove(
        ContractsCache memory _contractsCache,
        address _borrower,
        uint256 _maxYUSDAmount,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintICR
    ) internal returns (SingleRedemptionValues memory singleRedemption) {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        singleRedemption.YUSDLot = LiquityMath._min(
            _maxYUSDAmount,
            troveManager.getTroveDebt(_borrower).sub(YUSD_GAS_COMPENSATION)
        );

        newColls memory colls;
        (colls.tokens, colls.amounts, ) = troveManager.getCurrentTroveState(_borrower);

        uint256 collsLen = colls.tokens.length;
        uint256[] memory finalAmounts = new uint256[](collsLen);


        // redemption addresses are the same as coll addresses for trove
        // Calculation for how much collateral to send of each type. 
        singleRedemption.CollLot.tokens = colls.tokens;
        singleRedemption.CollLot.amounts = new uint256[](collsLen);
        { // limit scope

            uint256 totalCollUSD = _getUSDColls(colls);
            uint256 baseLot = singleRedemption.YUSDLot.mul(DECIMAL_PRECISION);
            for (uint256 i; i < collsLen; ++i) {
                uint tokenAmountToRedeem = baseLot.mul(colls.amounts[i]).div(totalCollUSD).div(1e18);
                finalAmounts[i] = colls.amounts[i].sub(tokenAmountToRedeem);
                singleRedemption.CollLot.amounts[i] = tokenAmountToRedeem;
                // For wrapped assets, update the wrapped token reward to this contract temporarily 
                // to consolidate all trove's rewards. This is transferred all to the redeemer later. 
                if (whitelist.isWrapped(colls.tokens[i])) {
                    IWAsset(colls.tokens[i]).updateReward(_borrower, address(this), tokenAmountToRedeem);
                }
            }
        }

        // Decrease the debt and collateral of the current Trove according to the YUSD lot and corresponding Collateral to send
        uint256 newDebt = (troveManager.getTroveDebt(_borrower)).sub(singleRedemption.YUSDLot);
        uint256 newColl = _getVC(colls.tokens, finalAmounts); // VC given newAmounts in trove

        if (newDebt == YUSD_GAS_COMPENSATION) {
            // No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
            troveManager.removeStakeTMR(_borrower);
            troveManager.closeTroveRedemption(_borrower);
            _redeemCloseTrove(
                _contractsCache,
                _borrower,
                YUSD_GAS_COMPENSATION,
                colls.tokens,
                finalAmounts
            );

            address[] memory emptyTokens = new address[](0);
            uint256[] memory emptyAmounts = new uint256[](0);

            emit TroveUpdated(
                _borrower,
                0,
                emptyTokens,
                emptyAmounts,
                TroveManagerOperation.redeemCollateral
            );
        } else {
            uint256 newICR = LiquityMath._computeCR(newColl, newDebt);

            /*
             * If the provided hint is too inaccurate of date, we bail since trying to reinsert without a good hint will almost
             * certainly result in running out of gas. Arbitrary measures of this mean newICR must be greater than hint ICR - 2%, 
             * and smaller than hint ICR + 2%.
             *
             * If the resultant net debt of the partial is less than the minimum, net debt we bail.
             */

            if (newICR >= _partialRedemptionHintICR.add(2e16) || 
                newICR <= _partialRedemptionHintICR.sub(2e16) || 
                _getNetDebt(newDebt) < MIN_NET_DEBT) {
                singleRedemption.cancelledPartial = true;
                return singleRedemption;
            }

            _contractsCache.sortedTroves.reInsert(
                _borrower,
                newICR,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint
            );

            troveManager.updateTroveDebt(_borrower, newDebt);
            uint256 collsLen = colls.tokens.length;
            for (uint256 i; i < collsLen; ++i) {
                colls.amounts[i] = finalAmounts[i];
            }
            troveManager.updateTroveCollTMR(_borrower, colls.tokens, colls.amounts);
            troveManager.updateStakeAndTotalStakes(_borrower);

            emit TroveUpdated(
                _borrower,
                newDebt,
                colls.tokens,
                finalAmounts,
                TroveManagerOperation.redeemCollateral
            );
        }
    }

    /*
     * Called when a full redemption occurs, and closes the trove.
     * The redeemer swaps (debt - liquidation reserve) YUSD for (debt - liquidation reserve) worth of Collateral, so the YUSD liquidation reserve left corresponds to the remaining debt.
     * In order to close the trove, the YUSD liquidation reserve is burned, and the corresponding debt is removed from the active pool.
     * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
     * Any surplus Collateral left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
     */
    function _redeemCloseTrove(
        ContractsCache memory _contractsCache,
        address _borrower,
        uint256 _YUSD,
        address[] memory _remainingColls,
        uint256[] memory _remainingCollsAmounts
    ) internal {
        _contractsCache.yusdToken.burn(gasPoolAddress, _YUSD);
        // Update Active Pool YUSD, and send Collateral to account
        _contractsCache.activePool.decreaseYUSDDebt(_YUSD);

        // send Collaterals from Active Pool to CollSurplus Pool
        _contractsCache.collSurplusPool.accountSurplus(
            _borrower,
            _remainingColls,
            _remainingCollsAmounts
        );
        _contractsCache.activePool.sendCollaterals(
            address(_contractsCache.collSurplusPool),
            _remainingColls,
            _remainingCollsAmounts
        );
    }

    /*
     * This function has two impacts on the baseRate state variable:
     * 1) decays the baseRate based on time passed since last redemption or YUSD borrowing operation.
     * then,
     * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
     */
    function _updateBaseRateFromRedemption(uint256 _YUSDDrawn, uint256 _totalYUSDSupply)
        internal
        returns (uint256)
    {
        uint256 decayedBaseRate = troveManager.calcDecayedBaseRate();

        /* Convert the drawn Collateral back to YUSD at face value rate (1 YUSD:1 USD), in order to get
         * the fraction of total supply that was redeemed at face value. */
        uint256 redeemedYUSDFraction = _YUSDDrawn.mul(10e18).div(_totalYUSDSupply);

        uint256 newBaseRate = decayedBaseRate.add(redeemedYUSDFraction.div(BETA));
        newBaseRate = LiquityMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%

        troveManager.updateBaseRate(newBaseRate);
        return newBaseRate;
    }

    function _isValidFirstRedemptionHint(ISortedTroves _sortedTroves, address _firstRedemptionHint)
        internal
        view
        returns (bool)
    {
        if (
            _firstRedemptionHint == address(0) ||
            !_sortedTroves.contains(_firstRedemptionHint) ||
            troveManager.getCurrentICR(_firstRedemptionHint) < MCR
        ) {
            return false;
        }

        address nextTrove = _sortedTroves.getNext(_firstRedemptionHint);
        return nextTrove == address(0) || troveManager.getCurrentICR(nextTrove) < MCR;
    }

    function _requireUserAcceptsFeeRedemption(uint256 _actualFee, uint256 _maxFee) internal pure {
        require(_actualFee <= _maxFee, "TMR:User must accept fee");
    }

    function _requireValidMaxFee(uint256 _YUSDAmount, uint256 _maxYUSDFee) internal pure {
        uint256 _maxFeePercentage = _maxYUSDFee.mul(DECIMAL_PRECISION).div(_YUSDAmount);
        require(_maxFeePercentage >= REDEMPTION_FEE_FLOOR, "TMR:Passed in max fee <0.5%");
        require(_maxFeePercentage <= DECIMAL_PRECISION, "TMR:Passed in max fee >100%");
    }

    function _requireAfterBootstrapPeriod() internal view {
        uint256 systemDeploymentTime = yetiTokenContract.getDeploymentStartTime();
        require(
            block.timestamp >= systemDeploymentTime + BOOTSTRAP_PERIOD,
            "TMR:NoRedemptionsDuringBootstrap"
        );
    }

    function _requireTCRoverMCR() internal view {
        require(_getTCR() >= MCR, "TMR: Cannot redeem when TCR<MCR");
    }

    function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
        require(_amount != 0, "TMR:ReqNonzeroAmount");
    }

    function _requireYUSDBalanceCoversRedemption(
        IYUSDToken _yusdToken,
        address _redeemer,
        uint256 _amount
    ) internal view {
        require(
            _yusdToken.balanceOf(_redeemer) >= _amount,
            "TMR:InsufficientYUSDBalance"
        );
    }

    function isNonzero(newColls memory coll) internal pure returns (bool) {
        uint256 collsLen = coll.amounts.length;
        for (uint256 i; i < collsLen; ++i) {
            if (coll.amounts[i] != 0) {
                return true;
            }
        }
        return false;
    }

    function _requireCallerisTroveManager() internal view {
        require(msg.sender == address(troveManager), "TMR:Caller not TM");
    }

    function _getRedemptionFee(uint256 _YUSDRedeemed) internal view returns (uint256) {
        return _calcRedemptionFee(troveManager.getRedemptionRate(), _YUSDRedeemed);
    }

    function _calcRedemptionFee(uint256 _redemptionRate, uint256 _YUSDRedeemed)
        internal
        pure
        returns (uint256)
    {
        uint256 redemptionFee = _redemptionRate.mul(_YUSDRedeemed).div(DECIMAL_PRECISION);
        require(
            redemptionFee < _YUSDRedeemed,
            "TM: Fee > YUSD Redeemed"
        );
        return redemptionFee;
    }

    function _calcRedemptionRate(uint256 _baseRate) internal pure returns (uint256) {
        return
            LiquityMath._min(
                REDEMPTION_FEE_FLOOR.add(_baseRate),
                DECIMAL_PRECISION // cap at a maximum of 100%
            );
    }
}
