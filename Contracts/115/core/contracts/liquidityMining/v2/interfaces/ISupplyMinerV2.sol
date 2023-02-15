// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISupplyMinerV2 {
  function baseDebtChanged(address user, uint256 newBaseDebt) external;

  function syncStake(address user) external;

  // Read only
  function collateral() external view returns (IERC20);
}
