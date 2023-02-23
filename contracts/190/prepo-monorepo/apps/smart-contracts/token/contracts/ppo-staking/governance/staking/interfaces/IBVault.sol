// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct ExitPoolRequest {
  address[] assets;
  uint256[] minAmountsOut;
  bytes userData;
  bool toInternalBalance;
}

interface IBVault {
  function exitPool(
    bytes32 poolId,
    address sender,
    address payable recipient,
    ExitPoolRequest memory request
  ) external;

  function getPoolTokens(bytes32 poolId)
    external
    view
    returns (
      address[] memory tokens,
      uint256[] memory balances,
      uint256 lastChangeBlock
    );
}
