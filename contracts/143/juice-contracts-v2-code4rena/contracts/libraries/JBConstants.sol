// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

/**
  @notice
  Global constants used across Juicebox contracts.
*/
library JBConstants {
  uint256 public constant MAX_RESERVED_RATE = 10000;
  uint256 public constant MAX_REDEMPTION_RATE = 10000;
  uint256 public constant MAX_DISCOUNT_RATE = 1000000000;
  uint256 public constant SPLITS_TOTAL_PERCENT = 1000000000;
  uint256 public constant MAX_FEE = 1000000000;
  uint256 public constant MAX_FEE_DISCOUNT = 1000000000;
}
