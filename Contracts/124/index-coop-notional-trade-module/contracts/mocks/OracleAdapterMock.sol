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

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IOracle } from "../interfaces/IOracle.sol";

contract OracleAdapterMock {

    uint256 public dummyPrice;
    address public asset;

    constructor(address _asset, uint256 _dummyPrice)
        public
    { dummyPrice = _dummyPrice; asset = _asset; }

    function getPrice(address _assetOne, address _assetTwo)
        external
        view
        returns (bool, uint256)
    {
        _assetTwo; // Used to silence compiler warnings

        if (_assetOne == asset) {
            return (true, dummyPrice);
        } else {
            return (false, 0);
        }
    }
}