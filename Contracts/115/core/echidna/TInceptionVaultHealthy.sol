//SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./TIVSetup.sol";

contract TInceptionVaultHealthy is TIVSetup {
  using SafeMath for uint256;

  IInceptionVaultsCore internal _inceptionVaultsCore;
  IInceptionVaultsDataProvider internal _inceptionVaultsDataProvider;
  IAdminInceptionVault internal _adminInceptionVault;
  IInceptionVaultPriceFeed internal _inceptionVaultPriceFeed;

  uint256 internal _initialBaseDebt;
  uint256 internal _adminDepositAmount = 10000000000000000000;
  uint256 internal _adminBorrowAmount = 11000000000000000000000;
  uint256 internal _userDepositAmount = 1000000000000000000000;
  uint256 internal _userBorrowAmount = 7000000000000000000000;

  uint256 internal constant _TEST_VAULT_ID = 1;

  constructor() public TIVSetup() {
    IInceptionVaultFactory.InceptionVault memory iv = _inceptionVaultFactory.inceptionVaults(_TEST_VAULT_ID);
    IAdminInceptionVault a = iv.adminInceptionVault;
    IInceptionVaultsCore v = iv.inceptionVaultsCore;
    IInceptionVaultsDataProvider d = iv.inceptionVaultsDataProvider;
    IInceptionVaultPriceFeed p = iv.inceptionVaultPriceFeed;
    _inceptionVaultsCore = v;
    _inceptionVaultsDataProvider = d;
    _inceptionVaultPriceFeed = p;
    _weth.mint(_echidna_caller, _adminDepositAmount);
    _weth.approve(address(a), _adminDepositAmount);

    // Deposit 10 WETH and borrow 11k PAR
    a.depositAndBorrow(address(_weth), _adminDepositAmount, _adminBorrowAmount);

    _link.mint(_echidna_caller, _userDepositAmount);
    _link.approve(address(v), _userDepositAmount);

    // Deposit 1000k LINK and borrow 7k PAR
    v.depositAndBorrow(_userDepositAmount, _userBorrowAmount);

    _initialBaseDebt = d.vaultBaseDebt(_TEST_VAULT_ID);

    // Approve PAR for liquidation
    _par.approve(address(_inceptionVaultsCore), _MAX_INT);
  }

  /// @notice Checks that a user vault base debt cannot be overwritten
  function echidna_user_base_debt_should_not_change() public view returns (bool) {
    uint256 vaultBaseDebt = _inceptionVaultsDataProvider.vaultBaseDebt(1);
    return vaultBaseDebt == _initialBaseDebt;
  }

  /// @notice Checks that user vault collateral balance cannot be overwritten
  function echidna_user_collateral_balance_should_not_change() public view returns (bool) {
    uint256 collateralBalance = _inceptionVaultsDataProvider.vaultCollateralBalance(1);
    return collateralBalance == _userDepositAmount;
  }

  /// @notice Checks that vault owner cannot be overwritten
  function echidna_vault_owner_should_not_change() public view returns (bool) {
    address vaultOwner = _inceptionVaultsDataProvider.vaultOwner(1);
    return vaultOwner == _echidna_caller;
  }

  /// @notice Checks that an calling liquidate() on unhealthy vault always fails
  function echidna_healthy_vault_should_never_be_open_to_liquidation() public returns (bool) {
    try _inceptionVaultsCore.liquidate(_TEST_VAULT_ID)  {
      return false;
    } catch {
      return true;
    }
  }

  /**
  @notice Checks that an calling liquidatePartial() on unhealthy vault always fails
  @param amount liquidation amount
   */
  function healthy_vault_should_never_be_open_to_liquidation(uint256 amount) public {
    try _inceptionVaultsCore.liquidatePartial(_TEST_VAULT_ID, amount)  {
      assert(false);
    } catch {}
  }
}
