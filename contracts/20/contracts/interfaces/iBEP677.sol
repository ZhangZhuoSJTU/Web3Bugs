// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface iBEP677 {
 function onTokenApproval(address token, uint amount, address member,bytes calldata data) external;
 function onTokenTransfer(address token, uint amount, address member,bytes calldata data) external;
}