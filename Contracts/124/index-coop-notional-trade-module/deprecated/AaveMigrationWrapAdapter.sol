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

/**
 * @title AaveMigrationWrapAdapter
 * @author Set Protocol
 *
 * Wrap adapter for one time token migration that returns data for wrapping LEND into AAVE
 */
contract AaveMigrationWrapAdapter {

    /* ============ State Variables ============ */

    // Address of Aave migration contract proxy
    address public immutable lendToAaveMigrationProxy;

    // Address of LEND token
    address public immutable lendToken;

    // Address of AAVE token
    address public immutable aaveToken;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _lendToAaveMigrationProxy     Address of Aave migration contract proxy
     * @param _lendToken                    Address of LEND token
     * @param _aaveToken                    Address of AAVE token
     */
    constructor(
        address _lendToAaveMigrationProxy,
        address _lendToken,
        address _aaveToken
    )
        public
    {
        lendToAaveMigrationProxy = _lendToAaveMigrationProxy;
        lendToken = _lendToken;
        aaveToken = _aaveToken;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to migrate LEND to AAVE.
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
        require(_underlyingToken == lendToken, "Must be LEND token");
        require(_wrappedToken == aaveToken, "Must be AAVE token");

        // migrateFromLEND(uint256 _amount)
        bytes memory callData = abi.encodeWithSignature("migrateFromLEND(uint256)", _underlyingUnits);

        return (lendToAaveMigrationProxy, 0, callData);
    }

    /**
     * Generates the calldata to unwrap a wrapped asset into its underlying. Note: Migration cannot be reversed. This function
     * will revert.
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of wrapped token units to unwrap. This will always be 0 for unwrapping
     * @return bytes                Unwrap calldata
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
        revert("AAVE migration cannot be reversed");
    }

    /**
     * Returns the address to approve source tokens for wrapping.
     *
     * @return address        Address of the contract to approve tokens to
     */
    function getSpenderAddress(address /* _underlyingToken */, address /* _wrappedToken */) external view returns(address) {
        return lendToAaveMigrationProxy;
    }
}
