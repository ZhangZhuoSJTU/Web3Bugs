// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockBPT is ERC20("Balancer Pool Token", "BPT") {
  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }
}
