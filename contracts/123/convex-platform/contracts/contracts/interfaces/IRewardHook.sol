// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IRewardHook {
    function onRewardClaim() external;
}