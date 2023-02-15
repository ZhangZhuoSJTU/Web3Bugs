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

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ISetToken } from "../../interfaces/ISetToken.sol";

contract ClaimAdapterMock is ERC20  {

    /* ============ State Variables ============ */

    uint256 public rewards;

    /* ============ Constructor ============ */
    constructor() public ERC20("ClaimAdapter", "CLAIM") {}

    /* ============ External Functions ============ */

    function setRewards(uint256 _rewards) external {
        rewards = _rewards;
    }

    function mint() external {
        _mint(msg.sender, rewards);
    }

    function getClaimCallData(
        ISetToken _holder,
        address _rewardPool
    ) external view returns(address _subject, uint256 _value, bytes memory _calldata) {
        // Quell compiler warnings about unused vars
        _holder;
        _rewardPool;

        bytes memory callData = abi.encodeWithSignature("mint()");
        return (address(this), 0, callData);
    }

    function getRewardsAmount(ISetToken _holder, address _rewardPool) external view returns(uint256) {
        // Quell compiler warnings about unused vars
        _holder;
        _rewardPool;

        return rewards;
    }

    function getTokenAddress(address _rewardPool) external view returns(IERC20) {
        // Quell compiler warnings about unused vars
        _rewardPool;

        return this;
    }
}
