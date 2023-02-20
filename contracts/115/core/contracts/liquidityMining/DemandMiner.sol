// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./GenericMiner.sol";
import "./interfaces/IMIMO.sol";
import "./interfaces/IDemandMiner.sol";

contract DemandMiner is IDemandMiner, GenericMiner {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public override token;

  constructor(IGovernanceAddressProvider _addresses, IERC20 _token) public GenericMiner(_addresses) {
    require(address(_token) != address(0));
    require(address(_token) != address(_addresses.mimo()));
    token = _token;
  }

  /**
    Deposit an ERC20 pool token for staking
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param amount the amount of tokens to be deposited. Unit is in WEI.
  **/
  function deposit(uint256 amount) public override {
    token.safeTransferFrom(msg.sender, address(this), amount);
    _increaseStake(msg.sender, amount);
  }

  /**
    Withdraw staked ERC20 pool tokens. Will fail if user does not have enough tokens staked.
    @param amount the amount of tokens to be withdrawn. Unit is in WEI.
  **/
  function withdraw(uint256 amount) public override {
    token.safeTransfer(msg.sender, amount);
    _decreaseStake(msg.sender, amount);
  }
}
