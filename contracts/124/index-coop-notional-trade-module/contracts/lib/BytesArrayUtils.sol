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

/**
 * @title BytesArrayUtils
 * @author Set Protocol
 *
 * Utility library to type cast bytes arrays. Extends BytesLib (external/contracts/uniswap/v3/lib/BytesLib.sol)
 * library functionality.
 */
library BytesArrayUtils {

    /**
     * Type cast byte to boolean.
     * @param _bytes        Bytes array
     * @param _start        Starting index
     * @return bool        Boolean value
     */
    function toBool(bytes memory _bytes, uint256 _start) internal pure returns (bool) {
        require(_start + 1 >= _start, "toBool_overflow");
        require(_bytes.length >= _start + 1, "toBool_outOfBounds");
        uint8 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x1), _start))
        }

        require(tempUint <= 1, "Invalid bool data");     // Should be either 0 or 1

        return (tempUint == 0) ? false : true;
    }
}