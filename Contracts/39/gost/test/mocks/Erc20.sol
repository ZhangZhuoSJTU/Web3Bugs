// SPDX-License-Identifier: UNLICENSED

/**
  Erc20 is a mock which records arguments passed to its methods as well as
  provides setters allowing us to dictate method return values
*/

pragma solidity 0.8.4;

contract Erc20 {
  // a struct to hold the arguments passed to transferFrom
  struct TransferFromArgs {
    address to;
    uint256 amount;
  }

  // mapping for arguments passed to approve
  mapping (address => uint256) public approveCalled;
  // mapping of arguments sent to transfer. key is the passed in address.
  mapping (address => uint256) public transferCalled;
  // mapping of arguments sent to transferFrom. key is passed from address.
  mapping (address => TransferFromArgs) public transferFromCalled;
  // balanceOf does not require a mapping.
  address public balanceOfCalled;

  // a boolean flag which allows us to dictate the return of approve(). 
  bool private approveReturn;
  // a uint to return for balanceOf calls
  uint256 private balanceOfReturn;
  // a boolean flag which allows us to dictate the return of transfer().
  bool private transferReturn;
  // a boolean flag which allows us to dictate the return of transferFrom().
  bool private transferFromReturn;

  function approve(address s, uint256 a) public returns (bool) {
    approveCalled[s] = a;
    return approveReturn;
  }

  function approveReturns(bool b) public {
    approveReturn = b;
  }

  function balanceOfReturns(uint256 b) public {
    balanceOfReturn = b;
  }

  function balanceOf(address t) public returns (uint256) {
    balanceOfCalled = t;
    return balanceOfReturn;
  }

  function transfer(address t, uint256 a) public returns (bool) {
    transferCalled[t] = a;
    return transferReturn;
  }

  function transferReturns(bool b) public {
    transferReturn = b;
  }

  function transferFrom(address f, address t, uint256 a) public returns (bool) {
    TransferFromArgs memory args;
    args.to = t;
    args.amount = a;
    transferFromCalled[f] = args;
    return transferFromReturn;
  }

  function transferFromReturns(bool b) public {
    transferFromReturn = b;
  }

}
