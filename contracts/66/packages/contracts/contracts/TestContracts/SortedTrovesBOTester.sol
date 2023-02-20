// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract SortedTrovesBOTester is BorrowerOperations {

  function resetSortedTroves(address _newSortedTroves) external {
    sortedTroves = ISortedTroves(_newSortedTroves);
  }
}