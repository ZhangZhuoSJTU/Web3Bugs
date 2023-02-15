// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IClaimers is IERC721 {
    //
    // Events
    //

    event YieldClaimed(
        uint256 claimerId,
        address indexed to,
        uint256 amount,
        uint256 burnedShares
    );
}
