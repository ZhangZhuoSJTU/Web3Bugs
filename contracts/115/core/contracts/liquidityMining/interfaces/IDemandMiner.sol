// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDemandMiner {
  function deposit(uint256 amount) external;

  function withdraw(uint256 amount) external;

  function token() external view returns (IERC20);
}
