// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../proxy/IBeacon.sol";

interface INFTXVaultFactory is IBeacon{
  // Read functions.
  function numVaults() external view returns (uint256);
  function prevContract() external view returns (address);
  function feeReceiver() external view returns (address);
  function eligibilityManager() external view returns (address);
  function vault(uint256 vaultId) external view returns (address);

  event NewFeeReceiver(address oldReceiver, address newReceiver);
  event NewVault(uint256 indexed vaultId, address vaultAddress, address assetAddress);

  // Write functions.
  function __NFTXVaultFactory_init(address _vaultImpl, address _prevContract, address _feeReceiver) external;
  function createVault(
      string calldata name,
      string calldata symbol,
      address _assetAddress,
      bool is1155,
      bool allowAllItems
  ) external returns (uint256);
  function setFeeReceiver(address _feeReceiver) external;
}