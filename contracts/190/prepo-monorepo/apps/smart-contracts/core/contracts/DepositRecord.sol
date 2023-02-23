// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IDepositRecord.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";

contract DepositRecord is IDepositRecord, SafeAccessControlEnumerable {
  uint256 private globalNetDepositCap;
  uint256 private globalNetDepositAmount;
  uint256 private userDepositCap;
  mapping(address => uint256) private userToDeposits;
  mapping(address => bool) private allowedHooks;

  bytes32 public constant SET_GLOBAL_NET_DEPOSIT_CAP_ROLE = keccak256("DepositRecord_setGlobalNetDepositCap(uint256)");
  bytes32 public constant SET_USER_DEPOSIT_CAP_ROLE = keccak256("DepositRecord_setUserDepositCap(uint256)");
  bytes32 public constant SET_ALLOWED_HOOK_ROLE = keccak256("DepositRecord_setAllowedHook(address)");

  modifier onlyAllowedHooks() {
    require(allowedHooks[msg.sender], "msg.sender != allowed hook");
    _;
  }

  constructor(uint256 _newGlobalNetDepositCap, uint256 _newUserDepositCap) {
    globalNetDepositCap = _newGlobalNetDepositCap;
    userDepositCap = _newUserDepositCap;
  }

  function recordDeposit(address _sender, uint256 _amount) external override onlyAllowedHooks {
    require(_amount + globalNetDepositAmount <= globalNetDepositCap, "Global deposit cap exceeded");
    require(_amount + userToDeposits[_sender] <= userDepositCap, "User deposit cap exceeded");
    globalNetDepositAmount += _amount;
    userToDeposits[_sender] += _amount;
  }

  function recordWithdrawal(uint256 _amount) external override onlyAllowedHooks {
    if (globalNetDepositAmount > _amount) { globalNetDepositAmount -= _amount; }
    else { globalNetDepositAmount = 0; }
  }

  function setGlobalNetDepositCap(uint256 _newGlobalNetDepositCap) external override onlyRole(SET_GLOBAL_NET_DEPOSIT_CAP_ROLE) {
    globalNetDepositCap = _newGlobalNetDepositCap;
    emit GlobalNetDepositCapChange(globalNetDepositCap);
  }

  function setUserDepositCap(uint256 _newUserDepositCap) external override onlyRole(SET_USER_DEPOSIT_CAP_ROLE) {
    userDepositCap = _newUserDepositCap;
    emit UserDepositCapChange(_newUserDepositCap);
  }

  function setAllowedHook(address _hook, bool _allowed) external override onlyRole(SET_ALLOWED_HOOK_ROLE) {
    allowedHooks[_hook] = _allowed;
    emit AllowedHooksChange(_hook, _allowed);
  }

  function getGlobalNetDepositCap() external view override returns (uint256) { return globalNetDepositCap; }

  function getGlobalNetDepositAmount() external view override returns (uint256) { return globalNetDepositAmount; }

  function getUserDepositCap() external view override returns (uint256) { return userDepositCap; }

  function getUserDepositAmount(address _account) external view override returns (uint256) { return userToDeposits[_account]; }

  function isHookAllowed(address _hook) external view override returns (bool) { return allowedHooks[_hook]; }
}
