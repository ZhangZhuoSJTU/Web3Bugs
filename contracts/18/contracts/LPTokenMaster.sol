// SPDX-License-Identifier: UNLICENSED

// Copyright (c) 2021 0xdev0 - All rights reserved
// https://twitter.com/0xdev0

pragma solidity ^0.8.0;

import './interfaces/IERC20.sol';
import './interfaces/ILendingPair.sol';
import './external/Ownable.sol';

contract LPTokenMaster is Ownable {

  event Transfer(address indexed from, address indexed to, uint value);
  event Approval(address indexed owner, address indexed spender, uint value);

  mapping (address => uint) public balanceOf;
  mapping (address => mapping (address => uint)) public allowance;

  bool private initialized;
  string public constant name     = "WILD-LP";
  string public constant symbol   = "WILD-LP";
  uint8  public constant decimals = 18;
  uint public totalSupply;

  function initialize() external {
    require(initialized != true, "LPToken: already intialized");
    owner = msg.sender;
    initialized = true;
  }

  function transfer(address _recipient, uint _amount) external returns (bool) {
    _transfer(msg.sender, _recipient, _amount);
    return true;
  }

  function approve(address _spender, uint _amount) external returns (bool) {
    _approve(msg.sender, _spender, _amount);
    return true;
  }

  function transferFrom(address _sender, address _recipient, uint _amount) external returns (bool) {
    _transfer(_sender, _recipient, _amount);
    _approve(_sender, msg.sender, allowance[_sender][msg.sender] - _amount);
    return true;
  }

  function mint(address _account, uint _amount) external onlyOwner {
    _mint(_account, _amount);
  }

  function burn(address _account, uint _amount) external onlyOwner {
    _burn(_account, _amount);
  }

  function selfBurn(uint _amount) external {
    _burn(msg.sender, _amount);
  }

  function lendingPair() external view returns(address) {
    return owner;
  }

  function underlying() public view returns(address) {
    ILendingPair pair = ILendingPair(owner);
    return address(pair.lpToken(pair.tokenA())) == address(this) ? pair.tokenA() : pair.tokenB();
  }

  function _transfer(address _sender, address _recipient, uint _amount) internal {
    require(_sender != address(0), "ERC20: transfer from the zero address");
    require(_recipient != address(0), "ERC20: transfer to the zero address");
    require(balanceOf[_sender] >= _amount, "ERC20: insufficient funds");

    ILendingPair pair = ILendingPair(owner);
    pair.accrueAccount(_sender);
    pair.accrueAccount(_recipient);

    balanceOf[_sender] -= _amount;
    balanceOf[_recipient] += _amount;

    pair.checkAccountHealth(_sender);

    require(
      pair.borrowBalance(_recipient, underlying(), underlying()) == 0,
      "LendingPair: cannot deposit borrowed token"
    );

    emit Transfer(_sender, _recipient, _amount);
  }

  function _mint(address _account, uint _amount) internal {
    require(_account != address(0), "ERC20: mint to the zero address");

    totalSupply += _amount;
    balanceOf[_account] += _amount;
    emit Transfer(address(0), _account, _amount);
  }

  function _burn(address _account, uint _amount) internal {
    require(_account != address(0), "ERC20: burn from the zero address");

    balanceOf[_account] -= _amount;
    totalSupply -= _amount;
    emit Transfer(_account, address(0), _amount);
  }

  function _approve(address _owner, address _spender, uint _amount) internal {
    require(_owner != address(0), "ERC20: approve from the zero address");
    require(_spender != address(0), "ERC20: approve to the zero address");

    allowance[_owner][_spender] = _amount;
    emit Approval(_owner, _spender, _amount);
  }
}