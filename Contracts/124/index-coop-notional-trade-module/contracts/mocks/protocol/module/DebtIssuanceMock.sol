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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ISetToken } from "../../../interfaces/ISetToken.sol";

contract DebtIssuanceMock {

    mapping(ISetToken => bool) public isRegistered;
    
    function initialize(ISetToken _setToken) external {
        _setToken.initializeModule();
    }

    function removeModule() external {}

    function registerToIssuanceModule(ISetToken _setToken) external {
        isRegistered[_setToken] = true;
    }

    function unregisterFromIssuanceModule(ISetToken _setToken) external {
        isRegistered[_setToken] = false;
    }
}