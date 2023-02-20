// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;


interface IJoinFactory {
  event JoinCreated(address indexed asset, address pool);

  function createJoin(address asset) external returns (address);
}
