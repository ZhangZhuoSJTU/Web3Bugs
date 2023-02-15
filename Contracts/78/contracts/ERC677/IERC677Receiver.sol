// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IERC677Receiver {
  function onTokenTransfer(address _sender, uint _value, bytes memory  _data) external;
}