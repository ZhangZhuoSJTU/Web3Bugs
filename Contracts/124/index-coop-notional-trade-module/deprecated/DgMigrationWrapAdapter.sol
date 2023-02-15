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

/**
 * @title DgMigrationWrapAdapter
 * @author Set Protocol
 *
 * Wrap adapter for one time token migration from DG V1 to DG V2.
 * Note: DG V2 cannot be unwrapped into DG V1, because the migration cannot be reversed.
 */
contract DgMigrationWrapAdapter {

    /* ============ State Variables ============ */

    address public immutable dgTokenV1;
    address public immutable dgTokenV2;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     * @param _dgTokenV1                Address of DG token V1
     * @param _dgTokenV2                Address of DG token V2
     */
    constructor(address _dgTokenV1, address _dgTokenV2) public {
        dgTokenV1 = _dgTokenV1;
        dgTokenV2 = _dgTokenV2;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to migrate DG V1 tokens to DG V2 tokens.
     * @param _underlyingToken          Address of the underlying token
     * @param _wrappedToken             Address of the wrapped token
     * @param _notionalUnderlying       Total quantity of underlying tokens to migrate
     *
     * @return address                  Target contract address
     * @return uint256                  Total quantity of underlying units (if underlying is ETH)
     * @return bytes                    Wrap calldata
     */
    function getWrapCallData(
        address _underlyingToken,
        address _wrappedToken,
        uint256 _notionalUnderlying
    ) external view returns (address, uint256, bytes memory) {
        require(_underlyingToken == dgTokenV1, "Must be DG V1 token");
        require(_wrappedToken == dgTokenV2, "Must be DG V2 token");

        // goLight(uint256)
        bytes memory callData = abi.encodeWithSignature("goLight(uint256)", _notionalUnderlying);

        return (dgTokenV2, 0, callData);
    }

    /**
     * This function will revert, since migration cannot be reversed.
     */
    function getUnwrapCallData(
        address /* _underlyingToken */,
        address /* _wrappedToken */,
        uint256 /* _notionalWrapped */
    ) external pure returns (address, uint256, bytes memory) {
        revert("DG migration cannot be reversed");
    }

    /**
     * Returns the address to approve source tokens for wrapping.
     *
     * @return address        Address of the contract to approve tokens to
     */
    function getSpenderAddress(
        address /* _underlyingToken */,
        address /* _wrappedToken */
    )
        external
        view
        returns (address)
    {
        return dgTokenV2;
    }
}
