// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.1;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz

* Inspired by: https://github.com/pie-dao/PieVaults/blob/master/contracts/facets/ERC20/ERC20Facet.sol
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'diamond-2/contracts/libraries/LibDiamond.sol';

import '../interfaces/ISherXERC20.sol';

import '../libraries/LibSherXERC20.sol';

contract SherXERC20 is IERC20, ISherXERC20 {
  using SafeMath for uint256;

  //
  // View methods
  //

  function name() external view override returns (string memory) {
    return SherXERC20Storage.sx20().name;
  }

  function symbol() external view override returns (string memory) {
    return SherXERC20Storage.sx20().symbol;
  }

  function decimals() external pure override returns (uint8) {
    return 18;
  }

  function allowance(address _owner, address _spender) external view override returns (uint256) {
    return SherXERC20Storage.sx20().allowances[_owner][_spender];
  }

  function balanceOf(address _of) external view override returns (uint256) {
    return SherXERC20Storage.sx20().balances[_of];
  }

  function totalSupply() external view override returns (uint256) {
    return SherXERC20Storage.sx20().totalSupply;
  }

  //
  // State changing methods
  //

  function initializeSherXERC20(string memory _name, string memory _symbol) external override {
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');

    require(bytes(_name).length != 0, 'NAME');
    require(bytes(_symbol).length != 0, 'SYMBOL');

    sx20.name = _name;
    sx20.symbol = _symbol;
  }

  function increaseApproval(address _spender, uint256 _amount) external override returns (bool) {
    require(_spender != address(0), 'SPENDER');
    require(_amount != 0, 'AMOUNT');
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
    sx20.allowances[msg.sender][_spender] = sx20.allowances[msg.sender][_spender].add(_amount);
    emit Approval(msg.sender, _spender, sx20.allowances[msg.sender][_spender]);
    return true;
  }

  function decreaseApproval(address _spender, uint256 _amount) external override returns (bool) {
    require(_spender != address(0), 'SPENDER');
    require(_amount != 0, 'AMOUNT');
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
    uint256 oldValue = sx20.allowances[msg.sender][_spender];
    if (_amount > oldValue) {
      sx20.allowances[msg.sender][_spender] = 0;
    } else {
      sx20.allowances[msg.sender][_spender] = oldValue.sub(_amount);
    }
    emit Approval(msg.sender, _spender, sx20.allowances[msg.sender][_spender]);
    return true;
  }

  function approve(address _spender, uint256 _amount) external override returns (bool) {
    require(_spender != address(0), 'SPENDER');
    emit Approval(msg.sender, _spender, _amount);
    return LibSherXERC20.approve(msg.sender, _spender, _amount);
  }

  function transfer(address _to, uint256 _amount) external override returns (bool) {
    _transfer(msg.sender, _to, _amount);
    return true;
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _amount
  ) external override returns (bool) {
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
    require(_from != address(0), 'FROM');

    // Update approval if not set to max uint256
    if (sx20.allowances[_from][msg.sender] != uint256(-1)) {
      uint256 newApproval = sx20.allowances[_from][msg.sender].sub(_amount);
      sx20.allowances[_from][msg.sender] = newApproval;
      emit Approval(_from, msg.sender, newApproval);
    }

    _transfer(_from, _to, _amount);
    return true;
  }

  function _transfer(
    address _from,
    address _to,
    uint256 _amount
  ) internal {
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    sx20.balances[_from] = sx20.balances[_from].sub(_amount);
    sx20.balances[_to] = sx20.balances[_to].add(_amount);

    emit Transfer(_from, _to, _amount);
  }
}
