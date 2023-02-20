// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

/// @notice Manages yield accumulation for the LongShort contract. Each market is deployed with its own yield manager to simplify the bookkeeping, as different markets may share a payment token and yield pool.
abstract contract IYieldManager {
  event YieldDistributed(uint256 unrealizedYield, uint256 treasuryYieldPercent_e18);

  /// @dev This is purely saving some gas, but the subgraph will know how much is due for the treasury at all times - no need to include in event.
  event WithdrawTreasuryFunds();

  /// @notice distributed yield not yet transferred to the treasury
  function totalReservedForTreasury() external virtual returns (uint256);

  /// @notice Deposits the given amount of payment tokens into this yield manager.
  /// @param amount Amount of payment token to deposit
  function depositPaymentToken(uint256 amount) external virtual;

  /// @notice Allows the LongShort pay out a user from tokens already withdrawn from Aave
  /// @param user User to recieve the payout
  /// @param amount Amount of payment token to pay to user
  function transferPaymentTokensToUser(address user, uint256 amount) external virtual;

  /// @notice Withdraws the given amount of tokens from this yield manager.
  /// @param amount Amount of payment token to withdraw
  function removePaymentTokenFromMarket(uint256 amount) external virtual;

  /**    
    @notice Calculates and updates the yield allocation to the treasury and the market
    @dev treasuryPercent = 1 - marketPercent
    @param totalValueRealizedForMarket total value of long and short side of the market
    @param treasuryYieldPercent_e18 Percentage of yield in base 1e18 that is allocated to the treasury
    @return amountForMarketIncentives The market allocation of the yield
  */
  function distributeYieldForTreasuryAndReturnMarketAllocation(
    uint256 totalValueRealizedForMarket,
    uint256 treasuryYieldPercent_e18
  ) external virtual returns (uint256 amountForMarketIncentives);

  /// @notice Withdraw treasury allocated accrued yield from the lending pool to the treasury contract
  function withdrawTreasuryFunds() external virtual;
}
