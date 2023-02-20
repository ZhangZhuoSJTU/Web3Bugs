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

interface IClaimModule {
    function initialize(
        ISetToken _setToken,
        bool _anyoneClaim,
        address[] calldata _rewardPools,
        string[] calldata _integrationNames
    ) external;

    function anyoneClaim(ISetToken _setToken) external view returns(bool);
    function claim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) external;
    function batchClaim(ISetToken _setToken, address[] calldata _rewardPools, string[] calldata _integrationNames) external;
    function updateAnyoneClaim(ISetToken _setToken, bool _anyoneClaim) external;
    function addClaim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) external;
    function batchAddClaim(ISetToken _setToken, address[] calldata _rewardPools, string[] calldata _integrationNames) external;
    function removeClaim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) external;
    function batchRemoveClaim(ISetToken _setToken, address[] calldata _rewardPools, string[] calldata _integrationNames) external;
    function removeModule() external;
    function getRewardPools(ISetToken _setToken) external returns(address[] memory);
    function isRewardPool(ISetToken _setToken, address _rewardPool) external returns(bool);
    function getRewardPoolClaims(ISetToken _setToken, address _rewardPool) external returns(address[] memory);
    function isRewardPoolClaim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) external returns (bool);
    function getRewards(ISetToken _setToken, address _rewardPool, string calldata _integrationName) external returns (uint256);
}