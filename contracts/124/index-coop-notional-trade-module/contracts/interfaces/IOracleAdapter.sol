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


/**
 * @title IOracleAdapter
 * @author Set Protocol
 *
 * Interface for calling an oracle adapter.
 */
interface IOracleAdapter {

    /**
     * Function for retrieving a price that requires sourcing data from outside protocols to calculate.
     *
     * @param  _assetOne    First asset in pair
     * @param  _assetTwo    Second asset in pair
     * @return                  Boolean indicating if oracle exists
     * @return              Current price of asset represented in uint256
     */
    function getPrice(address _assetOne, address _assetTwo) external view returns (bool, uint256);
}