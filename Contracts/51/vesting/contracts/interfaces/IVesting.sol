// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IVesting {
   function vest(address _beneficiary, uint256 _amount, uint256 _isRevocable) external payable;
}
