// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pie-dao/diamond/contracts/interfaces/IERC173.sol";
import "@pie-dao/diamond/contracts/interfaces/IDiamondLoupe.sol";
import "@pie-dao/diamond/contracts/interfaces/IDiamondCut.sol";
import "./IBasketFacet.sol";
import "./IERC20Facet.sol";
import "./ICallFacet.sol";

/**
    @title ExperiPie Interface
    @dev Combines all ExperiPie facet interfaces into one
*/
interface IExperiPie is
    IERC20,
    IBasketFacet,
    IERC20Facet,
    IERC173,
    ICallFacet,
    IDiamondLoupe,
    IDiamondCut
{

}
