// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

abstract contract ERC677Receiver {
  function onTokenTransfer(address _sender, uint _value, bytes memory _data) public virtual;
}
