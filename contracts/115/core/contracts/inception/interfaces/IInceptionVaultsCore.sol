//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IInceptionVaultsDataProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IAddressProvider.sol";
import "./IAdminInceptionVault.sol";
import "./IInceptionVaultPriceFeed.sol";

interface IInceptionVaultsCore {
  struct VaultConfig {
    uint256 liquidationRatio;
    uint256 minCollateralRatio;
    uint256 borrowRate;
    uint256 originationFee;
    uint256 liquidationBonus;
    uint256 liquidationFee;
  }

  event Deposited(uint256 indexed vaultId, uint256 amount, address indexed sender);

  event Withdrawn(uint256 indexed vautlId, uint256 amount, address indexed sender);

  event CumulativeRateUpdated(uint256 elapsedTime, uint256 newCumulativeRate);

  event Borrowed(uint256 indexed vaultId, uint256 amount, address indexed sender);

  event Repaid(uint256 indexed vaultId, uint256 amount, address indexed sender);

  event Liquidated(
    uint256 indexed vaultId,
    uint256 debtRepaid,
    uint256 collateralLiquidated,
    address indexed owner,
    address indexed sender
  );

  function initialize(
    address _owner,
    VaultConfig calldata vaultConfig,
    IERC20 _inceptionCollateral,
    IAddressProvider _addressProvider,
    IAdminInceptionVault _adminInceptionVault,
    IInceptionVaultsDataProvider _inceptionVaultsDataProvider,
    IInceptionVaultPriceFeed _inceptionPriceFeed
  ) external;

  function deposit(uint256 _amount) external;

  function depositByVaultId(uint256 _vaultId, uint256 _amount) external;

  function depositAndBorrow(uint256 _depositAmount, uint256 _borrowAmount) external;

  function withdraw(uint256 _vaultId, uint256 _amount) external;

  function borrow(uint256 _vaultId, uint256 _amount) external;

  function repayAll(uint256 _vaultId) external;

  function repay(uint256 _vaultId, uint256 _amount) external;

  function liquidate(uint256 _vaultId) external;

  function liquidatePartial(uint256 _vaultId, uint256 _amount) external;

  // Read only
  function a() external view returns (IAddressProvider);

  function cumulativeRate() external view returns (uint256);

  function lastRefresh() external view returns (uint256);

  function vaultConfig() external view returns (VaultConfig memory);

  function adminInceptionVault() external view returns (IAdminInceptionVault);

  function inceptionVaultsData() external view returns (IInceptionVaultsDataProvider);

  function inceptionCollateral() external view returns (IERC20);

  function inceptionPriceFeed() external view returns (IInceptionVaultPriceFeed);
}
