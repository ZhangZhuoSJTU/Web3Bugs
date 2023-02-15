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

import { IGaugeController } from "../../../interfaces/external/IGaugeController.sol";

/**
 * @title CurveStakingAdapter
 * @author Set Protocol
 *
 * Staking adapter for Curve that returns data to stake/unstake tokens
 */
contract CurveStakingAdapter {

    /* ============ State Variables ============ */

    // Address of the gauge controller
    IGaugeController public immutable gaugeController;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _gaugeController     Address of Gauge Controller
     */
    constructor(IGaugeController _gaugeController) public {
        gaugeController = _gaugeController;
    }

    /* ============ External Functions ============ */

    /**
     * Generates the calldata to stake lp tokens in the staking contract
     *
     * @param _stakingContract          Address of the gauge staking contract
     * @param _notionalAmount           Quantity of token to stake
     *
     * @return address                  Target address
     * @return uint256                  Call value
     * @return bytes                    Stake tokens calldata
     */
    function getStakeCallData(
        address _stakingContract,
        uint256 _notionalAmount
    )
    external
    view
    returns(address, uint256, bytes memory) {
        require(_isValidStakingContract(_stakingContract), "Invalid staking contract");
        bytes memory callData = abi.encodeWithSignature("deposit(uint256)", _notionalAmount);
        return (_stakingContract, 0, callData);
    }

    /**
     * Generates the calldata to unstake lp tokens from the staking contract
     *
     * @param _stakingContract          Address of the gauge staking contract
     * @param _notionalAmount           Quantity of token to stake
     *
     * @return address                  Target address
     * @return uint256                  Call value
     * @return bytes                    Unstake tokens calldata
     */
    function getUnstakeCallData(
        address _stakingContract,
        uint256 _notionalAmount
    )
    external
    view
    returns(address, uint256, bytes memory) {
        require(_isValidStakingContract(_stakingContract), "Invalid staking contract");
        bytes memory callData = abi.encodeWithSignature("withdraw(uint256)", _notionalAmount);
        return (_stakingContract, 0, callData);
    }

    /**
     * Returns the address to approve component for staking tokens.
     *
     * @param _stakingContract          Address of the gauge staking contract
     *
     * @return address                  Address of the contract to approve tokens transfers to
     */
    function getSpenderAddress(address _stakingContract) external pure returns(address) {
        return _stakingContract;
    }

    /**
     * Validates that the staking contract is registered in the gauge controller
     *
     * @param _stakingContract          Address of the gauge staking contract
     *
     * @return bool                     Whether or not the staking contract is valid
     */
    function _isValidStakingContract(address _stakingContract) internal view returns (bool) {
        // If the gauge address is not defined in the gaugeController, gauge_types will revert.
        // Otherwise returns the value.
        // Here we catch the revert and return false to revert with a proper error message
        try gaugeController.gauge_types(_stakingContract) {
            return true;
        } catch {
            return false;
        }
    }
}
