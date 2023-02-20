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

import { DebtIssuanceModuleV2 } from "./DebtIssuanceModuleV2.sol";
import { IController } from "../../../interfaces/IController.sol";

/**
 * @title IssuanceModule
 * @author Set Protocol
 *
 * The IssuanceModule is a module that enables users to issue and redeem SetTokens that contain default and all
 * external positions, including debt positions. The manager can define arbitrary issuance logic in the manager
 * hook, as well as specify issue and redeem fees. The manager can remove the module.
 */
contract IssuanceModule is DebtIssuanceModuleV2 {

    /* ============ Constructor ============ */

    /**
     * Set state controller state variable
     */
    constructor(IController _controller) public DebtIssuanceModuleV2(_controller) {}
}
