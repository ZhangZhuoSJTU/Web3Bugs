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

import { AddressArrayUtils } from "../../../lib/AddressArrayUtils.sol";
import { IController } from "../../../interfaces/IController.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { Position } from "../../lib/Position.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";


/**
 * @title AirdropModule
 * @author Set Protocol
 *
 * Module that enables managers to absorb tokens sent to the SetToken into the token's positions. With each SetToken,
 * managers are able to specify 1) the airdrops they want to include, 2) an airdrop fee recipient, 3) airdrop fee,
 * and 4) whether all users are allowed to trigger an airdrop.
 */
contract AirdropModule is ModuleBase, ReentrancyGuard {
    using PreciseUnitMath for uint256;
    using SafeMath for uint256;
    using Position for uint256;
    using SafeCast for int256;
    using AddressArrayUtils for address[];
    using Invoke for ISetToken;
    using Position for ISetToken;

    /* ============ Structs ============ */

    struct AirdropSettings {
        address[] airdrops;                     // Array of tokens manager is allowing to be absorbed
        address feeRecipient;                   // Address airdrop fees are sent to
        uint256 airdropFee;                     // Percentage in preciseUnits of airdrop sent to feeRecipient (1e16 = 1%)
        bool anyoneAbsorb;                      // Boolean indicating if any address can call absorb or just the manager
    }

    /* ============ Events ============ */

    event ComponentAbsorbed(
        ISetToken indexed _setToken,
        IERC20 indexed _absorbedToken,
        uint256 _absorbedQuantity,
        uint256 _managerFee,
        uint256 _protocolFee
    );

    event AirdropComponentAdded(ISetToken indexed _setToken, IERC20 indexed _component);
    event AirdropComponentRemoved(ISetToken indexed _setToken, IERC20 indexed _component);
    event AnyoneAbsorbUpdated(ISetToken indexed _setToken, bool _anyoneAbsorb);
    event AirdropFeeUpdated(ISetToken indexed _setToken, uint256 _newFee);
    event FeeRecipientUpdated(ISetToken indexed _setToken, address _newFeeRecipient);

    /* ============ Modifiers ============ */

    /**
     * Throws if claim is confined to the manager and caller is not the manager
     */
    modifier onlyValidCaller(ISetToken _setToken) {
        require(_isValidCaller(_setToken), "Must be valid caller");
        _;
    }

    /* ============ Constants ============ */

    uint256 public constant AIRDROP_MODULE_PROTOCOL_FEE_INDEX = 0;

    /* ============ State Variables ============ */

    mapping(ISetToken => AirdropSettings) public airdropSettings;
    // Mapping indicating if token is an allowed airdrop
    mapping(ISetToken => mapping(IERC20 => bool)) public isAirdrop;

    /* ============ Constructor ============ */

    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    /**
     * Absorb passed tokens into respective positions. If airdropFee defined, send portion to feeRecipient and portion to
     * protocol feeRecipient address. Callable only by manager unless manager has set anyoneAbsorb to true.
     *
     * @param _setToken                 Address of SetToken
     * @param _tokens                   Array of tokens to absorb
     */
    function batchAbsorb(ISetToken _setToken, address[] memory _tokens)
        external
        nonReentrant
        onlyValidCaller(_setToken)
        onlyValidAndInitializedSet(_setToken)
    {
        _batchAbsorb(_setToken, _tokens);
    }

    /**
     * Absorb specified token into position. If airdropFee defined, send portion to feeRecipient and portion to
     * protocol feeRecipient address. Callable only by manager unless manager has set anyoneAbsorb to true.
     *
     * @param _setToken                 Address of SetToken
     * @param _token                    Address of token to absorb
     */
    function absorb(ISetToken _setToken, IERC20 _token)
        external
        nonReentrant
        onlyValidCaller(_setToken)
        onlyValidAndInitializedSet(_setToken)
    {
        _absorb(_setToken, _token);
    }

    /**
     * SET MANAGER ONLY. Adds new tokens to be added to positions when absorb is called.
     *
     * @param _setToken                 Address of SetToken
     * @param _airdrop                  Component to add to airdrop list
     */
    function addAirdrop(ISetToken _setToken, IERC20 _airdrop) external onlyManagerAndValidSet(_setToken) {
        require(!isAirdropToken(_setToken, _airdrop), "Token already added.");
        airdropSettings[_setToken].airdrops.push(address(_airdrop));
        isAirdrop[_setToken][_airdrop] = true;
        emit AirdropComponentAdded(_setToken, _airdrop);
    }

    /**
     * SET MANAGER ONLY. Removes tokens from list to be absorbed.
     *
     * @param _setToken                 Address of SetToken
     * @param _airdrop                  Component to remove from airdrop list
     */
    function removeAirdrop(ISetToken _setToken, IERC20 _airdrop) external onlyManagerAndValidSet(_setToken) {
        require(isAirdropToken(_setToken, _airdrop), "Token not added.");
        airdropSettings[_setToken].airdrops.removeStorage(address(_airdrop));
        isAirdrop[_setToken][_airdrop] = false;
        emit AirdropComponentRemoved(_setToken, _airdrop);
    }

    /**
     * SET MANAGER ONLY. Update whether manager allows other addresses to call absorb.
     *
     * @param _setToken                 Address of SetToken
     */
    function updateAnyoneAbsorb(ISetToken _setToken, bool _anyoneAbsorb) external onlyManagerAndValidSet(_setToken) {
        airdropSettings[_setToken].anyoneAbsorb = _anyoneAbsorb;
        emit AnyoneAbsorbUpdated(_setToken, _anyoneAbsorb);
    }

    /**
     * SET MANAGER ONLY. Update address manager fees are sent to.
     *
     * @param _setToken             Address of SetToken
     * @param _newFeeRecipient      Address of new fee recipient
     */
    function updateFeeRecipient(
        ISetToken _setToken,
        address _newFeeRecipient
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        require(_newFeeRecipient != address(0), "Passed address must be non-zero");
        airdropSettings[_setToken].feeRecipient = _newFeeRecipient;
        emit FeeRecipientUpdated(_setToken, _newFeeRecipient);
    }

    /**
     * SET MANAGER ONLY. Update airdrop fee percentage.
     *
     * @param _setToken         Address of SetToken
     * @param _newFee           Percentage, in preciseUnits, of new airdrop fee (1e16 = 1%)
     */
    function updateAirdropFee(
        ISetToken _setToken,
        uint256 _newFee
    )
        external
        onlySetManager(_setToken, msg.sender)
        onlyValidAndInitializedSet(_setToken)
    {
        require(_newFee <=  PreciseUnitMath.preciseUnit(), "Airdrop fee can't exceed 100%");

        // Absorb all outstanding tokens before fee is updated
        _batchAbsorb(_setToken, airdropSettings[_setToken].airdrops);

        airdropSettings[_setToken].airdropFee = _newFee;
        emit AirdropFeeUpdated(_setToken, _newFee);
    }

    /**
     * SET MANAGER ONLY. Initialize module with SetToken and set initial airdrop tokens as well as specify
     * whether anyone can call absorb.
     *
     * @param _setToken                 Address of SetToken
     * @param _airdropSettings          Struct of airdrop setting for Set including accepted airdrops, feeRecipient,
     *                                  airdropFee, and indicating if anyone can call an absorb
     */
    function initialize(
        ISetToken _setToken,
        AirdropSettings memory _airdropSettings
    )
        external
        onlySetManager(_setToken, msg.sender)
        onlyValidAndPendingSet(_setToken)
    {
        require(_airdropSettings.airdropFee <= PreciseUnitMath.preciseUnit(), "Fee must be <= 100%.");
        require(_airdropSettings.feeRecipient != address(0), "Zero fee address passed");
        if (_airdropSettings.airdrops.length > 0) {
            require(!_airdropSettings.airdrops.hasDuplicate(), "Duplicate airdrop token passed");
        }

        airdropSettings[_setToken] = _airdropSettings;

        for (uint256 i = 0; i < _airdropSettings.airdrops.length; i++) {
            isAirdrop[_setToken][IERC20(_airdropSettings.airdrops[i])] = true;
        }

        _setToken.initializeModule();
    }

    /**
     * Removes this module from the SetToken, via call by the SetToken. Token's airdrop settings are deleted.
     * Airdrops are not absorbed.
     */
    function removeModule() external override {
        address[] memory airdrops = airdropSettings[ISetToken(msg.sender)].airdrops;

        for (uint256 i =0; i < airdrops.length; i++) {
            isAirdrop[ISetToken(msg.sender)][IERC20(airdrops[i])] = false;
        }

        delete airdropSettings[ISetToken(msg.sender)];
    }

    /**
     * Get list of tokens approved to collect airdrops for the SetToken.
     *
     * @param _setToken             Address of SetToken
     * @return                      Array of tokens approved for airdrops
     */
    function getAirdrops(ISetToken _setToken) external view returns (address[] memory) {
        return airdropSettings[_setToken].airdrops;
    }

    /**
     * Get boolean indicating if token is approved for airdrops.
     *
     * @param _setToken             Address of SetToken
     * @return                      Boolean indicating approval for airdrops
     */
    function isAirdropToken(ISetToken _setToken, IERC20 _token) public view returns (bool) {
        return isAirdrop[_setToken][_token];
    }

    /* ============ Internal Functions ============ */

    /**
     * Check token approved for airdrops then handle airdropped position.
     */
    function _absorb(ISetToken _setToken, IERC20 _token) internal {
        require(isAirdropToken(_setToken, _token), "Must be approved token.");

        _handleAirdropPosition(_setToken, _token);
    }

    /**
     * Loop through array of tokens and handle airdropped positions.
     */
    function _batchAbsorb(ISetToken _setToken, address[] memory _tokens) internal {
        for (uint256 i = 0; i < _tokens.length; i++) {
            _absorb(_setToken, IERC20(_tokens[i]));
        }
    }

    /**
     * Calculate amount of tokens airdropped since last absorption, then distribute fees and update position.
     *
     * @param _setToken                 Address of SetToken
     * @param _token                    Address of airdropped token
     */
    function _handleAirdropPosition(ISetToken _setToken, IERC20 _token) internal {
        uint256 preFeeTokenBalance = _token.balanceOf(address(_setToken));
        uint256 amountAirdropped = preFeeTokenBalance.sub(_setToken.getDefaultTrackedBalance(address(_token)));

        if (amountAirdropped > 0) {
            (uint256 managerTake, uint256 protocolTake, uint256 totalFees) = _handleFees(_setToken, _token, amountAirdropped);

            uint256 newUnit = _getPostAirdropUnit(_setToken, preFeeTokenBalance, totalFees);

            _setToken.editDefaultPosition(address(_token), newUnit);

            emit ComponentAbsorbed(_setToken, _token, amountAirdropped, managerTake, protocolTake);
        }
    }

    /**
     * Calculate fee total and distribute between feeRecipient defined on module and the protocol feeRecipient.
     *
     * @param _setToken                 Address of SetToken
     * @param _component                Address of airdropped component
     * @param _amountAirdropped         Amount of tokens airdropped to the SetToken
     * @return netManagerTake           Amount of airdropped tokens set aside for manager fees net of protocol fees
     * @return protocolTake             Amount of airdropped tokens set aside for protocol fees (taken from manager fees)
     * @return totalFees                Total fees paid
     */
    function _handleFees(
        ISetToken _setToken,
        IERC20 _component,
        uint256 _amountAirdropped
    )
        internal
        returns (uint256 netManagerTake, uint256 protocolTake, uint256 totalFees)
    {
        uint256 airdropFee = airdropSettings[_setToken].airdropFee;

        if (airdropFee > 0) {
            totalFees = _amountAirdropped.preciseMul(airdropFee);

            protocolTake = getModuleFee(AIRDROP_MODULE_PROTOCOL_FEE_INDEX, totalFees);
            netManagerTake = totalFees.sub(protocolTake);

            _setToken.strictInvokeTransfer(address(_component), airdropSettings[_setToken].feeRecipient, netManagerTake);

            payProtocolFeeFromSetToken(_setToken, address(_component), protocolTake);

            return (netManagerTake, protocolTake, totalFees);
        } else {
            return (0, 0, 0);
        }
    }

    /**
     * Retrieve new unit, which is the current balance less fees paid divided by total supply
     */
    function _getPostAirdropUnit(
        ISetToken _setToken,
        uint256 _totalComponentBalance,
        uint256 _totalFeesPaid
    )
        internal
        view
        returns(uint256)
    {
        uint256 totalSupply = _setToken.totalSupply();
        return totalSupply.getDefaultPositionUnit(_totalComponentBalance.sub(_totalFeesPaid));
    }

    /**
     * If absorption is confined to the manager, manager must be caller
     */
    function _isValidCaller(ISetToken _setToken) internal view returns(bool) {
        return airdropSettings[_setToken].anyoneAbsorb || isSetManager(_setToken, msg.sender);
    }
}