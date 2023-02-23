// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IUintValue.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Sends tokens based on an amount of another asset. Using an external
 * price oracle, the amount to send is calculated from the incoming asset
 * amount.
 */
interface ITokenSender {
  /**
   * @notice Emitted via `setPrice()`
   * @param price The new price oracle
   */
  event PriceChange(IUintValue price);

  /**
   * @notice Emitted via `setPriceMultiplier()`
   * @param priceMultiplier The new price multiplier
   */
  event PriceMultiplierChange(uint256 priceMultiplier);

  /**
   * @notice Emitted via `setScaledPriceLowerBound()`
   * @param scaledPrice The new price multiplier
   */
  event ScaledPriceLowerBoundChange(uint256 scaledPrice);

  /**
   * @notice Sends an amount of output token determined by converting
   * `uncovertedAmount` using the price oracle and multiplier.
   * @dev If the contract's balance is insufficient to send the calculated
   * amount, the function returns early and no tokens are sent. This is to
   * ensure the platform doesn't halt if the contract needs topping up.
   *
   * Also returns early without sending tokens if the scaled price dips below
   * the scaled price lower bound.
   * @param recipient Address tokens will be sent to
   * @param unconvertedAmount The input token amount
   */
  function send(address recipient, uint256 unconvertedAmount) external;

  /**
   * @notice The price oracle to determine the input-output token conversion
   * rate.
   * @dev The price returned must be in terms of the input token (e.g. If USDC
   * is the input and PPO is the output, a price of $1/PPO must be returned as
   * 1000000). 
   * @param price The price oracle to be used for conversion
   */
  function setPrice(IUintValue price) external;

  /**
   * @notice Sets the multiplier that is applied to the price before
   * input-output conversion.
   * @dev This multiplier is a 2 decimal precision value (e.g. 10000 = 100%).
   * @param multiplier Multiplier to be applied to the conversion price
   */
  function setPriceMultiplier(uint256 multiplier) external;

  /**
   * @notice Sets the price that the post-multiplier price must exceed.
   * @dev If the scaled price is less than the lower bound, no tokens are
   * sent.
   * @param lowerBound The new lower bound for scaled prices
   */
  function setScaledPriceLowerBound(uint256 lowerBound) external;

  /// @return The token that is sent from the contract
  function getOutputToken() external view returns (IERC20);

  /// @return The price oracle used for conversion
  function getPrice() external view returns (IUintValue);

  /// @return The multiplier applied to the conversion price
  function getPriceMultiplier() external view returns (uint256);

  /// @return The lower bound for scaled prices
  function getScaledPriceLowerBound() external view returns (uint256);
}
