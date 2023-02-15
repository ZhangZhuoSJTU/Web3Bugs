// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface Stabilizer {
  function refreshAndRelease() external;

  function withdraw(
    address tokenAddress,
    uint256 amount,
    address destination
  ) external;

  function withdrawAll(address destination) external;

  function liquidate(uint256 vaultId) external;

  function WETH() external view returns (address);

  function PAR() external view returns (address);

  function pool() external view returns (address);

  function demandMiner() external view returns (address);

  function mimoDistributor() external view returns (address);

  function a() external view returns (address);

  function AUTOMATOR_ADDRESS() external view returns (address);

  function owner() external view returns (address);
}
