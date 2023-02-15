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

import "../StandardTokenMock.sol";

// mock class using BasicToken
contract SynthMock is StandardTokenMock {
    bytes32 public currencyKey;

    constructor(
        address _initialAccount,
        uint256 _initialBalance,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        bytes32 _currencyKey
    )
        public
        StandardTokenMock(
            _initialAccount,
            _initialBalance,
            _name,
            _symbol,
            _decimals
        )
    {
        currencyKey = _currencyKey;
    }
}
