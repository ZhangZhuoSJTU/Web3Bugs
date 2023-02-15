// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @dev Extension of {ERC721} for Minting/Burning
 */
contract ERC721Mintable is ERC721 {
    constructor() ERC721("ERC 721", "NFT") {}

    /**
     * @dev See {ERC721-_mint}.
     */
    function mint(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }

    /**
     * @dev See {ERC721-_burn}.
     */
    function burn(uint256 tokenId) public {
        _burn(tokenId);
    }
}
