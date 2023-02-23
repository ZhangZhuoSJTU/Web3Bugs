// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../PregenPass.sol";

contract MockPregenPass is PregenPass {
  constructor(string memory _newURI) PregenPass(_newURI) {}

  function beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _tokenId
  ) external {
    _beforeTokenTransfer(_from, _to, _tokenId);
  }
}
