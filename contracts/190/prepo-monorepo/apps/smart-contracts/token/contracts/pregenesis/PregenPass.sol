// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract PregenPass is SafeOwnable, ERC721Enumerable {
  uint256 private id;
  string private uri;

  constructor(string memory _newURI) ERC721("Pregen Pass", "PREGENPASS") {
    uri = _newURI;
  }

  function setURI(string memory _newURI) external onlyOwner {
    uri = _newURI;
  }

  function mint(address _to) external {
    _safeMint(_to, id++);
  }

  function mintBatch(address[] memory _accounts) external {
    uint256 _tempId = id;
    uint256 _arrayLength = _accounts.length;
    for (uint256 i = 0; i < _arrayLength; ++i) {
      _safeMint(_accounts[i], _tempId++);
    }
    id = _tempId;
  }

  function burn(uint256 _tokenId) external {
    _burn(_tokenId);
  }

  function burnBatch(uint256[] memory _tokenIds) external {
    uint256 _arrayLength = _tokenIds.length;
    for (uint256 i = 0; i < _arrayLength; ++i) {
      _burn(_tokenIds[i]);
    }
  }

  function tokenURI(uint256) public view override returns (string memory) {
    return uri;
  }

  function _beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _tokenId
  ) internal override(ERC721Enumerable) onlyOwner {
    super._beforeTokenTransfer(_from, _to, _tokenId);
  }
}
