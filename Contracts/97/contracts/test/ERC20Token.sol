// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract ERC20Token is ERC20Upgradeable {
  function initialize(string memory _name, string memory _symbol)
    public
    initializer
  {
    __ERC20_init(_name, _symbol);
  }

  function mint(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }
}
