/*
    Copyright 2022 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IController } from "../../../interfaces/IController.sol";
import { IMarketRegistry } from "../../../interfaces/external/perp-v2/IMarketRegistry.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { IQuoter } from "../../../interfaces/external/perp-v2/IQuoter.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { IVault } from "../../../interfaces/external/perp-v2/IVault.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { PerpV2LeverageModuleV2 } from "./PerpV2LeverageModuleV2.sol";
import { Position } from "../../lib/Position.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";

/**
 * @title PerpV2BasisTradingModule
 * @author Set Protocol
 *
 * @notice Smart contract that extends functionality offered by PerpV2LeverageModuleV2. It tracks funding that is settled due to
 * actions on Perpetual protocol and allows it to be withdrawn by the manager. The withdrawn funding can be reinvested in the Set
 * to create a yield generating basis trading product. The manager can also collect performance fees on the withdrawn funding.
 *
 * NOTE: The external position unit is only updated on an as-needed basis during issuance/redemption. It does not reflect the current
 * value of the Set's perpetual position. The current value can be calculated from getPositionNotionalInfo.
 */
contract PerpV2BasisTradingModule is PerpV2LeverageModuleV2 {

    /* ============ Structs ============ */

    struct FeeState {
        address feeRecipient;                     // Address to accrue fees to
        uint256 maxPerformanceFeePercentage;      // Max performance fee manager commits to using (1% = 1e16, 100% = 1e18)
        uint256 performanceFeePercentage;         // Performance fees accrued to manager (1% = 1e16, 100% = 1e18)
    }

    /* ============ Events ============ */

    /**
     * @dev Emitted on performance fee update
     * @param _setToken             Instance of SetToken
     * @param _newPerformanceFee    New performance fee percentage (1% = 1e16)
     */
    event PerformanceFeeUpdated(ISetToken indexed _setToken, uint256 _newPerformanceFee);

    /**
     * @dev Emitted on fee recipient update
     * @param _setToken             Instance of SetToken
     * @param _newFeeRecipient      New performance fee recipient
     */
    event FeeRecipientUpdated(ISetToken indexed _setToken, address _newFeeRecipient);

    /**
     * @dev Emitted on funding withdraw
     * @param _setToken             Instance of SetToken
     * @param _collateralToken      Token being withdrawn as funding (USDC)
     * @param _amountWithdrawn      Amount of funding being withdrawn from Perp (USDC)
     * @param _managerFee           Amount of performance fee accrued to manager (USDC)
     * @param _protocolFee          Amount of performance fee accrued to protocol (USDC)
     */
    event FundingWithdrawn(
        ISetToken indexed  _setToken,
        IERC20 _collateralToken,
        uint256 _amountWithdrawn,
        uint256 _managerFee,
        uint256 _protocolFee
    );

    /* ============ Constants ============ */

    // 1 index stores protocol performance fee % on the controller, charged in the _handleFees function
    uint256 private constant PROTOCOL_PERFORMANCE_FEE_INDEX = 1;

    /* ============ State Variables ============ */

    // Mapping to store fee settings for each SetToken
    mapping(ISetToken => FeeState) public feeSettings;

    // Mapping to store funding that has been settled on Perpetual Protocol due to actions via this module
    // and hasn't been withdrawn for reinvesting yet. Values are stored in precise units (10e18).
    mapping(ISetToken => uint256) public settledFunding;

    /* ============ Constructor ============ */

    /**
     * @dev Sets external PerpV2 Protocol contract addresses. Calls PerpV2LeverageModuleV2 constructor which sets `collateralToken`
     * and `collateralDecimals` to the Perp vault's settlement token (USDC) and its decimals, respectively.
     *
     * @param _controller               Address of controller contract
     * @param _perpVault                Address of Perp Vault contract
     * @param _perpQuoter               Address of Perp Quoter contract
     * @param _perpMarketRegistry       Address of Perp MarketRegistry contract
     * @param _maxPerpPositionsPerSet   Max perpetual positions in one SetToken
     */
    constructor(
        IController _controller,
        IVault _perpVault,
        IQuoter _perpQuoter,
        IMarketRegistry _perpMarketRegistry,
        uint256 _maxPerpPositionsPerSet
    )
        public
        PerpV2LeverageModuleV2(
            _controller,
            _perpVault,
            _perpQuoter,
            _perpMarketRegistry,
            _maxPerpPositionsPerSet
        )
    {}

    /* ============ External Functions ============ */

    /**
     * @dev Reverts upon calling. Use `initialize(_setToken, _settings)` instead.
     */
    function initialize(ISetToken /*_setToken*/) public override(PerpV2LeverageModuleV2) {
        revert("Use initialize(_setToken, _settings) instead");
    }

    /**
     * @dev MANAGER ONLY: Initializes this module to the SetToken and sets fee settings. Either the SetToken needs to
     * be on the allowed list or anySetAllowed needs to be true.
     *
     * @param _setToken             Instance of the SetToken to initialize
     * @param _settings             FeeState struct defining performance fee settings
     */
    function initialize(
        ISetToken _setToken,
        FeeState memory _settings
    )
        external
    {
        _validateFeeState(_settings);

        // Initialize by calling PerpV2LeverageModuleV2#initialize.
        // Verifies caller is manager. Verifies Set is valid, allowed and in pending state.
        PerpV2LeverageModuleV2.initialize(_setToken);

        feeSettings[_setToken] = _settings;
    }

    /**
     * @dev MANAGER ONLY: Similar to PerpV2LeverageModuleV2#trade. Allows manager to buy or sell perps to change exposure
     * to the underlying baseToken. Any pending funding that would be settled during opening a position on Perpetual
     * protocol is added to (or subtracted from) `settledFunding[_setToken]` and can be withdrawn later using
     * `withdrawFundingAndAccrueFees` by the SetToken manager.
     * NOTE: Calling a `nonReentrant` function from another `nonReentrant` function is not supported. Hence, we can't
     * add the `nonReentrant` modifier here because `PerpV2LeverageModuleV2#trade` function has a reentrancy check.
     * NOTE: This method doesn't update the externalPositionUnit because it is a function of UniswapV3 virtual
     * token market prices and needs to be generated on the fly to be meaningful.
     *
     * @param _setToken                     Instance of the SetToken
     * @param _baseToken                    Address virtual token being traded
     * @param _baseQuantityUnits            Quantity of virtual token to trade in position units
     * @param _quoteBoundQuantityUnits      Max/min of vQuote asset to pay/receive when buying or selling
     */
    function tradeAndTrackFunding(
        ISetToken _setToken,
        address _baseToken,
        int256 _baseQuantityUnits,
        uint256 _quoteBoundQuantityUnits
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        // Track funding before it is settled
        _updateSettledFunding(_setToken);

        // Trade using PerpV2LeverageModuleV2#trade.
        PerpV2LeverageModuleV2.trade(
            _setToken,
            _baseToken,
            _baseQuantityUnits,
            _quoteBoundQuantityUnits
        );
    }

    /**
     * @dev MANAGER ONLY: Withdraws collateral token from the PerpV2 Vault to a default position on the SetToken.
     * This method is useful when adjusting the overall composition of a Set which has a Perp account external
     * position as one of several components. Any pending funding that would be settled during withdrawl on Perpetual
     * protocol is added to (or subtracted from) `settledFunding[_setToken]` and can be withdrawn later using
     * `withdrawFundingAndAccrueFees` by the SetToken manager.
     *
     * NOTE: Within PerpV2, `withdraw` settles `owedRealizedPnl` and any pending funding payments to the Perp vault
     * prior to transfer.
     *
     * @param  _setToken                    Instance of the SetToken
     * @param  _collateralQuantityUnits     Quantity of collateral to withdraw in position units
     */
    function withdraw(
      ISetToken _setToken,
      uint256 _collateralQuantityUnits
    )
      public
      override
      nonReentrant
      onlyManagerAndValidSet(_setToken)
    {
        require(_collateralQuantityUnits > 0, "Withdraw amount is 0");

        _updateSettledFunding(_setToken);

        uint256 notionalWithdrawnQuantity = _withdrawAndUpdatePositions(_setToken, _collateralQuantityUnits);

        emit CollateralWithdrawn(_setToken, collateralToken, notionalWithdrawnQuantity);
    }

    /**
     * @dev MANAGER ONLY: Withdraws tracked settled funding (in USDC) from the PerpV2 Vault to a default position
     * on the SetToken. Collects manager and protocol performance fees on the withdrawn amount.
     * This method is useful when withdrawing funding to be reinvested into the Basis Trading product.
     * Allows the manager to withdraw entire funding accrued by setting `_notionalFunding` to MAX_UINT_256.
     *
     * NOTE: Within PerpV2, `withdraw` settles `owedRealizedPnl` and any pending funding payments
     * to the Perp vault prior to transfer.
     *
     * @param _setToken                 Instance of the SetToken
     * @param _notionalFunding          Notional amount of funding to withdraw (in USDC decimals)
     */
    function withdrawFundingAndAccrueFees(
        ISetToken _setToken,
        uint256 _notionalFunding
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        if (_notionalFunding == 0) return;

        uint256 newSettledFunding = _updateSettledFunding(_setToken);

        uint256 settledFundingInCollateralDecimals = newSettledFunding.fromPreciseUnitToDecimals(collateralDecimals);

        if (_notionalFunding > settledFundingInCollateralDecimals) { _notionalFunding = settledFundingInCollateralDecimals; }

        uint256 collateralBalanceBeforeWithdraw = collateralToken.balanceOf(address(_setToken));

        _withdraw(_setToken, _notionalFunding);

        (uint256 managerFee, uint256 protocolFee) = _handleFees(_setToken, _notionalFunding);

        _updateWithdrawFundingState(_setToken, _notionalFunding, collateralBalanceBeforeWithdraw);

        emit FundingWithdrawn(_setToken, collateralToken, _notionalFunding, managerFee, protocolFee);
    }

    /**
     * @dev SETTOKEN ONLY: Removes this module from the SetToken, via call by the SetToken. Deletes
     * position mappings and fee states associated with SetToken. Resets settled funding to zero.
     * Fees are not accrued in case the reason for removing the module is related to fee accrual.
     *
     * NOTE: Function will revert if there is greater than a position unit amount of USDC of account value.
     */
    function removeModule() public override(PerpV2LeverageModuleV2) {
        // Call PerpV2LeverageModuleV2#removeModule to delete positions mapping and unregister on other modules.
        // Verifies Set is valid and initialized.
        PerpV2LeverageModuleV2.removeModule();

        ISetToken setToken = ISetToken(msg.sender);

        // Not charging any fees
        delete feeSettings[setToken];
        delete settledFunding[setToken];
    }

    /**
     * @dev MODULE ONLY: Hook called prior to issuance. Only callable by valid module. Should only be called ONCE
     * during issue. Trades into current positions and sets the collateralToken's externalPositionUnit so that
     * issuance module can transfer in the right amount of collateral accounting for accrued fees/pnl and slippage
     * incurred during issuance. Any pending funding payments and accrued owedRealizedPnl are attributed to current
     * Set holders. Any pending funding payment that would be settled during trading into positions on Perpetual
     * protocol is added to (or subtracted from) `settledFunding[_setToken]` and can be withdrawn later by the manager.
     *
     * @param _setToken             Instance of the SetToken
     * @param _setTokenQuantity     Quantity of Set to issue
     */
    function moduleIssueHook(
        ISetToken _setToken,
        uint256 _setTokenQuantity
    )
        public
        override(PerpV2LeverageModuleV2)
        onlyModule(_setToken)
    {
        // Track funding before it is settled
        _updateSettledFunding(_setToken);

        // Call PerpV2LeverageModuleV2#moduleIssueHook to set external position unit.
        // Validates caller is module.
        PerpV2LeverageModuleV2.moduleIssueHook(_setToken, _setTokenQuantity);
    }

    /**
     * @dev MODULE ONLY: Hook called prior to redemption in the issuance module. Trades out of existing
     * positions to make redemption capital withdrawable from PerpV2 vault. Sets the `externalPositionUnit`
     * equal to the realizable value of account in position units (as measured by the trade outcomes for
     * this redemption) net performance fees to be paid by the redeemer for his share of positive funding yield.
     * Any `owedRealizedPnl` and pending funding payments are socialized in this step so that redeemer
     * pays/receives their share of them. Should only be called ONCE during redeem. Any pending funding payment
     * that would be settled during trading out of positions on Perpetual protocol is added to (or subtracted from)
     * `settledFunding[_setToken]` and can be withdrawn later by the manager.
     *
     * @param _setToken             Instance of the SetToken
     * @param _setTokenQuantity     Quantity of SetToken to redeem
     */
    function moduleRedeemHook(
        ISetToken _setToken,
        uint256 _setTokenQuantity
    )
        external
        override(PerpV2LeverageModuleV2)
        onlyModule(_setToken)
    {
        if (_setToken.totalSupply() == 0) return;
        if (!_setToken.hasExternalPosition(address(collateralToken))) return;

        // Track funding before it is settled
        uint256 newSettledFunding = _updateSettledFunding(_setToken);

        int256 newExternalPositionUnit = _executePositionTrades(_setToken, _setTokenQuantity, false, false);

        int256 newExternalPositionUnitNetFees = _calculateNetFeesPositionUnit(_setToken, newExternalPositionUnit, newSettledFunding);

        // Set USDC externalPositionUnit such that DIM can use it for transfer calculation
        _setToken.editExternalPositionUnit(
            address(collateralToken),
            address(this),
            newExternalPositionUnitNetFees
        );
    }

    /* ============ External Setter Functions ============ */

    /**
     * @dev MANAGER ONLY. Update performance fee percentage.
     *
     * Note: This function requires settled funding (in USD) to be zero. Call `withdrawFundingAndAccrueFees()` with `_notionalAmount`
     * equals MAX_UINT_256 to withdraw all existing settled funding and set settled funding to zero. Funding accrues slowly, so calling
     * this function within a reasonable duration after `withdrawFundingAndAccrueFees` is called, should work in practice.
     *
     * @param _setToken         Instance of SetToken
     * @param _newFee           New performance fee percentage in precise units (1e16 = 1%)
     */
    function updatePerformanceFee(
        ISetToken _setToken,
        uint256 _newFee
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        require(_newFee <= feeSettings[_setToken].maxPerformanceFeePercentage, "Fee must be less than max");

        // We require `settledFunding[_setToken]` to be zero. Hence, we do not call `_updateSettledFunding` here, which
        // eases the UX of updating performance fees for the manager. Although, manager loses the ability to collect fees
        // on pending funding that has been accrued on PerpV2 but not tracked on this module.

        // Assert all settled funding (in USD) has been withdrawn. Comparing USD amount allows us to neglect small
        // dust amounts that aren't withdrawable.
        require(
            settledFunding[_setToken].fromPreciseUnitToDecimals(collateralDecimals) == 0,
            "Non-zero settled funding remains"
        );

        feeSettings[_setToken].performanceFeePercentage = _newFee;

        emit PerformanceFeeUpdated(_setToken, _newFee);
    }

    /**
     * @dev MANAGER ONLY. Update performance fee recipient (address to which performance fees are sent).
     *
     * @param _setToken             Instance of SetToken
     * @param _newFeeRecipient      Address of new fee recipient
     */
    function updateFeeRecipient(ISetToken _setToken, address _newFeeRecipient)
        external
        onlyManagerAndValidSet(_setToken)
    {
        require(_newFeeRecipient != address(0), "Fee Recipient must be non-zero address");

        feeSettings[_setToken].feeRecipient = _newFeeRecipient;

        emit FeeRecipientUpdated(_setToken, _newFeeRecipient);
    }


    /* ============ External Getter Functions ============ */

    /**
     * @dev Gets the positive equity collateral externalPositionUnit that would be calculated for
     * redeeming a quantity of SetToken representing the amount of collateral returned per SetToken.
     * Values in the returned arrays map to the same index in the SetToken's components array.
     *
     * @param _setToken             Instance of SetToken
     * @param _setTokenQuantity     Number of sets to redeem
     *
     * @return equityAdjustments array containing a single element and an empty debtAdjustments array
     */
    function getRedemptionAdjustments(
        ISetToken _setToken,
        uint256 _setTokenQuantity
    )
        external
        override(PerpV2LeverageModuleV2)
        returns (int256[] memory, int256[] memory _)
    {
        int256 newExternalPositionUnitNetFees = 0;

        if (positions[_setToken].length > 0) {

            uint256 updatedSettledFunding = getUpdatedSettledFunding(_setToken);

            int256 newExternalPositionUnit = _executePositionTrades(_setToken, _setTokenQuantity, false, true);

            newExternalPositionUnitNetFees = _calculateNetFeesPositionUnit(_setToken, newExternalPositionUnit, updatedSettledFunding);
        }

        return _formatAdjustments(_setToken, newExternalPositionUnitNetFees);
    }

    /**
     * @dev Adds pending funding payment to tracked settled funding. Returns updated settled funding value in precise units (10e18).
     *
     * NOTE: Tracked settled funding value can not be less than zero, hence it is reset to zero if pending funding
     * payment is negative and |pending funding payment| >= |settledFunding[_setToken]|.
     *
     * NOTE: Returned updated settled funding value is correct only for the current block since pending funding payment
     * updates every block.
     *
     * @param _setToken             Instance of SetToken
     */
    function getUpdatedSettledFunding(ISetToken _setToken) public view returns (uint256) {
        // NOTE: pendingFundingPayments are represented as in the Perp system as "funding owed"
        // e.g a positive number is a debt which gets subtracted from owedRealizedPnl on settlement.
        // We are flipping its sign here to reflect its settlement value.
        int256 pendingFundingToBeSettled =  perpExchange.getAllPendingFundingPayment(address(_setToken)).neg();

        if (pendingFundingToBeSettled >= 0) {
            return settledFunding[_setToken].add(pendingFundingToBeSettled.toUint256());
        }

        if (settledFunding[_setToken] > pendingFundingToBeSettled.abs()) {
            return settledFunding[_setToken].sub(pendingFundingToBeSettled.abs());
        }

        return 0;
    }

    /* ============ Internal Functions ============ */

    /**
     * @dev Updates tracked settled funding. Once funding is settled to `owedRealizedPnl` on Perpetual protocol, it is difficult to
     * extract out the funding value again on-chain. This function is called in an external function and is used to track and store
     * pending funding payment that is about to be settled due to subsequent logic in the external function.
     *
     * @param _setToken             Instance of SetToken
     * @return uint256              Returns the updated settled funding value
     */
    function _updateSettledFunding(ISetToken _setToken) internal returns (uint256) {
        uint256 newSettledFunding = getUpdatedSettledFunding(_setToken);
        settledFunding[_setToken] = newSettledFunding;
        return newSettledFunding;
    }

    /**
     * @dev Calculates manager and protocol fees on withdrawn funding amount and transfers them to
     * their respective recipients (in USDC).
     *
     * @param _setToken                     Instance of SetToken
     * @param _notionalFundingAmount        Notional funding amount on which fees is charged
     *
     * @return managerFee      Manager performance fees
     * @return protocolFee     Protocol performance fees
     */
    function _handleFees(
        ISetToken _setToken,
        uint256 _notionalFundingAmount
    )
        internal
        returns (uint256 managerFee, uint256 protocolFee)
    {
        uint256 performanceFee = feeSettings[_setToken].performanceFeePercentage;

        if (performanceFee > 0) {
            uint256 protocolFeeSplit = controller.getModuleFee(address(this), PROTOCOL_PERFORMANCE_FEE_INDEX);

            uint256 totalFee = performanceFee.preciseMul(_notionalFundingAmount);
            protocolFee = totalFee.preciseMul(protocolFeeSplit);
            managerFee = totalFee.sub(protocolFee);

            _setToken.strictInvokeTransfer(address(collateralToken), feeSettings[_setToken].feeRecipient, managerFee);
            payProtocolFeeFromSetToken(_setToken, address(collateralToken), protocolFee);
        }

        return (managerFee, protocolFee);
    }

    /**
     * @dev Updates collateral token default position unit and tracked settled funding. Used in `withdrawFundingAndAccrueFees()`
     *
     * @param _setToken                         Instance of the SetToken
     * @param _notionalFunding                  Amount of funding withdrawn (in USDC decimals)
     * @param _collateralBalanceBeforeWithdraw  Balance of collateral token in the Set before withdrawing more USDC from Perp
     */
    function _updateWithdrawFundingState(ISetToken _setToken, uint256 _notionalFunding, uint256 _collateralBalanceBeforeWithdraw) internal {
        // Update default position unit to add the withdrawn funding (in USDC)
        _setToken.calculateAndEditDefaultPosition(
            address(collateralToken),
            _setToken.totalSupply(),
            _collateralBalanceBeforeWithdraw
        );

        _updateExternalPositionUnit(_setToken);

        // Subtract withdrawn funding from tracked settled funding
        settledFunding[_setToken] = settledFunding[_setToken].sub(
            _notionalFunding.toPreciseUnitsFromDecimals(collateralDecimals)
        );
    }

    /**
     * @dev Returns external position unit net performance fees. Calculates performance fees unit and subtracts it from `_newExternalPositionUnit`.
     *
     * @param _setToken                     Instance of SetToken
     * @param _newExternalPositionUnit      New external position unit calculated using `_executePositionTrades`
     * @param _updatedSettledFunding        Updated track settled funding value
     */
    function _calculateNetFeesPositionUnit(
        ISetToken _setToken,
        int256 _newExternalPositionUnit,
        uint256 _updatedSettledFunding
    )
        internal view returns (int256)
    {
        if (_updatedSettledFunding == 0) {
            return _newExternalPositionUnit;
        }

        // Calculate performance fee unit; Performance fee unit = (Tracked settled funding * Performance fee) / Set total supply
        uint256 performanceFeeUnit = _updatedSettledFunding
            .preciseDiv(_setToken.totalSupply())
            .preciseMulCeil(_performanceFeePercentage(_setToken))
            .fromPreciseUnitToDecimals(collateralDecimals);

        // Subtract performance fee unit from `_newExternalPositionUnit` to get `newExternalPositionUnitNetFees`.
        // Issuance module calculates equity amount by multiplying position unit with `_setTokenQuanity`, so,
        // equity amount = newExternalPositionUnitNetFees * _setTokenQuantity = (_newExternalPositionUnit - performanceFeeUnit) * _setTokenQuantity
        // where, `performanceFeeUnit * _setTokenQuantity` is share of the total performance fee to be paid by the redeemer.
        int newExternalPositionUnitNetFees = _newExternalPositionUnit.sub(performanceFeeUnit.toInt256());

        // Ensure the returned position unit is >= 0. Module is market neutral and some combination of high performance fee,
        // high yield, and low position values could lead to the position unit being negative.
        if (newExternalPositionUnitNetFees < 0) { newExternalPositionUnitNetFees = 0; }

        return newExternalPositionUnitNetFees;
    }

    /**
     * @dev Validates fee settings.
     *
     * @param _settings     FeeState struct containing performance fee settings
     */
    function _validateFeeState(FeeState memory _settings) internal pure {
        require(_settings.feeRecipient != address(0), "Fee Recipient must be non-zero address");
        require(_settings.maxPerformanceFeePercentage <= PreciseUnitMath.preciseUnit(), "Max fee must be <= 100%");
        require(_settings.performanceFeePercentage <= _settings.maxPerformanceFeePercentage, "Fee must be <= max");
    }

    /**
     * @dev Helper function that returns performance fee percentage.
     *
     * @param _setToken     Instance of SetToken
     */
    function _performanceFeePercentage(ISetToken _setToken) internal view returns (uint256) {
        return feeSettings[_setToken].performanceFeePercentage;
    }

}
