// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IAccountList.sol";
import "./interfaces/IAccountListCaller.sol";

contract AccountListCaller is IAccountListCaller {
  IAccountList internal _accountList;

  function setAccountList(IAccountList accountList) public virtual override {
    _accountList = accountList;
    emit AccountListChange(accountList);
  }

  function getAccountList() external view override returns (IAccountList) {
    return _accountList;
  }
}
