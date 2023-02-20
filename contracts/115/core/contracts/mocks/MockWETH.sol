// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWETH is ERC20("Wrapped Ether", "WETH") {
  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }

  function deposit() public payable {
    _mint(msg.sender, msg.value);
  }

  function withdraw(uint256 wad) public {
    _burn(msg.sender, wad);
    msg.sender.transfer(wad);
  }
}
