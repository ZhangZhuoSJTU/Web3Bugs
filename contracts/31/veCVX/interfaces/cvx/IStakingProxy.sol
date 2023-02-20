// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IStakingProxy {
    function getBalance() external view returns (uint256);

    function withdraw(uint256 _amount) external;

    function stake() external;

    function distribute() external;
}
