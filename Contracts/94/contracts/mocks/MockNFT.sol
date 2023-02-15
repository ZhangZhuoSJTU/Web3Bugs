// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is Ownable, ERC721 {
  uint256 private nextTokenId;

  constructor()
    ERC721("MockNFT", "mNFT") // solhint-disable-next-line no-empty-blocks
  {}

  function mint() external onlyOwner {
    _mint(msg.sender, ++nextTokenId);
  }
}
