//SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./TIVSetup.sol";

contract TInceptionVaultUnhealthy is TIVSetup {
  IInceptionVaultsCore internal _inceptionVaultsCore;
  IInceptionVaultsDataProvider internal _inceptionVaultsDataProvider;
  IAdminInceptionVault internal _adminInceptionVault;
  IInceptionVaultPriceFeed internal _inceptionVaultPriceFeed;

  event AssertionFailed(uint256);
  event vaultConfig(uint256, uint256, uint256);

  uint256 internal _adminDepositAmount = 10000000000000000000;
  uint256 internal _adminBorrowAmount = 11000000000000000000000;
  uint256 internal _userDepositAmount = 1000000000000000000000;
  uint256 internal _userBorrowAmount = 7000000000000000000000;

  uint256 internal constant _TEST_VAULT_ID = 1;

  bool internal _exist;

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

    // Update LINK price to $8 to make vault unhealthy
    _linkAggregator.setLatestPrice(800000000);

    // Approve PAR for liquidation
    _par.approve(address(_inceptionVaultsCore), _MAX_INT);
  }

  /**
  @notice Checks that calling liquidatePartial() on unhealthy vault never reverts
  @param amount Liquidation amount
   */
  function unhealthy_vault_should_always_be_open_to_liquidation(uint256 amount) public {
    uint256 vaultDebt = _inceptionVaultsDataProvider.vaultBaseDebt(_TEST_VAULT_ID);
    if (vaultDebt > 0) {
      try _inceptionVaultsCore.liquidatePartial(_TEST_VAULT_ID, amount)  {} catch {
        assert(false);
      }
    }
  }

  /**
  @notice Checks that calling borrow() on unheathy vault always reverts
  @param amount Borrow amount
   */
  function user_should_never_be_able_to_borrow_from_unhealthy_vault(uint256 amount) public {
    uint256 vaultDebt = _inceptionVaultsDataProvider.vaultBaseDebt(_TEST_VAULT_ID);
    if (vaultDebt > 0) {
      try _inceptionVaultsCore.borrow(_TEST_VAULT_ID, amount)  {
        assert(false);
      } catch {}
    }
  }

  /**
  @notice Checks that calling withdraw() on unhealthy vault always reverts
  @param amount Withdraw amount
   */
  function user_should_never_be_able_to_withdraw_from_unhealthy_vault(uint256 amount) public {
    uint256 vaultDebt = _inceptionVaultsDataProvider.vaultBaseDebt(_TEST_VAULT_ID);
    if (vaultDebt > 0) {
      try _inceptionVaultsCore.withdraw(_TEST_VAULT_ID, amount)  {
        assert(false);
      } catch {}
    }
  }
}
