// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock6d is ERC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _amount
  ) ERC20(_name, _symbol) {
    _mint(msg.sender, _amount);
  }

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

contract ERC20Mock18d is ERC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _amount
  ) ERC20(_name, _symbol) {
    _mint(msg.sender, _amount);
  }

  function decimals() public view virtual override returns (uint8) {
    return 18;
  }
}
