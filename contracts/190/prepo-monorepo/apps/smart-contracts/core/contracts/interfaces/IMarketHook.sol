// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice The base contract for an external hook that adds functionality to
 * a `PrePOMarket` contract.
 */
interface IMarketHook {
  /**
   * @dev This hook should only contain calls to external contracts, where
   * the actual implementation and state of a feature will reside.
   *
   * `amountBeforeFee` is the Collateral amount used to mint a market position
   *  before fees are taken.
   *
   * `amountBeforeFee` is the Collateral amount used to mint a market position
   *  after fees are taken. This amount is also equivalent to the Long and
   * Short position minted to the user.
   *
   * Only callable by allowed `PrePOMarket` contracts.
   * @param sender Caller minting/redeeming positions
   * @param amountBeforeFee Collateral amount before fees
   * @param amountAfterFee Collateral amount after fees
   */
  function hook(
    address sender,
    uint256 amountBeforeFee,
    uint256 amountAfterFee
  ) external;
}
