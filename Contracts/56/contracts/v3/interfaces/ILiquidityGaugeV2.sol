// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface ILiquidityGaugeV2 {
    function set_approve_deposit(address, bool) external;
    function deposit(uint256) external;
    function withdraw(uint256) external;
}
