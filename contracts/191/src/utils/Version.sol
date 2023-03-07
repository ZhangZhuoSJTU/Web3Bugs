// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

contract Version {
  uint32 private immutable __version;

  /// @notice The version of the contract
  /// @return The version ID of this contract implementation
  function contractVersion() external view returns (uint32) {
      return __version;
  }

  constructor(uint32 version) {
    __version = version;
  }
}