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

import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { Invoke } from "../../../protocol/lib/Invoke.sol";

contract InvokeMock {

    /* ============ External Functions ============ */

    function testInvokeApprove(
        ISetToken _setToken,
        address _token,
        address _spender,
        uint256 _quantity
    ) external {
        Invoke.invokeApprove(_setToken, _token, _spender, _quantity);
    }

    function testInvokeTransfer(
        ISetToken _setToken,
        address _token,
        address _spender,
        uint256 _quantity
    ) external {
        Invoke.invokeTransfer(_setToken, _token, _spender, _quantity);
    }

    function testStrictInvokeTransfer(
        ISetToken _setToken,
        address _token,
        address _spender,
        uint256 _quantity
    ) external {
        Invoke.strictInvokeTransfer(_setToken, _token, _spender, _quantity);
    }

    function testInvokeUnwrapWETH(ISetToken _setToken, address _weth, uint256 _quantity) external {
        Invoke.invokeUnwrapWETH(_setToken, _weth, _quantity);
    }

    function testInvokeWrapWETH(ISetToken _setToken, address _weth, uint256 _quantity) external {
        Invoke.invokeWrapWETH(_setToken, _weth, _quantity);
    }

    /* ============ Helper Functions ============ */

    function initializeModuleOnSet(ISetToken _setToken) external {
        _setToken.initializeModule();
    }
}