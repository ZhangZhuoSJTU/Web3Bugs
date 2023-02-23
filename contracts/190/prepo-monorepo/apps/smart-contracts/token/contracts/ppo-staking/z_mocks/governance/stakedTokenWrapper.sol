// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StakedToken} from "../../governance/staking/StakedToken.sol";

/**
 * Used to test contract interactions with the StakedToken
 */
contract StakedTokenWrapper {
  using SafeERC20 for IERC20;

  IERC20 public rewardsToken;
  StakedToken public stakedToken;

  constructor(address _rewardsToken, address _stakedToken) {
    stakedToken = StakedToken(_stakedToken);
    rewardsToken = IERC20(_rewardsToken);
    rewardsToken.safeApprove(_stakedToken, 2**256 - 1);
  }

  function stake(uint256 _amount) external {
    stakedToken.stake(_amount);
  }

  function stake(uint256 _amount, address _delegatee) external {
    stakedToken.stake(_amount, _delegatee);
  }

  function withdraw(
    uint256 _amount,
    address _recipient,
    bool _amountIncludesFee,
    bool _exitCooldown
  ) external {
    stakedToken.withdraw(
      _amount,
      _recipient,
      _amountIncludesFee,
      _exitCooldown
    );
  }
}
