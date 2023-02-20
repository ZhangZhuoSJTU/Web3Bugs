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

import { ISetToken } from "./ISetToken.sol";
import { IWETH } from "./external/IWETH.sol";

interface IWrapModuleV2 {
    function weth() external view returns(IWETH);

    function initialize(ISetToken _setToken) external;

    function wrap(
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _underlyingUnits,
        string calldata _integrationName,
        bytes memory _wrapData
    ) external;

    function wrapWithEther(
        ISetToken _setToken,
        address _wrappedToken,
        uint256 _underlyingUnits,
        string calldata _integrationName,
        bytes memory _wrapData
    ) external;

    function unwrap(
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _wrappedUnits,
        string calldata _integrationName,
        bytes memory _unwrapData
    ) external;

    function unwrapWithEther(
        ISetToken _setToken,
        address _wrappedToken,
        uint256 _wrappedUnits,
        string calldata _integrationName,
        bytes memory _unwrapData
    ) external;
}
