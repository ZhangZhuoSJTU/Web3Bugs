// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IAllowlistPurchaseHook.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract AllowlistPurchaseHook is IAllowlistPurchaseHook, SafeOwnable {
  IAccountList private allowlist;

  constructor() {}

  function hook(
    address, // _purchaser
    address _recipient,
    uint256, // _amount
    uint256, // _price
    bytes calldata // _data
  ) public virtual override {
    require(allowlist.isIncluded(_recipient), "Recipient not allowed");
  }

  function setAllowlist(IAccountList _newAllowlist)
    external
    override
    onlyOwner
  {
    allowlist = _newAllowlist;
    emit AccountListChange(_newAllowlist);
  }

  function getAllowlist() external view override returns (IAccountList) {
    return allowlist;
  }
}
