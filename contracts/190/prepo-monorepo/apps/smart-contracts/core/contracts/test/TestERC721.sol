// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721 is ERC721 {
  uint256 tokenId;

  constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

  function mint(address _recipient) external {
    _mint(_recipient, tokenId);
    tokenId++;
  }
}
