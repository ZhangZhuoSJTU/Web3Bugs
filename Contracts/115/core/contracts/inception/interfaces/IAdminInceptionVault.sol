//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IInceptionVaultsCore.sol";
import "../../interfaces/IAddressProvider.sol";
import "../../interfaces/IWETH.sol";
import "../../liquidityMining/interfaces/IDebtNotifier.sol";

interface IAdminInceptionVault {
  function initialize(
    address owner,
    IAddressProvider _addressProvider,
    IDebtNotifier _debtNotifier,
    IWETH _WETH,
    IERC20 _mimo,
    IInceptionVaultsCore _inceptionVaultsCore
  ) external;

  function depositETH() external payable;

  function depositETHAndBorrow(uint256 _borrowAmount) external payable;

  function deposit(address _collateralType, uint256 _amount) external;

  function depositAndBorrow(
    address _collateralType,
    uint256 _depositAmount,
    uint256 _vaultId
  ) external;

  function borrow(uint256 _vaultId, uint256 _amount) external;

  function withdraw(uint256 _vaultId, uint256 _amount) external;

  function claimMimo() external;

  function lendPAR(uint256 _amoutn, address _to) external;

  function transferMimo(uint256 _amount, address _to) external;

  function transferPar(uint256 _amount, address _to) external;

  function inceptionCore() external view returns (IInceptionVaultsCore);

  function collateralCount() external view returns (uint8);

  function collaterals(uint8 _id) external view returns (address);

  function collateralId(address _collateral) external view returns (uint8);

  // Read only
  function a() external view returns (IAddressProvider);

  function debtNotifier() external view returns (IDebtNotifier);

  function weth() external view returns (IWETH);

  function mimo() external view returns (IERC20);
}
