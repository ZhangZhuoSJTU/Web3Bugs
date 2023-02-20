/*
    Copyright 2020 Set Labs Inc.
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
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IController } from "../../../interfaces/IController.sol";
import { IManagerIssuanceHook } from "../../../interfaces/IManagerIssuanceHook.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { Position } from "../../lib/Position.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";

/**
 * @title BasicIssuanceModule
 * @author Set Protocol
 *
 * Module that enables issuance and redemption functionality on a SetToken. This is a module that is
 * required to bring the totalSupply of a Set above 0.
 */
contract BasicIssuanceModule is ModuleBase, ReentrancyGuard {
    using Invoke for ISetToken;
    using Position for ISetToken.Position;
    using Position for ISetToken;
    using PreciseUnitMath for uint256;
    using SafeMath for uint256;
    using SafeCast for int256;

    /* ============ Events ============ */

    event SetTokenIssued(
        address indexed _setToken,
        address indexed _issuer,
        address indexed _to,
        address _hookContract,
        uint256 _quantity
    );
    event SetTokenRedeemed(
        address indexed _setToken,
        address indexed _redeemer,
        address indexed _to,
        uint256 _quantity
    );

    /* ============ State Variables ============ */

    // Mapping of SetToken to Issuance hook configurations
    mapping(ISetToken => IManagerIssuanceHook) public managerIssuanceHook;

    /* ============ Constructor ============ */

    /**
     * Set state controller state variable
     *
     * @param _controller             Address of controller contract
     */
    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    /**
     * Deposits the SetToken's position components into the SetToken and mints the SetToken of the given quantity
     * to the specified _to address. This function only handles Default Positions (positionState = 0).
     *
     * @param _setToken             Instance of the SetToken contract
     * @param _quantity             Quantity of the SetToken to mint
     * @param _to                   Address to mint SetToken to
     */
    function issue(
        ISetToken _setToken,
        uint256 _quantity,
        address _to
    )
        external
        nonReentrant
        onlyValidAndInitializedSet(_setToken)
    {
        require(_quantity > 0, "Issue quantity must be > 0");

        address hookContract = _callPreIssueHooks(_setToken, _quantity, msg.sender, _to);

        (
            address[] memory components,
            uint256[] memory componentQuantities
        ) = getRequiredComponentUnitsForIssue(_setToken, _quantity);

        // For each position, transfer the required underlying to the SetToken
        for (uint256 i = 0; i < components.length; i++) {
            // Transfer the component to the SetToken
            transferFrom(
                IERC20(components[i]),
                msg.sender,
                address(_setToken),
                componentQuantities[i]
            );
        }

        // Mint the SetToken
        _setToken.mint(_to, _quantity);

        emit SetTokenIssued(address(_setToken), msg.sender, _to, hookContract, _quantity);
    }

    /**
     * Redeems the SetToken's positions and sends the components of the given
     * quantity to the caller. This function only handles Default Positions (positionState = 0).
     *
     * @param _setToken             Instance of the SetToken contract
     * @param _quantity             Quantity of the SetToken to redeem
     * @param _to                   Address to send component assets to
     */
    function redeem(
        ISetToken _setToken,
        uint256 _quantity,
        address _to
    )
        external
        nonReentrant
        onlyValidAndInitializedSet(_setToken)
    {
        require(_quantity > 0, "Redeem quantity must be > 0");

        // Burn the SetToken - ERC20's internal burn already checks that the user has enough balance
        _setToken.burn(msg.sender, _quantity);

        // For each position, invoke the SetToken to transfer the tokens to the user
        address[] memory components = _setToken.getComponents();
        for (uint256 i = 0; i < components.length; i++) {
            address component = components[i];
            require(!_setToken.hasExternalPosition(component), "Only default positions are supported");

            uint256 unit = _setToken.getDefaultPositionRealUnit(component).toUint256();

            // Use preciseMul to round down to ensure overcollateration when small redeem quantities are provided
            uint256 componentQuantity = _quantity.preciseMul(unit);

            // Instruct the SetToken to transfer the component to the user
            _setToken.strictInvokeTransfer(
                component,
                _to,
                componentQuantity
            );
        }

        emit SetTokenRedeemed(address(_setToken), msg.sender, _to, _quantity);
    }

    /**
     * Initializes this module to the SetToken with issuance-related hooks. Only callable by the SetToken's manager.
     * Hook addresses are optional. Address(0) means that no hook will be called
     *
     * @param _setToken             Instance of the SetToken to issue
     * @param _preIssueHook         Instance of the Manager Contract with the Pre-Issuance Hook function
     */
    function initialize(
        ISetToken _setToken,
        IManagerIssuanceHook _preIssueHook
    )
        external
        onlySetManager(_setToken, msg.sender)
        onlyValidAndPendingSet(_setToken)
    {
        managerIssuanceHook[_setToken] = _preIssueHook;

        _setToken.initializeModule();
    }

    /**
     * Reverts as this module should not be removable after added. Users should always
     * have a way to redeem their Sets
     */
    function removeModule() external override {
        revert("The BasicIssuanceModule module cannot be removed");
    }

    /* ============ External Getter Functions ============ */

    /**
     * Retrieves the addresses and units required to mint a particular quantity of SetToken.
     *
     * @param _setToken             Instance of the SetToken to issue
     * @param _quantity             Quantity of SetToken to issue
     * @return address[]            List of component addresses
     * @return uint256[]            List of component units required to issue the quantity of SetTokens
     */
    function getRequiredComponentUnitsForIssue(
        ISetToken _setToken,
        uint256 _quantity
    )
        public
        view
        onlyValidAndInitializedSet(_setToken)
        returns (address[] memory, uint256[] memory)
    {
        address[] memory components = _setToken.getComponents();

        uint256[] memory notionalUnits = new uint256[](components.length);

        for (uint256 i = 0; i < components.length; i++) {
            require(!_setToken.hasExternalPosition(components[i]), "Only default positions are supported");

            notionalUnits[i] = _setToken.getDefaultPositionRealUnit(components[i]).toUint256().preciseMulCeil(_quantity);
        }

        return (components, notionalUnits);
    }

    /* ============ Internal Functions ============ */

    /**
     * If a pre-issue hook has been configured, call the external-protocol contract. Pre-issue hook logic
     * can contain arbitrary logic including validations, external function calls, etc.
     */
    function _callPreIssueHooks(
        ISetToken _setToken,
        uint256 _quantity,
        address _caller,
        address _to
    )
        internal
        returns(address)
    {
        IManagerIssuanceHook preIssueHook = managerIssuanceHook[_setToken];
        if (address(preIssueHook) != address(0)) {
            preIssueHook.invokePreIssueHook(_setToken, _quantity, _caller, _to);
            return address(preIssueHook);
        }

        return address(0);
    }
}