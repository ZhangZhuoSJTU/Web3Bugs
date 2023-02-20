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

import { ICErc20 } from "../../../interfaces/external/ICErc20.sol";
import { Compound } from "../lib/Compound.sol";

/**
 * @title CompoundWrapV2Adapter
 * @author Set Protocol
 *
 * Wrap adapter for Compound that returns data for wraps/unwraps of tokens
 */
contract CompoundWrapV2Adapter {
  using Compound for ICErc20;


  /* ============ Constants ============ */

    // Compound Mock address to indicate ETH. ETH is used directly in Compound protocol (instead of an abstraction such as WETH)
    address public constant ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to wrap an underlying asset into a wrappedToken.
     *
     * @param _underlyingToken      Address of the component to be wrapped
     * @param _wrappedToken         Address of the desired wrapped token
     * @param _underlyingUnits      Total quantity of underlying units to wrap
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of underlying units (if underlying is ETH)
     * @return bytes                Wrap calldata
     */
    function getWrapCallData(
        address _underlyingToken,
        address _wrappedToken,
        uint256 _underlyingUnits,
        address /* _to */,
        bytes memory /* _wrapData */
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        uint256 value;
        bytes memory callData;
        if (_underlyingToken == ETH_TOKEN_ADDRESS) {
            value = _underlyingUnits;
            ( , , callData) = ICErc20(_wrappedToken).getMintCEtherCalldata(_underlyingUnits);
        } else {
            value = 0;
            ( , , callData) = ICErc20(_wrappedToken).getMintCTokenCalldata(_underlyingUnits);
        }

        return (_wrappedToken, value, callData);
    }

    /**
     * Generates the calldata to unwrap a wrapped asset into its underlying.
     *
     * @param _wrappedToken         Address of the component to be unwrapped
     * @param _wrappedTokenUnits    Total quantity of wrapped token units to unwrap
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of wrapped token units to unwrap. This will always be 0 for unwrapping
     * @return bytes                Unwrap calldata
     */
    function getUnwrapCallData(
        address /* _underlyingToken */,
        address _wrappedToken,
        uint256 _wrappedTokenUnits,
        address /* _to */,
        bytes memory /* _unwrapData */
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        ( , , bytes memory callData) = ICErc20(_wrappedToken).getRedeemCalldata(_wrappedTokenUnits);
        return (_wrappedToken, 0, callData);
    }

    /**
     * Returns the address to approve source tokens for wrapping.
     * @param _wrappedToken         Address of the wrapped token
     * @return address              Address of the contract to approve tokens to
     */
     function getSpenderAddress(address /* _underlyingToken */, address _wrappedToken) external pure returns(address) {
         return address(_wrappedToken);
     }

}
