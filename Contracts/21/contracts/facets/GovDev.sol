// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.0;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'diamond-2/contracts/libraries/LibDiamond.sol';

import '../interfaces/IGovDev.sol';

contract GovDev is IGovDev {
  function getGovDev() external view override returns (address) {
    return LibDiamond.contractOwner();
  }

  function transferGovDev(address _govDev) external override {
    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');
    require(_govDev != LibDiamond.contractOwner(), 'SAME_DEV');
    LibDiamond.setContractOwner(_govDev);
  }

  function updateSolution(
    IDiamondCut.FacetCut[] memory _diamondCut,
    address _init,
    bytes memory _calldata
  ) external override {
    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');
    return LibDiamond.diamondCut(_diamondCut, _init, _calldata);
  }
}
