// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// This contract is only for testing
contract TestERC721 is ERC721("TEST", "TEST") {

    function mint(address to, uint256 index) external {
        _mint(to, index);
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        if (!_exists(tokenId))
            return address(0);

        return super.ownerOf(tokenId);
    }
}
