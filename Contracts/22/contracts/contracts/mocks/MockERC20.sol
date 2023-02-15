// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

contract MockERC20 {
  address public steward;

  mapping(address => uint256) public _balances;
  mapping(address => mapping(address => uint256)) public _allowance;
  string name;
  string symbol;
  uint8 decimals;
  address minter;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _minter
  ) {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    minter = _minter;
  }

  function mint(address user, uint256 amount) public returns (bool) {
    _balances[user] = _balances[user] + amount;
    return true;
  }

  function burnFrom(address user, uint256 amount) public {
    _balances[user] = _balances[user] - amount;
  }

  function approve(address user, uint256 amount) external returns (bool) {
    _allowance[msg.sender][user] = amount;
    return true;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    _balances[msg.sender] = _balances[msg.sender] - amount;
    _balances[to] = _balances[to] + amount;
    return true;
  }

  function allowance(address owner, address spender) external view returns (uint256) {
    return _allowance[owner][spender];
  }

  function transferFrom(
    address sender,
    address to,
    uint256 amount
  ) external returns (bool) {
    _balances[sender] = _balances[sender] - amount;
    _balances[to] = _balances[to] + amount;
    _allowance[sender][to] = _allowance[sender][to] - amount;
    return true;
  }

  function balanceOf(address user) external view returns (uint256) {
    return _balances[user];
  }
}
