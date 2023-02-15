// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

interface IWETH {
    function deposit() external payable;

    function withdraw(uint256) external;
}
