// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

interface IRootChainManager {
  function depositFor(
    address userAddress,
    address rootToken,
    bytes memory data
  ) external;
}

interface IStateReceiver {
  function onStateReceive(uint256 id, bytes calldata data) external;
}

interface IChildToken {
  function deposit(address user, bytes calldata depositData) external;

  function withdraw(uint256 amount) external;
}
