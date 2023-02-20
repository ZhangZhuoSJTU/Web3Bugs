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

/**
 * @title LendingPoolAddressesProviderMock
 * @author Set Protocol
 * @notice Mock contract for Aave's LendingPoolAddressesProvider
 */
contract LendingPoolAddressesProviderMock {

    mapping(bytes32 => address) private _addresses;
    bytes32 private constant LENDING_POOL = "LENDING_POOL";
    
    function setAddress(bytes32 id, address newAddress) external {
        _addresses[id] = newAddress;
    }

    function getAddress(bytes32 id) public view returns (address) {
        return _addresses[id];
    }
    
    function getLendingPool() external view returns (address) {
        return getAddress(LENDING_POOL);
    }
}