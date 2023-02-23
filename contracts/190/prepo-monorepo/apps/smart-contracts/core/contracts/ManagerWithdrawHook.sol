// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IManagerWithdrawHook.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";

contract ManagerWithdrawHook is IManagerWithdrawHook, SafeAccessControlEnumerable {
  ICollateral private collateral;
  IDepositRecord private depositRecord;
  uint256 private minReservePercentage;

  uint256 public constant PERCENT_DENOMINATOR = 1000000;
  bytes32 public constant SET_COLLATERAL_ROLE = keccak256("ManagerWithdrawHook_setCollateral(address)");
  bytes32 public constant SET_DEPOSIT_RECORD_ROLE = keccak256("ManagerWithdrawHook_setDepositRecord(address)");
  bytes32 public constant SET_MIN_RESERVE_PERCENTAGE_ROLE = keccak256("ManagerWithdrawHook_setMinReservePercentage(uint256)");

  function hook(address, uint256, uint256 _amountAfterFee) external view override { require(collateral.getReserve() - _amountAfterFee >= getMinReserve(), "reserve would fall below minimum"); }

  function setCollateral(ICollateral _newCollateral) external override onlyRole(SET_COLLATERAL_ROLE) {
    collateral = _newCollateral;
    emit CollateralChange(address(_newCollateral));
  }

  function setDepositRecord(IDepositRecord _newDepositRecord) external override onlyRole(SET_DEPOSIT_RECORD_ROLE) {
    depositRecord = _newDepositRecord;
    emit DepositRecordChange(address(_newDepositRecord));
  }

  function setMinReservePercentage(uint256 _newMinReservePercentage) external override onlyRole(SET_MIN_RESERVE_PERCENTAGE_ROLE) {
    require(_newMinReservePercentage <= PERCENT_DENOMINATOR, ">100%");
    minReservePercentage = _newMinReservePercentage;
    emit MinReservePercentageChange(_newMinReservePercentage);
  }

  function getCollateral() external view override returns (ICollateral) { return collateral; }

  function getDepositRecord() external view override returns (IDepositRecord) { return depositRecord; }

  function getMinReservePercentage() external view override returns (uint256) { return minReservePercentage; }

  function getMinReserve() public view override returns (uint256) { return (depositRecord.getGlobalNetDepositAmount() * minReservePercentage) / PERCENT_DENOMINATOR; }
}
