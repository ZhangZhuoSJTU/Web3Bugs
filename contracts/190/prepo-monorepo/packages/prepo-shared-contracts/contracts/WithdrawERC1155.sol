// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import "./interfaces/IWithdrawERC1155.sol";
import "./SafeOwnable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract WithdrawERC1155 is IWithdrawERC1155, SafeOwnable, ReentrancyGuard {
  constructor() {}

  function withdrawERC1155(
    address[] calldata _erc1155Tokens,
    address[] calldata _recipients,
    uint256[] calldata _ids,
    uint256[] calldata _amounts
  ) external override onlyOwner nonReentrant {
    require(_erc1155Tokens.length == _recipients.length && _recipients.length == _ids.length && _ids.length == _amounts.length, "Array length mismatch");
    uint256 _arrayLength = _erc1155Tokens.length;
    for (uint256 i; i < _arrayLength; ) {
      IERC1155(_erc1155Tokens[i]).safeTransferFrom(address(this), _recipients[i], _ids[i], _amounts[i], "");
      unchecked {
        ++i;
      }
    }
  }

  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes memory
  ) external pure returns (bytes4) {
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address,
    address,
    uint256[] memory,
    uint256[] memory,
    bytes memory
  ) external pure returns (bytes4) {
    return this.onERC1155BatchReceived.selector;
  }
}
