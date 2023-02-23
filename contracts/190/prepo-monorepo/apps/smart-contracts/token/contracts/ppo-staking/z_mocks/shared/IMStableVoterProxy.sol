// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;

interface IMStableVoterProxy {
  function createLock(uint256 _endTime) external;

  function harvestMta() external;

  function extendLock(uint256 _unlockTime) external;

  function exitLock() external returns (uint256 mtaBalance);

  function changeLockAddress(address _newLock) external;
}
