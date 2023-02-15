// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import "../PublicLock.sol";
import "../interfaces/IPublicLock.sol";

contract TestPublicLockUpgraded is PublicLock {

  // add a function to try
  function sayHello() external pure returns (string memory) {
    return 'hello world';
  }
}

interface ITestPublicLockUpgraded is IPublicLock {
  function sayHello() external pure returns (string memory);
}