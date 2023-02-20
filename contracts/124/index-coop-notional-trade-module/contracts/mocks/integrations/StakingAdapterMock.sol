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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title StakingAdapterMock
 * @author Set Protocol
 *
 * Staking Adapter that doubles as a mock Staking contract as well.
 */
contract StakingAdapterMock {
    using SafeMath for uint256;

    uint256 public PRECISE_UNIT = 1e18;

    mapping(address => uint256) public stakes;
    uint256 public unstakeFee;
    IERC20 public stakingAsset;

    /* ============ Constructor ============ */
    constructor(IERC20 _stakingAsset) public {
        stakingAsset = _stakingAsset;
    }

    /* ============ Staking Functions ============ */

    function stake(uint256 _amount) external {
        stakingAsset.transferFrom(msg.sender, address(this), _amount);
        stakes[msg.sender] = stakes[msg.sender].add(_amount);
    }

    function unstake(uint256 _amount) external {
        stakes[msg.sender] = stakes[msg.sender].sub(_amount);
        stakingAsset.transfer(msg.sender, _amount.mul(PRECISE_UNIT.sub(unstakeFee)).div(PRECISE_UNIT));
    }

    function setUnstakeFee(uint256 _fee) external {
        unstakeFee = _fee;
    }

    /* ============ Adapter Functions ============ */

    function getStakeCallData(
        address _stakingContract,
        uint256 _notionalAmount
    )
        external
        pure
        returns(address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature("stake(uint256)", _notionalAmount);
        return (_stakingContract, 0, callData);
    }

    function getUnstakeCallData(
        address _stakingContract,
        uint256 _notionalAmount
    )
        external
        pure
        returns(address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature("unstake(uint256)", _notionalAmount);
        return (_stakingContract, 0, callData);
    }

    function getSpenderAddress(address /* _pool */) external view returns(address) {
        return address(this);
    }
}