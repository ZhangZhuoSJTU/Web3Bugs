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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IController } from "../../../interfaces/IController.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { ModuleBase } from "../../../protocol/lib/ModuleBase.sol";

contract ModuleBaseMock is ModuleBase {

    bool public removed;

    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    function testTransferFrom(IERC20 _token, address _from, address _to, uint256 _quantity) external {
        return transferFrom(_token, _from, _to, _quantity);
    }


    function testIsSetPendingInitialization(ISetToken _setToken) external view returns(bool) {
        return isSetPendingInitialization(_setToken);
    }

    function testIsSetManager(ISetToken _setToken, address _toCheck) external view returns(bool) {
        return isSetManager(_setToken, _toCheck);
    }

    function testIsSetValidAndInitialized(ISetToken _setToken) external view returns(bool) {
        return isSetValidAndInitialized(_setToken);
    }

    function testOnlyManagerAndValidSet(ISetToken _setToken)
        external
        view
        onlyManagerAndValidSet(_setToken)
    {}

    function testGetAndValidateAdapter(string memory _integrationName) external view returns(address) {
        return getAndValidateAdapter(_integrationName);
    }

    function testGetAndValidateAdapterWithHash(bytes32 _integrationHash) external view returns(address) {
        return getAndValidateAdapterWithHash(_integrationHash);
    }

    function testGetModuleFee(uint256 _feeIndex, uint256 _quantity) external view returns(uint256) {
        return getModuleFee(_feeIndex, _quantity);
    }

    function testPayProtocolFeeFromSetToken(
        ISetToken _setToken,
        address _component,
        uint256 _feeQuantity
    ) external {
        payProtocolFeeFromSetToken(_setToken, _component, _feeQuantity);
    }

    function testOnlySetManager(ISetToken _setToken)
        external
        view
        onlySetManager(_setToken, msg.sender)
    {}

    function testOnlyModule(ISetToken _setToken)
        external
        view
        onlyModule(_setToken)
    {}


    function removeModule() external override {
        removed = true;
    }

    function testOnlyValidAndInitializedSet(ISetToken _setToken)
        external view onlyValidAndInitializedSet(_setToken) {}

    function testOnlyValidInitialization(ISetToken _setToken)
        external view onlyValidAndPendingSet(_setToken) {}

    /* ============ Helper Functions ============ */

    function initializeModuleOnSet(ISetToken _setToken) external {
        _setToken.initializeModule();
    }
}