// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IBlocklistTransferHook.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract BlocklistTransferHook is IBlocklistTransferHook, SafeOwnable {
  IAccountList private blocklist;

  constructor() {}

  function hook(
    address _from,
    address _to,
    uint256 // _amount
  ) public virtual override {
    IAccountList _list = blocklist;
    require(!_list.isIncluded(_from), "Sender blocked");
    require(!_list.isIncluded(_to), "Recipient blocked");
  }

  function setBlocklist(IAccountList _newBlocklist)
    external
    override
    onlyOwner
  {
    blocklist = _newBlocklist;
    emit BlocklistChange(_newBlocklist);
  }

  function getBlocklist() external view override returns (IAccountList) {
    return blocklist;
  }
}
