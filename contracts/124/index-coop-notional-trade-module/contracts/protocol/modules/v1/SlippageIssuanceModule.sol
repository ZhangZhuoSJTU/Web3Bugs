/*
    Copyright 2021 Set Labs Inc.

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

import { DebtIssuanceModule } from "./DebtIssuanceModule.sol";
import { IController } from "../../../interfaces/IController.sol";
import { IModuleIssuanceHookV2 } from "../../../interfaces/IModuleIssuanceHookV2.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";

/**
 * @title SlippageIssuanceModule
 * @author Set Protocol
 *
 * The SlippageIssuanceModule is a module that enables users to issue and redeem SetTokens that requires a transaction that incurs slippage
 * in order to replicate the Set. Like the DebtIssuanceModule, module hooks are added to allow for syncing of positions, and component
 * level hooks are added to ensure positions are replicated correctly. The manager can define arbitrary issuance logic in the manager hook,
 * as well as specify issue and redeem fees. The getRequiredComponentIssuanceUnits and it's redemption counterpart now also include any
 * changes to the position expected to happen during issuance thus providing much better estimations for positions that are synced or require
 * a trade. It is worth noting that this module inherits from DebtIssuanceModule, consequently it can also be used for issuances that do NOT
 * require slippage just by calling the issue and redeem endpoints.
 */
contract SlippageIssuanceModule is DebtIssuanceModule {

    constructor(IController _controller) public DebtIssuanceModule(_controller) {}

    /* ============ External Functions ============ */

    /**
     * @dev Reverts upon calling. Call `issueWithSlippage` instead.
     */
    function issue(ISetToken /*_setToken*/, uint256 /*_quantity*/, address /*_to*/) external override(DebtIssuanceModule) {
        revert("Call issueWithSlippage instead");
    }

    /**
     * @dev Reverts upon calling. Call `redeemWithSlippage` instead.
     */
    function redeem(ISetToken /*_setToken*/, uint256 /*_quantity*/, address /*_to*/) external override(DebtIssuanceModule) {
        revert("Call redeemWithSlippage instead");
    }

    /**
     * Deposits components to the SetToken, replicates any external module component positions and mints
     * the SetToken. If the token has a debt position all collateral will be transferred in first then debt
     * will be returned to the minting address. If specified, a fee will be charged on issuance. Issuer can
     * also pass in a max amount of tokens they are willing to pay for each component. They are NOT required
     * to pass in a limit for every component, and may in fact only want to pass in limits for components which
     * incur slippage to replicate (i.e. perpetuals). Passing in empty arrays for _checkComponents and
     * _maxTokenAmountsIn is equivalent to calling issue. NOTE: not passing in limits for positions that require
     * a trade for replication leaves the issuer open to sandwich attacks!
     *
     * @param _setToken             Instance of the SetToken to issue
     * @param _setQuantity          Quantity of SetToken to issue
     * @param _checkedComponents    Array of components to be checked to verify required collateral doesn't exceed
     *                                  defined max. Each entry must be unique.
     * @param _maxTokenAmountsIn    Maps to same index in _checkedComponents. Max amount of component willing to
     *                                  transfer in to collateralize _setQuantity amount of _setToken.
     * @param _to                   Address to mint SetToken to
     */
    function issueWithSlippage(
        ISetToken _setToken,
        uint256 _setQuantity,
        address[] memory _checkedComponents,
        uint256[] memory _maxTokenAmountsIn,
        address _to
    )
        external
        virtual
        nonReentrant
        onlyValidAndInitializedSet(_setToken)
    {
        _validateInputs(_setQuantity, _checkedComponents, _maxTokenAmountsIn);

        address hookContract = _callManagerPreIssueHooks(_setToken, _setQuantity, msg.sender, _to);

        bool isIssue = true;

        (
            uint256 quantityWithFees,
            uint256 managerFee,
            uint256 protocolFee
        ) = calculateTotalFees(_setToken, _setQuantity, isIssue);

        _callModulePreIssueHooks(_setToken, quantityWithFees);

        // Scoping logic to avoid stack too deep errors
        {
            (
                address[] memory components,
                uint256[] memory equityUnits,
                uint256[] memory debtUnits
            ) = _calculateRequiredComponentIssuanceUnits(_setToken, quantityWithFees, isIssue);

            // Validate the required token amounts don't exceed those passed by issuer
            _validateTokenTransferLimits(_checkedComponents, _maxTokenAmountsIn, components, equityUnits, isIssue);

            _resolveEquityPositions(_setToken, quantityWithFees, _to, isIssue, components, equityUnits);
            _resolveDebtPositions(_setToken, quantityWithFees, isIssue, components, debtUnits);
            _resolveFees(_setToken, managerFee, protocolFee);
        }

        _setToken.mint(_to, _setQuantity);

        emit SetTokenIssued(
            _setToken,
            msg.sender,
            _to,
            hookContract,
            _setQuantity,
            managerFee,
            protocolFee
        );
    }

    /**
     * Returns components from the SetToken, unwinds any external module component positions and burns the SetToken.
     * If the token has debt positions, the module transfers in the required debt amounts from the caller and uses
     * those funds to repay the debts on behalf of the SetToken. All debt will be paid down first then equity positions
     * will be returned to the minting address. If specified, a fee will be charged on redeem. Redeemer can
     * also pass in a min amount of tokens they want to receive for each component. They are NOT required
     * to pass in a limit for every component, and may in fact only want to pass in limits for components which
     * incur slippage to replicate (i.e. perpetuals). Passing in empty arrays for _checkComponents and
     * _minTokenAmountsOut is equivalent to calling redeem. NOTE: not passing in limits for positions that require
     * a trade for replication leaves the redeemer open to sandwich attacks!
     *
     * @param _setToken             Instance of the SetToken to redeem
     * @param _setQuantity          Quantity of SetToken to redeem
     * @param _checkedComponents    Array of components to be checked to verify received collateral isn't less than
     *                                  defined min. Each entry must be unique.
     * @param _minTokenAmountsOut   Maps to same index in _checkedComponents. Min amount of component willing to
     *                                  receive to redeem _setQuantity amount of _setToken.
     * @param _to                   Address to send collateral to
     */
    function redeemWithSlippage(
        ISetToken _setToken,
        uint256 _setQuantity,
        address[] memory _checkedComponents,
        uint256[] memory _minTokenAmountsOut,
        address _to
    )
        external
        virtual
        nonReentrant
        onlyValidAndInitializedSet(_setToken)
    {
        _validateInputs(_setQuantity, _checkedComponents, _minTokenAmountsOut);

        bool isIssue = false;

        (
            uint256 quantityNetFees,
            uint256 managerFee,
            uint256 protocolFee
        ) = calculateTotalFees(_setToken, _setQuantity, isIssue);

        _callModulePreRedeemHooks(_setToken, quantityNetFees);

        // Place burn after pre-redeem hooks because burning tokens may lead to false accounting of synced positions
        _setToken.burn(msg.sender, _setQuantity);

        (
            address[] memory components,
            uint256[] memory equityUnits,
            uint256[] memory debtUnits
        ) = _calculateRequiredComponentIssuanceUnits(_setToken, quantityNetFees, isIssue);

        // Validate the required token amounts don't exceed those passed by redeemer
        _validateTokenTransferLimits(_checkedComponents, _minTokenAmountsOut, components, equityUnits, isIssue);

        _resolveDebtPositions(_setToken, quantityNetFees, isIssue, components, debtUnits);
        _resolveEquityPositions(_setToken, quantityNetFees, _to, isIssue, components, equityUnits);
        _resolveFees(_setToken, managerFee, protocolFee);

        emit SetTokenRedeemed(
            _setToken,
            msg.sender,
            _to,
            _setQuantity,
            managerFee,
            protocolFee
        );
    }

    /**
     * Calculates the amount of each component needed to collateralize passed issue quantity plus fees of Sets as well as amount of debt
     * that will be returned to caller. Takes into account position updates from pre action module hooks.
     * (manager hooks not included).
     *
     * NOTE: This getter is non-view to allow module hooks to determine units by simulating state changes in an external protocol and
     * reverting. It should only be called by off-chain methods via static call.
     *
     * @param _setToken         Instance of the SetToken to issue
     * @param _quantity         Amount of Sets to be issued
     *
     * @return address[]        Array of component addresses making up the Set
     * @return uint256[]        Array of equity notional amounts of each component, respectively, represented as uint256
     * @return uint256[]        Array of debt notional amounts of each component, respectively, represented as uint256
     */
    function getRequiredComponentIssuanceUnitsOffChain(
        ISetToken _setToken,
        uint256 _quantity
    )
        external
        returns (address[] memory, uint256[] memory, uint256[] memory)
    {
        bool isIssue = true;

        (
            uint256 totalQuantity,,
        ) = calculateTotalFees(_setToken, _quantity, isIssue);

        (
            int256[] memory equityIssuanceAdjustments,
            int256[] memory debtIssuanceAdjustments
        )= _calculateAdjustments(_setToken, totalQuantity, isIssue);

        return _calculateAdjustedComponentIssuanceUnits(
            _setToken,
            totalQuantity,
            isIssue,
            equityIssuanceAdjustments,
            debtIssuanceAdjustments
        );
    }

    /**
     * Calculates the amount of each component that will be returned on redemption net of fees as well as how much debt needs to be paid down to
     * redeem. Takes into account position updates from pre action module hooks (manager hooks not included).
     *
     * NOTE: This getter is non-view to allow module hooks to determine units by simulating state changes in an external protocol and
     * reverting. It should only be called by off-chain methods via static call.
     *
     * @param _setToken         Instance of the SetToken to issue
     * @param _quantity         Amount of Sets to be redeemed
     *
     * @return address[]        Array of component addresses making up the Set
     * @return uint256[]        Array of equity notional amounts of each component, respectively, represented as uint256
     * @return uint256[]        Array of debt notional amounts of each component, respectively, represented as uint256
     */
    function getRequiredComponentRedemptionUnitsOffChain(
        ISetToken _setToken,
        uint256 _quantity
    )
        external
        returns (address[] memory, uint256[] memory, uint256[] memory)
    {
        bool isIssue = false;

        (
            uint256 totalQuantity,,
        ) = calculateTotalFees(_setToken, _quantity, isIssue);

        (
            int256[] memory equityRedemptionAdjustments,
            int256[] memory debtRedemptionAdjustments
        )= _calculateAdjustments(_setToken, totalQuantity, isIssue);

        return _calculateAdjustedComponentIssuanceUnits(
            _setToken,
            totalQuantity,
            isIssue,
            equityRedemptionAdjustments,
            debtRedemptionAdjustments
        );
    }

    /* ============ Internal Functions ============ */

    /**
     * Similar to _calculateRequiredComponentIssuanceUnits but adjustments for positions that will be updated DURING the issue
     * or redeem process are added in. Adjustments can be either positive or negative, a negative debt adjustment means there
     * is less debt than the pre-issue position unit indicates there will be.
     *
     * @param _setToken             Instance of the SetToken to redeem
     * @param _quantity             Quantity of SetToken to redeem
     * @param _isIssue              Boolean indicating whether Set is being issues
     * @param _equityAdjustments    Array of equity position unit adjustments that account for position changes during issuance
     *                                  (maps to getComponents array)
     * @param _debtAdjustments      Array of debt position unit adjustments that account for position changes during issuance
     *                                  (maps to getComponents array)
     */
    function _calculateAdjustedComponentIssuanceUnits(
        ISetToken _setToken,
        uint256 _quantity,
        bool _isIssue,
        int256[] memory _equityAdjustments,
        int256[] memory _debtAdjustments
    )
        internal
        view
        returns (address[] memory, uint256[] memory, uint256[] memory)
    {
        (
            address[] memory components,
            uint256[] memory equityUnits,
            uint256[] memory debtUnits
        ) = _getTotalIssuanceUnits(_setToken);

        // NOTE: components.length isn't stored in local variable to avoid stack too deep errors. Since this function is used
        // by view functions intended to be queried off-chain this seems acceptable
        uint256[] memory totalEquityUnits = new uint256[](components.length);
        uint256[] memory totalDebtUnits = new uint256[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
            // NOTE: If equityAdjustment is negative and exceeds equityUnits in absolute value this will revert
            // When adjusting units if we have MORE equity as a result of issuance (ie adjustment is positive) we want to add that
            // to the unadjusted equity units hence we use addition. Vice versa if we want to remove equity, the adjustment is negative
            // hence adding adjusts the units lower
            uint256 adjustedEquityUnits = equityUnits[i].toInt256().add(_equityAdjustments[i]).toUint256();

            // Use preciseMulCeil to round up to ensure overcollateration when small issue quantities are provided
            // and preciseMul to round down to ensure overcollateration when small redeem quantities are provided
            totalEquityUnits[i] = _isIssue ?
                adjustedEquityUnits.preciseMulCeil(_quantity) :
                adjustedEquityUnits.preciseMul(_quantity);

            // NOTE: If debtAdjustment is negative and exceeds debtUnits in absolute value this will revert
            // When adjusting units if we have MORE debt as a result of issuance (ie adjustment is negative) we want to increase
            // the unadjusted debt units hence we subtract. Vice versa if we want to remove debt the adjustment is positive
            // hence subtracting adjusts the units lower.
            uint256 adjustedDebtUnits = debtUnits[i].toInt256().sub(_debtAdjustments[i]).toUint256();

            // Use preciseMulCeil to round up to ensure overcollateration when small redeem quantities are provided
            // and preciseMul to round down to ensure overcollateration when small issue quantities are provided
            totalDebtUnits[i] = _isIssue ?
                adjustedDebtUnits.preciseMul(_quantity) :
                adjustedDebtUnits.preciseMulCeil(_quantity);
        }

        return (components, totalEquityUnits, totalDebtUnits);
    }

    /**
     * Calculates all equity and debt adjustments that will be made to the positionUnits within the context of the current chain
     * state. Each module that registers a hook with the SlippageIssuanceModule is cycled through and returns how the module will
     * adjust the equity and debt positions for the Set. All changes are summed/netted against each other. The adjustment arrays
     * returned by each module are ordered according to the components array on the SetToken.
     *
     * @param _setToken             Instance of the SetToken to redeem
     * @param _quantity             Quantity of SetToken to redeem
     * @param _isIssue              Boolean indicating whether Set is being issues
     */
    function _calculateAdjustments(
        ISetToken _setToken,
        uint256 _quantity,
        bool _isIssue
    )
        internal
        returns (int256[] memory, int256[] memory)
    {
        uint256 componentsLength = _setToken.getComponents().length;
        int256[] memory cumulativeEquityAdjustments = new int256[](componentsLength);
        int256[] memory cumulativeDebtAdjustments = new int256[](componentsLength);

        address[] memory issuanceHooks = issuanceSettings[_setToken].moduleIssuanceHooks;
        for (uint256 i = 0; i < issuanceHooks.length; i++) {
            (
                int256[] memory equityAdjustments,
                int256[] memory debtAdjustments
            ) = _isIssue ? IModuleIssuanceHookV2(issuanceHooks[i]).getIssuanceAdjustments(_setToken, _quantity) :
                IModuleIssuanceHookV2(issuanceHooks[i]).getRedemptionAdjustments(_setToken, _quantity);

            for (uint256 j = 0; j < componentsLength; j++) {
                cumulativeEquityAdjustments[j] = cumulativeEquityAdjustments[j].add(equityAdjustments[j]);
                cumulativeDebtAdjustments[j] = cumulativeDebtAdjustments[j].add(debtAdjustments[j]);
            }
        }

        return (cumulativeEquityAdjustments, cumulativeDebtAdjustments);
    }

    /**
     * Validates that the required token amounts to replicate/redeem an equity position are not greater or less than the limits
     * defined by the issuer/redeemer. Every component is NOT required to be checked however each checked component MUST be a
     * valid component for the Set.
     *
     * @param _checkedComponents            Components the issuer/redeemer wants checked
     * @param _tokenTransferLimits          If _isIssue true, max amount of checked component allowed to xfer, else min amount of
     *                                          of checked component the redeemer wants to receive
     * @param _components                   Array of SetToken components
     * @param _tokenTransferAmounts         Amount of component required for issuance or returned for redemption, maps to components
     * @param _isIssue                      Boolean indicating whether Set is being issues
     */
    function _validateTokenTransferLimits(
        address[] memory _checkedComponents,
        uint256[] memory _tokenTransferLimits,
        address[] memory _components,
        uint256[] memory _tokenTransferAmounts,
        bool _isIssue
    )
        internal
        pure
    {
        for(uint256 i = 0; i < _checkedComponents.length; i++) {
            (uint256 componentIndex, bool isIn) = _components.indexOf(_checkedComponents[i]);

            require(isIn, "Limit passed for invalid component");

            if (_isIssue) {
                require(_tokenTransferLimits[i] >= _tokenTransferAmounts[componentIndex], "Too many tokens required for issuance");
            } else {
                require(_tokenTransferLimits[i] <= _tokenTransferAmounts[componentIndex], "Too few tokens returned for redemption");
            }
        }
    }

    /**
     * Validates setQuantity great than 0 and that arrays are of equal length and components are not duplicated.
     */
    function _validateInputs(
        uint256 _setQuantity,
        address[] memory _components,
        uint256[] memory _componentLimits
    )
        internal
        pure
    {
        require(_setQuantity > 0, "SetToken quantity must be > 0");

        uint256 componentsLength = _components.length;
        require(componentsLength == _componentLimits.length, "Array length mismatch");
        if (componentsLength > 0) {
            require(!_components.hasDuplicate(), "Cannot duplicate addresses");
        }
    }
}