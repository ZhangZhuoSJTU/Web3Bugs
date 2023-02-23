// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import "../masset/MassetStructs.sol";

abstract contract IInvariantValidator {
  // Mint
  function computeMint(
    BassetData[] calldata _bAssets,
    uint8 _i,
    uint256 _rawInput,
    InvariantConfig memory _config
  ) external view virtual returns (uint256);

  function computeMintMulti(
    BassetData[] calldata _bAssets,
    uint8[] calldata _indices,
    uint256[] calldata _rawInputs,
    InvariantConfig memory _config
  ) external view virtual returns (uint256);

  // Swap
  function computeSwap(
    BassetData[] calldata _bAssets,
    uint8 _i,
    uint8 _o,
    uint256 _rawInput,
    uint256 _feeRate,
    InvariantConfig memory _config
  ) external view virtual returns (uint256, uint256);

  // Redeem
  function computeRedeem(
    BassetData[] calldata _bAssets,
    uint8 _i,
    uint256 _mAssetQuantity,
    InvariantConfig memory _config
  ) external view virtual returns (uint256);

  function computeRedeemExact(
    BassetData[] calldata _bAssets,
    uint8[] calldata _indices,
    uint256[] calldata _rawOutputs,
    InvariantConfig memory _config
  ) external view virtual returns (uint256);

  function computePrice(
    BassetData[] memory _bAssets,
    InvariantConfig memory _config
  ) public pure virtual returns (uint256 price, uint256 k);
}
