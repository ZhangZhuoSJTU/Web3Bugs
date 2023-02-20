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
 * @title AGIMigrationAdapter
 * @author Set Protocol
 *
 * "Migration" adapter that burns the AGI tokens currently in the Set in order to remove them
 * from the Set's positions. The AGI token was permanently paused after migration however it still
 * remains as a position in Sets that hold it. By calling the burn function we can zero out a
 * Set's position and remove it from tracking.
 */
contract AGIMigrationWrapAdapter {

    /* ============ State Variables ============ */

    address public immutable agiLegacyToken;
    address public immutable agixToken;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _agiLegacyToken                   Address of AGI Legacy token
     * @param _agixToken                        Address of AGIX token
     */
    constructor(
        address _agiLegacyToken,
        address _agixToken
    )
        public
    {
        agiLegacyToken = _agiLegacyToken;
        agixToken = _agixToken;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to burn AGI. Requires underlying to be AGI address and wrapped
     * token to be AGIX address.
     *
     * @param _underlyingToken      Address of the component to be wrapped
     * @param _wrappedToken         Address of the wrapped component
     * @param _underlyingUnits      Total quantity of underlying units to wrap
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of underlying units (if underlying is ETH)
     * @return bytes                Wrap calldata
     */
    function getWrapCallData(
        address _underlyingToken,
        address _wrappedToken,
        uint256 _underlyingUnits
    )
        external
        view
        returns (address, uint256, bytes memory)
    {
        require(_underlyingToken == agiLegacyToken, "Must be AGI token");
        require(_wrappedToken == agixToken, "Must be AGIX token");

        // burn(uint256 value)
        bytes memory callData = abi.encodeWithSignature("burn(uint256)", _underlyingUnits);

        return (agiLegacyToken, 0, callData);
    }

    /**
     * This function will revert, since burn cannot be reversed.
     */
    function getUnwrapCallData(
        address /* _underlyingToken */,
        address /* _wrappedToken */,
        uint256 /* _wrappedTokenUnits */
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        revert("AGI burn cannot be reversed");
    }

    /**
     * Returns the address to approve source tokens for wrapping.
     *
     * @return address        Address of the contract to approve tokens to
     */
    function getSpenderAddress(address /* _underlyingToken */, address /* _wrappedToken */) external view returns(address) {
        return agiLegacyToken;
    }
}
