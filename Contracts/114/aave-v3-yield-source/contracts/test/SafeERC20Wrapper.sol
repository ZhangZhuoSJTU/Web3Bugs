// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Mock implementation from OpenZeppelin modified for our usage in tests
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/mocks/SafeERC20Helper.sol
contract ERC20ReturnTrueMock is ERC20 {
  mapping(address => uint256) private _allowances;

  // IERC20's functions are not pure, but these mock implementations are: to prevent Solidity from issuing warnings,
  // we write to a dummy state variable.
  uint256 private _dummy;

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

  function transfer(address, uint256) public override returns (bool) {
    _dummy = 0;
    return true;
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public override returns (bool) {
    _dummy = 0;
    return true;
  }

  function approve(address, uint256) public override returns (bool) {
    _dummy = 0;
    return true;
  }

  function setAllowance(uint256 allowance_) public {
    _allowances[_msgSender()] = allowance_;
  }

  function allowance(address owner, address) public view override returns (uint256) {
    return _allowances[owner];
  }

  uint256[48] private __gap;
}

contract SafeERC20Wrapper {
  using SafeERC20 for IERC20;

  IERC20 private _token;

  constructor(IERC20 token) {
    _token = token;
  }

  function balanceOf(address account) public view returns (uint256) {
    return _token.balanceOf(account);
  }

  function transfer(address recipient, uint256 amount) public {
    _token.safeTransfer(recipient, amount);
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public {
    _token.safeTransferFrom(sender, recipient, amount);
  }

  function approve(address spender, uint256 amount) public {
    _token.safeApprove(spender, amount);
  }

  function increaseAllowance(uint256 amount) public {
    _token.safeIncreaseAllowance(address(0), amount);
  }

  function decreaseAllowance(uint256 amount) public {
    _token.safeDecreaseAllowance(address(0), amount);
  }

  function setAllowance(uint256 allowance_) public {
    ERC20ReturnTrueMock(address(_token)).setAllowance(allowance_);
  }

  function allowance(address owner, address spender) public view returns (uint256) {
    return _token.allowance(owner, spender);
  }

  uint256[49] private __gap;
}
