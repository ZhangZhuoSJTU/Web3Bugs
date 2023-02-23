// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IWithdrawHook.sol";
import "./interfaces/IDepositRecord.sol";
import "prepo-shared-contracts/contracts/TokenSenderCaller.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";

contract WithdrawHook is IWithdrawHook, TokenSenderCaller, SafeAccessControlEnumerable {
  ICollateral private collateral;
  IDepositRecord private depositRecord;
  bool public override withdrawalsAllowed;
  uint256 private globalPeriodLength;
  uint256 private userPeriodLength;
  uint256 private globalWithdrawLimitPerPeriod;
  uint256 private userWithdrawLimitPerPeriod;
  uint256 private lastGlobalPeriodReset;
  uint256 private lastUserPeriodReset;
  uint256 private globalAmountWithdrawnThisPeriod;
  mapping(address => uint256) private userToAmountWithdrawnThisPeriod;

  bytes32 public constant SET_COLLATERAL_ROLE = keccak256("WithdrawHook_setCollateral(address)");
  bytes32 public constant SET_DEPOSIT_RECORD_ROLE = keccak256("WithdrawHook_setDepositRecord(address)");
  bytes32 public constant SET_WITHDRAWALS_ALLOWED_ROLE = keccak256("WithdrawHook_setWithdrawalsAllowed(bool)");
  bytes32 public constant SET_GLOBAL_PERIOD_LENGTH_ROLE = keccak256("WithdrawHook_setGlobalPeriodLength(uint256)");
  bytes32 public constant SET_USER_PERIOD_LENGTH_ROLE = keccak256("WithdrawHook_setUserPeriodLength(uint256)");
  bytes32 public constant SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE = keccak256("WithdrawHook_setGlobalWithdrawLimitPerPeriod(uint256)");
  bytes32 public constant SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE = keccak256("WithdrawHook_setUserWithdrawLimitPerPeriod(uint256)");
  bytes32 public constant SET_TREASURY_ROLE = keccak256("WithdrawHook_setTreasury(address)");
  bytes32 public constant SET_TOKEN_SENDER_ROLE = keccak256("WithdrawHook_setTokenSender(ITokenSender)");

  modifier onlyCollateral() {
    require(msg.sender == address(collateral), "msg.sender != collateral");
    _;
  }

  /**
   * @dev Unlike deposits, access controls are not imposed for withdrawals.
   * However, per-period withdraw limits are enforced.
   *
   * While we could include the period length in the last reset timestamp,
   * not initially adding it means that a change in period will
   * be reflected immediately.
   *
   * Records the withdrawal within `depositRecord`, and sends the fee to the
   * `_treasury`. Fees will be reimbursed to the user in `PPO` token using the
   * `_tokenSender` contract.
   *
   * Uses `_amountBeforeFee` (i.e. the amount of Collateral being burned) for
   * updating global net deposits to reflect the reduction in the contract's
   * liabilities.
   */
  function hook(
    address _sender,
    uint256 _amountBeforeFee,
    uint256 _amountAfterFee
  ) external override onlyCollateral {
    require(withdrawalsAllowed, "withdrawals not allowed");
    if (lastGlobalPeriodReset + globalPeriodLength < block.timestamp) {
      lastGlobalPeriodReset = block.timestamp;
      globalAmountWithdrawnThisPeriod = _amountBeforeFee;
    } else {
      require(globalAmountWithdrawnThisPeriod + _amountBeforeFee <= globalWithdrawLimitPerPeriod, "global withdraw limit exceeded");
      globalAmountWithdrawnThisPeriod += _amountBeforeFee;
    }
    if (lastUserPeriodReset + userPeriodLength < block.timestamp) {
      lastUserPeriodReset = block.timestamp;
      userToAmountWithdrawnThisPeriod[_sender] = _amountBeforeFee;
    } else {
      require(userToAmountWithdrawnThisPeriod[_sender] + _amountBeforeFee <= userWithdrawLimitPerPeriod, "user withdraw limit exceeded");
      userToAmountWithdrawnThisPeriod[_sender] += _amountBeforeFee;
    }
    depositRecord.recordWithdrawal(_amountBeforeFee);
    uint256 _fee = _amountBeforeFee - _amountAfterFee;
    if (_fee > 0) {
      collateral.getBaseToken().transferFrom(address(collateral), _treasury, _fee);
      _tokenSender.send(_sender, _fee);
    }
  }

  function setCollateral(ICollateral _newCollateral) external override onlyRole(SET_COLLATERAL_ROLE) {
    collateral = _newCollateral;
    emit CollateralChange(address(_newCollateral));
  }

  function setDepositRecord(IDepositRecord _newDepositRecord) external override onlyRole(SET_DEPOSIT_RECORD_ROLE) {
    depositRecord = _newDepositRecord;
    emit DepositRecordChange(address(_newDepositRecord));
  }

  function setWithdrawalsAllowed(bool _newWithdrawalsAllowed) external override onlyRole(SET_WITHDRAWALS_ALLOWED_ROLE) {
    withdrawalsAllowed = _newWithdrawalsAllowed;
    emit WithdrawalsAllowedChange(_newWithdrawalsAllowed);
  }

  function setGlobalPeriodLength(uint256 _newGlobalPeriodLength) external override onlyRole(SET_GLOBAL_PERIOD_LENGTH_ROLE) {
    globalPeriodLength = _newGlobalPeriodLength;
    emit GlobalPeriodLengthChange(_newGlobalPeriodLength);
  }

  function setUserPeriodLength(uint256 _newUserPeriodLength) external override onlyRole(SET_USER_PERIOD_LENGTH_ROLE) {
    userPeriodLength = _newUserPeriodLength;
    emit UserPeriodLengthChange(_newUserPeriodLength);
  }

  function setGlobalWithdrawLimitPerPeriod(uint256 _newGlobalWithdrawLimitPerPeriod) external override onlyRole(SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE) {
    globalWithdrawLimitPerPeriod = _newGlobalWithdrawLimitPerPeriod;
    emit GlobalWithdrawLimitPerPeriodChange(_newGlobalWithdrawLimitPerPeriod);
  }

  function setUserWithdrawLimitPerPeriod(uint256 _newUserWithdrawLimitPerPeriod) external override onlyRole(SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE) {
    userWithdrawLimitPerPeriod = _newUserWithdrawLimitPerPeriod;
    emit UserWithdrawLimitPerPeriodChange(_newUserWithdrawLimitPerPeriod);
  }

  function setTreasury(address _treasury) public override onlyRole(SET_TREASURY_ROLE) {
    super.setTreasury(_treasury);
  }

  function setTokenSender(ITokenSender _tokenSender) public override onlyRole(SET_TOKEN_SENDER_ROLE) {
    super.setTokenSender(_tokenSender);
  }

  function getCollateral() external view override returns (ICollateral) {
    return collateral;
  }

  function getDepositRecord() external view override returns (IDepositRecord) {
    return depositRecord;
  }

  function getGlobalPeriodLength() external view override returns (uint256) {
    return globalPeriodLength;
  }

  function getUserPeriodLength() external view override returns (uint256) {
    return userPeriodLength;
  }

  function getGlobalWithdrawLimitPerPeriod() external view override returns (uint256) {
    return globalWithdrawLimitPerPeriod;
  }

  function getUserWithdrawLimitPerPeriod() external view override returns (uint256) {
    return userWithdrawLimitPerPeriod;
  }

  function getLastGlobalPeriodReset() external view override returns (uint256) {
    return lastGlobalPeriodReset;
  }

  function getLastUserPeriodReset() external view override returns (uint256) {
    return lastUserPeriodReset;
  }

  function getGlobalAmountWithdrawnThisPeriod() external view override returns (uint256) {
    return globalAmountWithdrawnThisPeriod;
  }

  function getAmountWithdrawnThisPeriod(address _user) external view override returns (uint256) {
    return userToAmountWithdrawnThisPeriod[_user];
  }
}
