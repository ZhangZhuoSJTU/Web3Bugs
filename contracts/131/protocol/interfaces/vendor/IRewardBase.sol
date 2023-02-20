// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

// NOTE: does not strictly but contains fucntions from `BaseRewardPool`
interface IRewardBase {
    function periodFinish() external view returns (uint256);
}
