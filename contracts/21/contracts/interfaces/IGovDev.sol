// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'diamond-2/contracts/libraries/LibDiamond.sol';

/// @title Sherlock Dev Controller
/// @author Evert Kors
/// @notice This contract is used during development for upgrading logic
/// @dev Contract is meant to be included as a facet in the diamond
interface IGovDev {
  /// @notice Returns the dev controller address
  /// @return Dev address
  function getGovDev() external view returns (address);

  /// @notice Transfer dev role to other account or renounce
  /// @param _govDev New dev address
  function transferGovDev(address _govDev) external;

  /// @notice Delete, update or add functions
  /// @param _diamondCut Struct containing data of function mutation
  /// @param _init Address to call after pushing changes
  /// @param _calldata Data to call address with
  function updateSolution(
    IDiamondCut.FacetCut[] memory _diamondCut,
    address _init,
    bytes memory _calldata
  ) external;
}
