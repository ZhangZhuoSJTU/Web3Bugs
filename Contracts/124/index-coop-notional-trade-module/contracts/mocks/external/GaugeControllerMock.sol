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
 * @title GaugeControllerMock
 * @author Set Protocol
 *
 * Mocks similar behaviour of the Curve GaugeController contract
 */
contract GaugeControllerMock {

    mapping(address => int128) internal types;

    function addGaugeType(address _gauge, int128 _type) external {
        types[_gauge] = _type + 1;
    }

    function gauge_types(address _gauge) external view returns (int128) {
        int128 gaugeType = types[_gauge];

        require(gaugeType != 0, "Not valid");
        return gaugeType - 1;
    }
}
