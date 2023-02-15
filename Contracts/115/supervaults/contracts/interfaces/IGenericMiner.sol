// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.8.10;

import "./IGovernanceAddressProvider.sol";

interface IGenericMiner {
  function a() external view returns (IGovernanceAddressProvider);

  function releaseMIMO(address _user) external;
}
