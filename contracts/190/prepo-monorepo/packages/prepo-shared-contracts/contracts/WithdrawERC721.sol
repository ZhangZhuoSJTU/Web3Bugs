// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import "./interfaces/IWithdrawERC721.sol";
import "./SafeOwnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract WithdrawERC721 is IWithdrawERC721, SafeOwnable, ReentrancyGuard {
  constructor() {}

  function withdrawERC721(
    address[] calldata _erc721Tokens,
    address[] calldata _recipients,
    uint256[] calldata _ids
  ) external override onlyOwner nonReentrant {
    require(_erc721Tokens.length == _ids.length, "Array length mismatch");
    uint256 _arrayLength = _erc721Tokens.length;
    for (uint256 i; i < _arrayLength; ) {
      IERC721(_erc721Tokens[i]).transferFrom(address(this), _recipients[i], _ids[i]);
      unchecked {
        ++i;
      }
    }
  }
}
