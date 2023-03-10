// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@pie-dao/diamond/contracts/facets/DiamondCutFacet.sol";
import "@pie-dao/diamond/contracts/facets/DiamondLoupeFacet.sol";
import "@pie-dao/diamond/contracts/facets/OwnershipFacet.sol";


// Get the compiler and typechain to pick up these facets
contract Imports {
    DiamondCutFacet public diamondCutFacet;
    DiamondLoupeFacet public diamondLoupeFacet;
    OwnershipFacet public ownershipFacet;
}