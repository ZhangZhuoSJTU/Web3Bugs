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


import { ERC20Viewer } from "./ERC20Viewer.sol";
import { SetTokenViewer } from "./SetTokenViewer.sol";
import { StreamingFeeModuleViewer } from "./StreamingFeeModuleViewer.sol";


/**
 * @title ProtocolViewer
 * @author Set Protocol
 *
 * ProtocolViewer enables batch queries of various protocol state.
 */
contract ProtocolViewer is
    ERC20Viewer,
    SetTokenViewer,
    StreamingFeeModuleViewer
{
    constructor() public {}
}
