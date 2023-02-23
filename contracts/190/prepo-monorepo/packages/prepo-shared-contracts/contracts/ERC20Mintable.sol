// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./SafeOwnable.sol";

//TODO: add tests and interface for this
contract ERC20Mintable is ERC20, SafeOwnable {
  constructor(string memory _newName, string memory _newSymbol) ERC20(_newName, _newSymbol) {}

  function mint(address _recipient, uint256 _amount) external onlyOwner {
    _mint(_recipient, _amount);
  }
}
