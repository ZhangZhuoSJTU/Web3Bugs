// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;


interface IJoinFactory {
  event JoinCreated(address indexed asset, address pool);

  function JOIN_BYTECODE_HASH() external pure returns (bytes32);
  function calculateJoinAddress(address asset) external view returns (address);
  function getJoin(address asset) external view returns (address);
  function createJoin(address asset) external returns (address);
  function nextAsset() external view returns (address);
}
