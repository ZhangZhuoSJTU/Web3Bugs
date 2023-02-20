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

import { IWrappedfCashFactory } from "../interfaces/IWrappedFCashFactory.sol";
import { WrappedfCashMock } from "./WrappedfCashMock.sol";


// mock class using BasicToken
contract WrappedfCashFactoryMock is IWrappedfCashFactory {

    mapping(uint16 => mapping(uint40 => address)) paramsToAddress;
    bool private revertComputeAddress;

    function registerWrapper(uint16 _currencyId, uint40 _maturity, address _fCashWrapper) external {
        paramsToAddress[_currencyId][_maturity] = _fCashWrapper;
    }

    function deployWrapper(uint16 _currencyId, uint40 _maturity) external override returns(address) {
        return computeAddress(_currencyId, _maturity);
    }

    function computeAddress(uint16 _currencyId, uint40 _maturity) public view override returns(address) {
        require(!revertComputeAddress, "Test revertion ComputeAddress");
        return paramsToAddress[_currencyId][_maturity];
    }

    function setRevertComputeAddress(bool _revertComputeAddress) external{
        revertComputeAddress = _revertComputeAddress;
    }


}
