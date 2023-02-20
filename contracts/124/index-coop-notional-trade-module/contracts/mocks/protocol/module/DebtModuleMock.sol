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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { SignedSafeMath } from "@openzeppelin/contracts/math/SignedSafeMath.sol";

import { Invoke } from "../../../protocol/lib/Invoke.sol";
import { IController } from "../../../interfaces/IController.sol";
import { IDebtIssuanceModule } from "../../../interfaces/IDebtIssuanceModule.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { ModuleBase } from "../../../protocol/lib/ModuleBase.sol";
import { Position } from "../../../protocol/lib/Position.sol";


// Mock for modules that handle debt positions. Used for testing DebtIssuanceModule
contract DebtModuleMock is ModuleBase {
    using SafeCast for uint256;
    using Position for uint256;
    using SafeCast for int256;
    using SignedSafeMath for int256;
    using Position for ISetToken;
    using Invoke for ISetToken;

    address public module;
    bool public moduleIssueHookCalled;
    bool public moduleRedeemHookCalled;
    mapping(address=>int256) public equityIssuanceAdjustment;
    mapping(address=>int256) public debtIssuanceAdjustment;

    constructor(IController _controller) public ModuleBase(_controller) {}

    function addDebt(ISetToken _setToken, address _token, uint256 _amount) external {
        _setToken.editExternalPosition(_token, address(this), _amount.toInt256().mul(-1), "");
    }

    function addEquityIssuanceAdjustment(address _token, int256 _amount) external {
        equityIssuanceAdjustment[_token] = _amount;
    }

    function addDebtIssuanceAdjustment(address _token, int256 _amount) external {
        debtIssuanceAdjustment[_token] = _amount;
    }

    function moduleIssueHook(ISetToken /*_setToken*/, uint256 /*_setTokenQuantity*/) external { moduleIssueHookCalled = true; }
    function moduleRedeemHook(ISetToken /*_setToken*/, uint256 /*_setTokenQuantity*/) external { moduleRedeemHookCalled = true; }

    function componentIssueHook(
        ISetToken _setToken,
        uint256 _setTokenQuantity,
        address _component,
        bool /* _isEquity */
    )
        external
    {
        uint256 unitAmount = _setToken.getExternalPositionRealUnit(_component, address(this)).mul(-1).toUint256();
        uint256 notionalAmount = _setTokenQuantity.getDefaultTotalNotional(unitAmount);
        IERC20(_component).transfer(address(_setToken), notionalAmount);
    }

    function componentRedeemHook(
        ISetToken _setToken,
        uint256 _setTokenQuantity,
        address _component,
        bool /* _isEquity */
    )
        external
    {
        uint256 unitAmount = _setToken.getExternalPositionRealUnit(_component, address(this)).mul(-1).toUint256();
        uint256 notionalAmount = _setTokenQuantity.getDefaultTotalNotional(unitAmount);
        _setToken.invokeTransfer(_component, address(this), notionalAmount);
    }


    function getIssuanceAdjustments(
        ISetToken _setToken,
        uint256 /* _setTokenQuantity */
    )
        external
        view
        returns (int256[] memory, int256[] memory)
    {
        address[] memory components = _setToken.getComponents();
        int256[] memory equityAdjustments = new int256[](components.length);
        int256[] memory debtAdjustments = new int256[](components.length);
        for(uint256 i = 0; i < components.length; i++) {
            equityAdjustments[i] = equityIssuanceAdjustment[components[i]];
            debtAdjustments[i] = debtIssuanceAdjustment[components[i]];
        }

        return (equityAdjustments, debtAdjustments);
    }

    function getRedemptionAdjustments(
        ISetToken _setToken,
        uint256 /* _setTokenQuantity */
    )
        external
        view
        returns (int256[] memory, int256[] memory)
    {
        address[] memory components = _setToken.getComponents();
        int256[] memory equityAdjustments = new int256[](components.length);
        int256[] memory debtAdjustments = new int256[](components.length);
        for(uint256 i = 0; i < components.length; i++) {
            equityAdjustments[i] = equityIssuanceAdjustment[components[i]];
            debtAdjustments[i] = debtIssuanceAdjustment[components[i]];
        }

        return (equityAdjustments, debtAdjustments);
    }

    function initialize(ISetToken _setToken, address _module) external {
        _setToken.initializeModule();
        module = _module;
        IDebtIssuanceModule(module).registerToIssuanceModule(_setToken);
    }

    function removeModule() external override {
        IDebtIssuanceModule(module).unregisterFromIssuanceModule(ISetToken(msg.sender));
    }
}