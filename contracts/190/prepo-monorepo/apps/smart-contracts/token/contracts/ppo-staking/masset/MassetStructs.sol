// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

struct BassetPersonal {
  // Address of the bAsset
  address addr;
  // Address of the bAsset
  address integrator;
  // An ERC20 can charge transfer fee, for example USDT, DGX tokens.
  bool hasTxFee; // takes a byte in storage
  // Status of the bAsset
  BassetStatus status;
}

struct BassetData {
  // 1 Basset * ratio / ratioScale == x Masset (relative value)
  // If ratio == 10e8 then 1 bAsset = 10 mAssets
  // A ratio is divised as 10^(18-tokenDecimals) * measurementMultiple(relative value of 1 base unit)
  uint128 ratio;
  // Amount of the Basset that is held in Collateral
  uint128 vaultBalance;
}

// Status of the Basset - has it broken its peg?
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

struct BasketState {
  bool undergoingRecol;
  bool failed;
}

struct FeederConfig {
  uint256 supply;
  uint256 a;
  WeightLimits limits;
}

struct InvariantConfig {
  uint256 supply;
  uint256 a;
  WeightLimits limits;
  uint256 recolFee;
}

struct BasicConfig {
  uint256 a;
  WeightLimits limits;
}

struct WeightLimits {
  uint128 min;
  uint128 max;
}

struct AmpData {
  uint64 initialA;
  uint64 targetA;
  uint64 rampStartTime;
  uint64 rampEndTime;
}

struct FeederData {
  uint256 swapFee;
  uint256 redemptionFee;
  uint256 govFee;
  uint256 pendingFees;
  uint256 cacheSize;
  BassetPersonal[] bAssetPersonal;
  BassetData[] bAssetData;
  AmpData ampData;
  WeightLimits weightLimits;
}

struct MassetData {
  uint256 swapFee;
  uint256 redemptionFee;
  uint256 cacheSize;
  uint256 surplus;
  BassetPersonal[] bAssetPersonal;
  BassetData[] bAssetData;
  BasketState basket;
  AmpData ampData;
  WeightLimits weightLimits;
}

struct AssetData {
  uint8 idx;
  uint256 amt;
  BassetPersonal personal;
}

struct Asset {
  uint8 idx;
  address addr;
  bool exists;
}
