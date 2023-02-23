// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.7;

import "./ILongShortToken.sol";
import "./IMarketHook.sol";

/**
 * @notice Users can mint/redeem long/short positions on a specific asset in
 * exchange for Collateral tokens.
 * @dev Position settlement payouts are bound by a floor and ceiling set
 * during market initialization.
 *
 * The value of a Long and Short token should always equal 1 Collateral.
 */
interface IPrePOMarket {
  /**
   * @dev Emitted via `constructor()`
   * @param longToken Market Long token address
   * @param shortToken Market Short token address
   * @param shortToken Market Short token address
   * @param floorLongPayout Long token payout floor
   * @param ceilingLongPayout Long token payout ceiling
   * @param floorValuation Market valuation floor
   * @param ceilingValuation Market valuation ceiling
   * @param expiryTime Market expiry time
   */
  event MarketCreated(address longToken, address shortToken, uint256 floorLongPayout, uint256 ceilingLongPayout, uint256 floorValuation, uint256 ceilingValuation, uint256 expiryTime);

  /**
   * @dev Emitted via `mint()`.
   * @param minter The address of the minter
   * @param amount The amount of Long/Short tokens minted
   */
  event Mint(address indexed minter, uint256 amount);

  /**
   * @dev Emitted via `redeem()`.
   * @param redeemer The address of the redeemer
   * @param amountAfterFee The amount of Long/Short tokens minted
   * @param fee The fee in Collateral that was taken
   */
  event Redemption(address indexed redeemer, uint256 amountAfterFee, uint256 fee);

  /**
   * @dev Emitted via `setMintHook()`
   * @param hook Address of the new hook for `mint()`
   */
  event MintHookChange(address hook);

  /**
   * @dev Emitted via `setRedeemHook()`
   * @param hook Address of the new hook for `redeem()` 
   */
  event RedeemHookChange(address hook);

  /**
   * @dev Emitted via `setFinalLongPayout()`.
   * @param payout The final Long payout
   */
  event FinalLongPayoutSet(uint256 payout);

  /**
   * @dev Emitted via `setRedemptionFee()`.
   * @param fee The new redemption fee
   */
  event RedemptionFeeChange(uint256 fee);

  /**
   * @notice Mints Long and Short tokens in exchange for `amount`
   * Collateral.
   * @dev Minting is not allowed after the market has ended.
   * 
   * Minting will only be done by the team, and thus relies on the `_mintHook`
   * to enforce access controls. This is also why there is no fee for `mint()`
   * as opposed to `redeem()`.
   * @param amount Amount of Collateral to deposit
   * @return Long/Short tokens minted
   */
  function mint(uint256 amount) external returns (uint256);

  /**
   * @notice Redeem `longAmount` Long and `shortAmount` Short tokens for
   * Collateral.
   * @dev Before the market ends, redemptions can only be done with equal
   * parts N Long/Short tokens for N Collateral.
   *
   * After the market has ended, users can redeem any amount of
   * Long/Short tokens for Collateral.
   *
   * A fee will be taken based on the `redemptionFee` factor.
   * @param longAmount Amount of Long tokens to redeem
   * @param shortAmount Amount of Short tokens to redeem
   */
  function redeem(uint256 longAmount, uint256 shortAmount) external;

  /**
   * @notice Sets hook to be called within `mint()`
   * @dev Only callable by `owner`
   * @param mintHook Address of the new mint hook
   */
  function setMintHook(IMarketHook mintHook) external;

  /**
   * @notice Sets hook to be called within `redeem()`
   * @dev Only callable by `owner`
   * @param redeemHook Address of the new redeem hook
   */
  function setRedeemHook(IMarketHook redeemHook) external;

  /**
   * @notice Sets the payout a Long token can be redeemed for after the
   * market has ended (in wei units of Collateral).
   * @dev The contract initializes this to > MAX_PAYOUT and knows the market
   * has ended when it is set to <= MAX_PAYOUT.
   *
   * Only callable by `owner()`.
   * @param finalLongPayout Payout to set Long token redemptions
   */
  function setFinalLongPayout(uint256 finalLongPayout) external;

  /**
   * @notice Sets the fee for redeeming Long/Short tokens, must be a 4
   * decimal place percentage value e.g. 4.9999% = 49999.
   * @dev Only callable by `owner()`.
   * @param redemptionFee New redemption fee
   */
  function setRedemptionFee(uint256 redemptionFee) external;

  /// @return The hook that is called in `mint()`
  function getMintHook() external view returns (IMarketHook);

  /// @return The hook that is called in `redeem()`
  function getRedeemHook() external view returns (IMarketHook);

  /// @return Collateral token used to fund Long/Short positions
  function getCollateral() external view returns (IERC20);

  /**
   * @dev The PrePOMarket is the owner of this token contract.
   * @return Long token for this market
   */
  function getLongToken() external view returns (ILongShortToken);

  /**
   * @dev The PrePOMarket is the owner of this token contract.
   * @return Short token for this market
   */
  function getShortToken() external view returns (ILongShortToken);

  /**
   * @notice Returns the lower bound of what a Long token can be paid out at
   * (in wei units of Collateral).
   * @dev Must be less than ceilingLongPayout and MAX_PAYOUT.
   * @return Minimum Long token payout
   */
  function getFloorLongPayout() external view returns (uint256);

  /**
   * @notice Returns the upper bound of what a Long token can be paid out at
   * (in wei units of Collateral).
   * @dev Must be less than MAX_PAYOUT.
   * @return Maximum Long token payout
   */
  function getCeilingLongPayout() external view returns (uint256);

  /**
   * @notice Returns the payout a Long token can be redeemed for after the
   * market has ended (in wei units of Collateral).
   * @dev The contract initializes this to > MAX_PAYOUT and knows the market
   * has ended when it is set to <= MAX_PAYOUT.
   * @return Final Long token payout
   */
  function getFinalLongPayout() external view returns (uint256);

  /**
   * @notice Returns valuation of a market when the payout of a Long
   * token is at the floor.
   * @return Market valuation floor
   */
  function getFloorValuation() external view returns (uint256);

  /**
   * @notice Returns valuation of a market when the payout of a Long
   * token is at the ceiling.
   * @return Market valuation ceiling
   */
  function getCeilingValuation() external view returns (uint256);

  /**
   * @notice Returns the fee for redeeming Long/Short tokens as a 4 decimal
   * place percentage value e.g. 4.9999% = 49999.
   * @return Redemption fee
   */
  function getRedemptionFee() external view returns (uint256);

  /**
   * @notice Returns the timestamp of when the market will expire.
   * @dev This is not an enforced timestamp, market expiry only occurs once
   * the `finalLongPayout` is set.
   * @return Market expiry timestamp
   */
  function getExpiryTime() external view returns (uint256);

  /**
   * @notice Long payouts cannot exceed this value, equivalent to 1 ether
   * unit of Collateral.
   * @return Max Long token payout
   */
  function getMaxPayout() external pure returns (uint256);

  /**
   * @notice Returns the denominator for calculating fees from 4 decimal
   * place percentage values e.g. 4.9999% = 49999.
   * @return Denominator for calculating fees
   */
  function getFeeDenominator() external pure returns (uint256);

  /**
   * @notice Fee limit of 5% represented as 4 decimal place percentage
   * value e.g. 4.9999% = 49999.
   * @return Fee limit
   */
  function getFeeLimit() external pure returns (uint256);
}
