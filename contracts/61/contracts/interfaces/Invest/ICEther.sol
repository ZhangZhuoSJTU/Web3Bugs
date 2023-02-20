// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

interface ICEther {
    function mint() external payable;

    function repayBorrow() external payable;

    function repayBorrowBehalf(address borrower) external payable;

    function liquidateBorrow(address borrower, address cTokenCollateral) external payable;
}
