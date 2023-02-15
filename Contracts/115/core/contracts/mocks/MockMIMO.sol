// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockMIMO is ERC20("MIMO Token", "MIMO") {
  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }
}
