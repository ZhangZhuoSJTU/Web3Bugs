// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IJPEGLock {
    function lockFor(
        address _account,
        uint256 _punkIndex,
        uint256 _lockAmount
    ) external;

    function setLockTime(uint256 lockTime) external;
}
