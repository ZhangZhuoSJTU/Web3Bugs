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
pragma experimental "ABIEncoderV2";

import { StringArrayUtils } from "../lib/StringArrayUtils.sol";


contract StringArrayUtilsMock {
    using StringArrayUtils for string[];

    string[] public storageArray;

    function testIndexOf(string[] memory A, string memory a) external pure returns (uint256, bool) {
        return A.indexOf(a);
    }

    function testRemoveStorage(string memory a) external {
        storageArray.removeStorage(a);
    }

    function setStorageArray(string[] memory A) external {
        storageArray = A;
    }

    function getStorageArray() external view returns(string[] memory) {
        return storageArray;
    }
}
