// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

interface ITellorCaller {
    function getTellorCurrentValue(uint256 _requestId) external view returns (bool, uint256, uint256);
}