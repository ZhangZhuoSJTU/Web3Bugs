// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

interface IVotingMinerV2 {
  function syncStake(address user) external;
}
