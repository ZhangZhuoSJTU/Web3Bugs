//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IAdminInceptionVault.sol";
import "./IInceptionVaultsCore.sol";
import "./IInceptionVaultsDataProvider.sol";
import "./IInceptionVaultPriceFeed.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/IAddressProvider.sol";
import "../../liquidityMining/interfaces/IDebtNotifier.sol";

interface IInceptionVaultFactory {
  struct InceptionVault {
    address owner;
    IAdminInceptionVault adminInceptionVault;
    IInceptionVaultsCore inceptionVaultsCore;
    IInceptionVaultsDataProvider inceptionVaultsDataProvider;
    IInceptionVaultPriceFeed inceptionVaultPriceFeed;
    bool isCustomPriceFeed;
  }

  event InceptionVaultDeployed(
    address owner,
    IAdminInceptionVault adminInceptionVault,
    IInceptionVaultsCore inceptionVaultsCore,
    IInceptionVaultsDataProvider inceptionVaultsDataProvider,
    IInceptionVaultPriceFeed inceptionVaultPriceFeed
  );

  event PriceFeedAdded(uint16 _id, address _address);

  function cloneInceptionVault(
    IInceptionVaultsCore.VaultConfig calldata _vaultConfig,
    IERC20 _inceptionCollateral,
    address _inceptionVaultPriceFeed,
    address _assetOracle
  ) external;

  function addPriceFeed(address _address) external;

  // Read only
  function a() external view returns (IAddressProvider);

  function debtNotifier() external view returns (IDebtNotifier);

  function weth() external view returns (IWETH);

  function mimo() external view returns (IERC20);

  function adminInceptionVaultBase() external view returns (address);

  function inceptionVaultsCoreBase() external view returns (address);

  function inceptionVaultsDataProviderBase() external view returns (address);

  function inceptionVaultCount() external view returns (uint256);

  function priceFeedCount() external view returns (uint8);

  function inceptionVaults(uint256 _id) external view returns (InceptionVault memory);

  function priceFeeds(uint8 _id) external view returns (address);

  function priceFeedIds(address _priceFeed) external view returns (uint16);
}
