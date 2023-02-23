// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

interface IGovernanceHook {
  function moveVotingPowerHook(
    address from,
    address to,
    uint256 amount
  ) external;
}
