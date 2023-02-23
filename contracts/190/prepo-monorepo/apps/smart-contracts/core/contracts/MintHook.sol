// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IMarketHook.sol";
import "prepo-shared-contracts/contracts/AllowedMsgSenders.sol";
import "prepo-shared-contracts/contracts/AccountListCaller.sol";
import "prepo-shared-contracts/contracts/interfaces/IAccountList.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract MintHook is IMarketHook, AllowedMsgSenders, AccountListCaller, SafeOwnable {
  /**
   * @dev Since, minting of PrePOMarket positions will only be done by
   * governance, there is no fee to take or reimburse, so only an allowlist
   * check is needed.
   */
  function hook(address sender, uint256 amountBeforeFee, uint256 amountAfterFee) external virtual override onlyAllowedMsgSenders { require(_accountList.isIncluded(sender), "minter not allowed"); }

  function setAllowedMsgSenders(IAccountList allowedMsgSenders) public virtual override onlyOwner { super.setAllowedMsgSenders(allowedMsgSenders); }

  function setAccountList(IAccountList accountList) public virtual override onlyOwner { super.setAccountList(accountList); }
}
