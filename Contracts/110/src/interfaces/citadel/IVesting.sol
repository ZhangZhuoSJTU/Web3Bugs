// SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0 <= 0.9.0;

interface IVesting {
    function setupVesting(
        address recipient,
        uint256 _amount,
        uint256 _unlockBegin
    ) external;
}
