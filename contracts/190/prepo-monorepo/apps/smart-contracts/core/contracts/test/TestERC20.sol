// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC20 is ERC20Permit, Ownable {
  uint8 _decimals;

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 _newDecimals
  ) ERC20(name_, symbol_) ERC20Permit(name_) {
    _decimals = _newDecimals;
  }

  function mint(address _recipient, uint256 _amount) external onlyOwner {
    _mint(_recipient, _amount);
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }
}
