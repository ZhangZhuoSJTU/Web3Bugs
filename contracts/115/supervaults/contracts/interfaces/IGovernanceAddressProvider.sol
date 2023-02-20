// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;

pragma solidity 0.8.10;

import "./IMIMO.sol";

interface IGovernanceAddressProvider {
  function mimo() external view returns (IMIMO);
}
