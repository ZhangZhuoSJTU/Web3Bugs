// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

interface IRevenueRecipient {
  /** @dev Recipient */
  function notifyRedistributionAmount(address _mAsset, uint256 _amount)
    external;

  function depositToPool(
    address[] calldata _mAssets,
    uint256[] calldata _percentages
  ) external;
}
