// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWBTC is ERC20("Wrapped Bitcoin", "WBTC") {
  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }
}
