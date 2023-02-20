// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IInceptionVaultsCore.sol";
import "../../interfaces/IAddressProvider.sol";

interface IInceptionVaultsDataProvider {
  struct InceptionVault {
    address owner;
    uint256 collateralBalance;
    uint256 baseDebt;
    uint256 createdAt;
  }

  //Write
  function initialize(IInceptionVaultsCore _inceptionVaultsCore, IAddressProvider _addressProvider) external;

  function createVault(address _owner) external returns (uint256);

  function setCollateralBalance(uint256 _id, uint256 _balance) external;

  function setBaseDebt(uint256 _id, uint256 _newBaseDebt) external;

  // Read
  function a() external view returns (IAddressProvider);

  function inceptionVaultsCore() external view returns (IInceptionVaultsCore);

  function inceptionVaultCount() external view returns (uint256);

  function baseDebt() external view returns (uint256);

  function vaults(uint256 _id) external view returns (InceptionVault memory);

  function vaultOwner(uint256 _id) external view returns (address);

  function vaultCollateralBalance(uint256 _id) external view returns (uint256);

  function vaultBaseDebt(uint256 _id) external view returns (uint256);

  function vaultId(address _owner) external view returns (uint256);

  function vaultExists(uint256 _id) external view returns (bool);

  function vaultDebt(uint256 _vaultId) external view returns (uint256);
}
