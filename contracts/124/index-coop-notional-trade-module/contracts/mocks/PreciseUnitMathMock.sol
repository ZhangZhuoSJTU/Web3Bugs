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

import { PreciseUnitMath } from "../lib/PreciseUnitMath.sol";


contract PreciseUnitMathMock {
    using PreciseUnitMath for uint256;
    using PreciseUnitMath for int256;

    function preciseUnit() external pure returns(uint256) {
        return PreciseUnitMath.preciseUnit();
    }

    function preciseUnitInt() external pure returns(int256) {
        return PreciseUnitMath.preciseUnitInt();
    }

    function maxInt256() external pure returns(int256) {
        return PreciseUnitMath.maxInt256();
    }

    function minInt256() external pure returns(int256) {
        return PreciseUnitMath.minInt256();
    }

    function preciseMul(uint256 a, uint256 b) external pure returns(uint256) {
        return a.preciseMul(b);
    }

    function preciseMulInt(int256 a, int256 b) external pure returns(int256) {
        return a.preciseMul(b);
    }

    function preciseMulCeil(uint256 a, uint256 b) external pure returns(uint256) {
        return a.preciseMulCeil(b);
    }

    function preciseDiv(uint256 a, uint256 b) external pure returns(uint256) {
        return a.preciseDiv(b);
    }

    function preciseDiv(int256 a, int256 b) external pure returns(int256) {
        return a.preciseDiv(b);
    }

    function preciseDivCeil(uint256 a, uint256 b) external pure returns(uint256) {
        return a.preciseDivCeil(b);
    }

    function preciseDivCeilInt(int256 a, int256 b) external pure returns(int256) {
        return a.preciseDivCeil(b);
    }

    function divDown(int256 a, int256 b) external pure returns(int256) {
        return a.divDown(b);
    }

    function conservativePreciseMul(int256 a, int256 b) external pure returns(int256) {
        return a.conservativePreciseMul(b);
    }

    function conservativePreciseDiv(int256 a, int256 b) external pure returns(int256) {
        return a.conservativePreciseDiv(b);
    }

    function safePower(uint256 a, uint256 b) external pure returns(uint256) {
        return a.safePower(b);
    }

    function approximatelyEquals(uint256 a, uint256 b, uint256 range) external pure returns (bool) {
        return a.approximatelyEquals(b, range);
    }

    function abs(int256 a) external pure returns (uint256) {
        return a.abs();
    }

    function neg(int256 a) external pure returns (int256) {
        return a.neg();
    }
}
