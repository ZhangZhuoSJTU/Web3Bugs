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

import { AddressArrayUtils } from "../lib/AddressArrayUtils.sol";


contract AddressArrayUtilsMock {
    using AddressArrayUtils for address[];

    address[] public storageArray;

    function testIndexOf(address[] memory A, address a) external pure returns (uint256, bool) {
        return A.indexOf(a);
    }

    function testContains(address[] memory A, address a) external pure returns (bool) {
        return A.contains(a);
    }

    function testHasDuplicate(address[] memory A) external pure returns (bool) {
        return A.hasDuplicate();
    }

    function testRemove(address[] memory A, address a) external pure returns (address[] memory) {
        return A.remove(a);
    }

    function testRemoveStorage(address a) external {
        storageArray.removeStorage(a);
    }

    function testPop(address[] memory A, uint256 index) external pure returns (address[] memory, address) {
        return A.pop(index);
    }

    function testValidatePairsWithArrayUint(address[] memory A, uint[] memory a) external pure {
        A.validatePairsWithArray(a);
    }

    function testValidatePairsWithArrayBool(address[] memory A, bool[] memory a) external pure {
        A.validatePairsWithArray(a);
    }

    function testValidatePairsWithArrayString(address[] memory A, string[] memory a) external pure {
        A.validatePairsWithArray(a);
    }

    function testValidatePairsWithArrayAddress(address[] memory A, address[] memory a) external pure {
        A.validatePairsWithArray(a);
    }

    function testValidatePairsWithArrayBytes(address[] memory A, bytes[] memory a) external pure {
        A.validatePairsWithArray(a);
    }

    function setStorageArray(address[] memory A) external {
        storageArray = A;
    }

    function getStorageArray() external view returns(address[] memory) {
        return storageArray;
    }
}
