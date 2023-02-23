// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IRestrictedTransferHook.sol";
import "./BlocklistTransferHook.sol";

contract RestrictedTransferHook is
  IRestrictedTransferHook,
  BlocklistTransferHook
{
  IAccountList private sourceAllowlist;
  IAccountList private destinationAllowlist;

  constructor() {}

  function hook(
    address _from,
    address _to,
    uint256 _amount
  ) public virtual override(BlocklistTransferHook, ITransferHook) {
    super.hook(_from, _to, _amount);
    if (sourceAllowlist.isIncluded(_from)) return;
    require(destinationAllowlist.isIncluded(_to), "Destination not allowed");
  }

  function setSourceAllowlist(IAccountList _newSourceAllowlist)
    external
    override
    onlyOwner
  {
    sourceAllowlist = _newSourceAllowlist;
    emit SourceAllowlistChange(_newSourceAllowlist);
  }

  function setDestinationAllowlist(IAccountList _newDestinationAllowlist)
    external
    override
    onlyOwner
  {
    destinationAllowlist = _newDestinationAllowlist;
    emit DestinationAllowlistChange(_newDestinationAllowlist);
  }

  function getSourceAllowlist() external view override returns (IAccountList) {
    return sourceAllowlist;
  }

  function getDestinationAllowlist()
    external
    view
    override
    returns (IAccountList)
  {
    return destinationAllowlist;
  }
}
