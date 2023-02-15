// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'diamond-2/contracts/facets/DiamondCutFacet.sol';
import 'diamond-2/contracts/facets/DiamondLoupeFacet.sol';
import 'diamond-2/contracts/facets/OwnershipFacet.sol';
import 'diamond-2/contracts/Diamond.sol';

// Get the compiler to pick up these facets
contract Imports {
  DiamondCutFacet public diamondCutFacet;
  DiamondLoupeFacet public diamondLoupeFacet;
  OwnershipFacet public ownershipFacet;
  Diamond public diamond;
}
