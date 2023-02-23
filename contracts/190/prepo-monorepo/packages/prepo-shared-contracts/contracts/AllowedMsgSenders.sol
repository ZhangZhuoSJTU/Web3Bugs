// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IAllowedMsgSenders.sol";
import "./interfaces/IAccountList.sol";

contract AllowedMsgSenders is IAllowedMsgSenders {
  IAccountList private _allowedMsgSenders;

  modifier onlyAllowedMsgSenders() {
    require(_allowedMsgSenders.isIncluded(msg.sender), "msg.sender not allowed");
    _;
  }

  function setAllowedMsgSenders(IAccountList allowedMsgSenders) public virtual override {
    _allowedMsgSenders = allowedMsgSenders;
    emit AllowedMsgSendersChange(allowedMsgSenders);
  }

  function getAllowedMsgSenders() external view virtual override returns (IAccountList) {
    return _allowedMsgSenders;
  }
}
