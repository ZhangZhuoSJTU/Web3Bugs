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

import { IAaveLendingPool } from "../../../interfaces/external/IAaveLendingPool.sol";
import { IAaveLendingPoolCore } from "../../../interfaces/external/IAaveLendingPoolCore.sol";

/**
 * @title AaveWrapAdapter
 * @author Set Protocol
 *
 * Wrap adapter for Aave that returns data for wraps/unwraps of tokens
 */
contract AaveWrapAdapter {

    /* ============ Modifiers ============ */

    /**
     * Throws if the underlying/wrapped token pair is not valid
     */
    modifier onlyValidTokenPair(address _underlyingToken, address _wrappedToken) {
        require(validTokenPair(_underlyingToken, _wrappedToken), "Must be a valid token pair");
        _;
    }

    /* ============ Constants ============ */

    // Aave Mock address to indicate ETH. ETH is used directly in Aave protocol (instead of an abstraction such as WETH)
    address public constant ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /* ============ State Variables ============ */

    // Address of Aave Lending Pool to deposit underlying/reserve tokens
    IAaveLendingPool public immutable aaveLendingPool;

    // Address of Aave Lending Pool Core to send approvals
    IAaveLendingPoolCore public immutable aaveLendingPoolCore;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _aaveLendingPool    Address of Aave Lending Pool to deposit underlying/reserve tokens
     */
    constructor(IAaveLendingPool _aaveLendingPool) public {
        aaveLendingPool = _aaveLendingPool;
        aaveLendingPoolCore = IAaveLendingPoolCore(_aaveLendingPool.core());
    }

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
        uint256 _underlyingUnits
    )
        external
        view
        onlyValidTokenPair(_underlyingToken, _wrappedToken)
        returns (address, uint256, bytes memory)
    {
        uint256 value = _underlyingToken == ETH_TOKEN_ADDRESS ? _underlyingUnits : 0;

        // deposit(address _reserve, uint256 _amount, uint16 _referralCode)
        bytes memory callData = abi.encodeWithSignature("deposit(address,uint256,uint16)", _underlyingToken, _underlyingUnits, 0);

        return (address(aaveLendingPool), value, callData);
    }

    /**
     * Generates the calldata to unwrap a wrapped asset into its underlying.
     *
     * @param _underlyingToken      Address of the underlying asset
     * @param _wrappedToken         Address of the component to be unwrapped
     * @param _wrappedTokenUnits    Total quantity of wrapped token units to unwrap
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of wrapped token units to unwrap. This will always be 0 for unwrapping
     * @return bytes                Unwrap calldata
     */
    function getUnwrapCallData(
        address _underlyingToken,
        address _wrappedToken,
        uint256 _wrappedTokenUnits
    )
        external
        view
        onlyValidTokenPair(_underlyingToken, _wrappedToken)
        returns (address, uint256, bytes memory)
    {
        // redeem(uint256 _amount)
        bytes memory callData = abi.encodeWithSignature("redeem(uint256)", _wrappedTokenUnits);

        return (address(_wrappedToken), 0, callData);
    }

    /**
     * Returns the address to approve source tokens for wrapping. This is the Aave Lending Pool Core
     *
     * @return address        Address of the contract to approve tokens to
     */
    function getSpenderAddress(address /* _underlyingToken */, address /* _wrappedToken */) external view returns(address) {
        return address(aaveLendingPoolCore);
    }

    /* ============ Internal Functions ============ */

    /**
     * Validates the underlying and wrapped token pair
     *
     * @param _underlyingToken     Address of the underlying asset
     * @param _wrappedToken        Address of the wrapped asset
     *
     * @return bool                Whether or not the wrapped token accepts the underlying token as collateral
     */
    function validTokenPair(address _underlyingToken, address _wrappedToken) internal view returns(bool) {
        address aToken = aaveLendingPoolCore.getReserveATokenAddress(_underlyingToken);
        return aToken == _wrappedToken;
    }
}
