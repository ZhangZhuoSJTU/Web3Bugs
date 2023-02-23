// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

interface IPPOStaking {
  function stake(address recipient, uint256 amount) external;
}
