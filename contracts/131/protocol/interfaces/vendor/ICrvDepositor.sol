// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface ICrvDepositor {
    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) external;

    function depositAll(bool _lock, address _stakeAddress) external;
}
