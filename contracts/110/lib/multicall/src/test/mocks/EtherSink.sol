// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

/// @title EtherSink
/// @notice Receives Ether, that's about it \( o_o )/
/// @author andreas@nascent.xyz
contract EtherSink {

  /// >>>>>>>>>>>>>>>>>>>>>>  ACCEPT CALLS  <<<<<<<<<<<<<<<<<<<<<<< ///

  /// @notice Allows the test to receive eth via low level calls
  receive() external payable {}
}