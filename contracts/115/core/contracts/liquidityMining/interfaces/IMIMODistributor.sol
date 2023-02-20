// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../../governance/interfaces/IGovernanceAddressProvider.sol";
import "./IBaseDistributor.sol";

interface IMIMODistributorExtension {
  function startTime() external view returns (uint256);

  function currentIssuance() external view returns (uint256);

  function weeklyIssuanceAt(uint256 timestamp) external view returns (uint256);

  function totalSupplyAt(uint256 timestamp) external view returns (uint256);
}

interface IMIMODistributor is IBaseDistributor, IMIMODistributorExtension {}
