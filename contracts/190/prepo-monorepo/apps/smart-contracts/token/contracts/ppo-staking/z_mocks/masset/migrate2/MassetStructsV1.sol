// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @notice  Is the Masset V2.0 structs used in the upgrade of mUSD from V2.0 to V3.0.
 * @author  mStable
 * @dev     VERSION: 2.0
 *          DATE:    2021-02-23
 */

/** @dev Stores high level basket info */
struct Basket {
  Basset[] bassets;
  uint8 maxBassets;
  bool undergoingRecol;
  bool failed;
  uint256 collateralisationRatio;
}

/** @dev Stores bAsset info. The struct takes 5 storage slots per Basset */
struct Basset {
  address addr;
  BassetStatus status;
  bool isTransferFeeCharged;
  uint256 ratio;
  uint256 maxWeight;
  uint256 vaultBalance;
}

/** @dev Status of the Basset - has it broken its peg? */
enum BassetStatus {
  Default,
  Normal,
  BrokenBelowPeg,
  BrokenAbovePeg,
  Blacklisted,
  Liquidating,
  Liquidated,
  Failed
}

/** @dev Internal details on Basset */
struct BassetDetails {
  Basset bAsset;
  address integrator;
  uint8 index;
}
