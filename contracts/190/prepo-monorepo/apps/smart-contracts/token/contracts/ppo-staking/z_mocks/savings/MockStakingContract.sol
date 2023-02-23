// SPDX-License-Identifier: AGPL-3.0-or-later

import {IGovernanceHook} from "../../governance/staking/interfaces/IGovernanceHook.sol";

pragma solidity =0.8.7;

contract MockStakingContract {
  mapping(address => uint256) private _balances;
  mapping(address => uint256) private _votes;
  uint256 public totalSupply;

  IGovernanceHook govHook;

  function setBalanceOf(address account, uint256 balance) public {
    _balances[account] = balance;
  }

  function setTotalSupply(uint256 _totalSupply) public {
    totalSupply = _totalSupply;
  }

  function setVotes(address account, uint256 newVotes) public {
    uint256 oldVotes = _votes[account];
    _votes[account] = newVotes;

    if (address(govHook) != address(0)) {
      if (oldVotes <= newVotes) {
        govHook.moveVotingPowerHook(address(0), account, newVotes - oldVotes);
      } else if (oldVotes > newVotes) {
        govHook.moveVotingPowerHook(account, address(0), oldVotes - newVotes);
      }
    }
  }

  function transferVotes(
    address from,
    address to,
    uint256 votes
  ) public {
    _votes[from] -= votes;
    _votes[to] += votes;

    if (address(govHook) != address(0)) {
      govHook.moveVotingPowerHook(from, to, votes);
    }
  }

  function setGovernanceHook(address _govHook) public {
    govHook = IGovernanceHook(_govHook);
  }

  function balanceOf(address account) public view returns (uint256) {
    return _balances[account];
  }

  function getVotes(address account) external view returns (uint256) {
    return _votes[account];
  }
}
