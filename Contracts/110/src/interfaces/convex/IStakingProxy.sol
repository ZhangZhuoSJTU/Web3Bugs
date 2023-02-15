// SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0 <= 0.9.0;

interface IStakingProxy {
    function getBalance() external view returns (uint256);

    function withdraw(uint256 _amount) external;

    function stake() external;

    function distribute() external;
}
