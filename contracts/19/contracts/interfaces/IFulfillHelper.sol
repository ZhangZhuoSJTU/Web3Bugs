// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IFulfillHelper {
  function addFunds(
    address user,
    bytes32 transactionId,
    address assetId,
    uint256 amount
  ) external payable;

  function execute(
    address user,
    bytes32 transactionId,
    address assetId,
    uint256 amount,
    bytes calldata callData
  ) external;
}
