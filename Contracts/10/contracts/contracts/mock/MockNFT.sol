// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is ERC721 {
    constructor(address recipient) ERC721("MockNFT", "MockNFT") {
        ERC721._mint(recipient, uint256(address(this)));
    }
}
