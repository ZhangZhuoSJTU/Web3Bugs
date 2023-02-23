// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakingRewardsWithPlatformToken {
  /**
   * @notice Stakes a given amount of the StakingToken for the sender
   * @param _amount Units of StakingToken
   */
  function stake(uint256 _amount) external;

  /**
   * @notice Stakes a given amount of the StakingToken for a given beneficiary
   * @param _beneficiary Staked tokens are credited to this address
   * @param _amount      Units of StakingToken
   */
  function stake(address _beneficiary, uint256 _amount) external;

  /**
   * @notice Withdraws stake from pool and claims any unlocked rewards.
   */
  function exit() external;

  /**
   * @notice Withdraws given stake amount from the pool
   * @param _amount Units of the staked token to withdraw
   */
  function withdraw(uint256 _amount) external;

  /**
     * @notice Redeems staked interest-bearing asset tokens for either bAsset or fAsset tokens.
     * Withdraws a given staked amount of interest-bearing assets from the vault,
     * redeems the interest-bearing asset for the underlying mAsset and either
     * 1. Redeems the underlying mAsset tokens for bAsset tokens.
     * 2. Swaps the underlying mAsset tokens for fAsset tokens in a Feeder Pool.
     * @param _amount        Units of the staked interest-bearing asset tokens to withdraw. eg imUSD or imBTC.
     * @param _minAmountOut  Minimum units of `output` tokens to be received by the beneficiary. This is to the same decimal places as the `output` token.
     * @param _output        Asset to receive in exchange for the redeemed mAssets. This can be a bAsset or a fAsset. For example:
        - bAssets (USDC, DAI, sUSD or USDT) or fAssets (GUSD, BUSD, alUSD, FEI or RAI) for mainnet imUSD Vault.
        - bAssets (USDC, DAI or USDT) or fAsset FRAX for Polygon imUSD Vault.
        - bAssets (WBTC, sBTC or renBTC) or fAssets (HBTC or TBTCV2) for mainnet imBTC Vault.
     * @param _beneficiary   Address to send `output` tokens to.
     * @param _router        mAsset address if the `output` is a bAsset. Feeder Pool address if the `output` is a fAsset.
     * @param _isBassetOut   `true` if `output` is a bAsset. `false` if `output` is a fAsset.
     * @return outputQuantity Units of `output` tokens sent to the beneficiary. This is to the same decimal places as the `output` token.
     */
  function withdrawAndUnwrap(
    uint256 _amount,
    uint256 _minAmountOut,
    address _output,
    address _beneficiary,
    address _router,
    bool _isBassetOut
  ) external returns (uint256 outputQuantity);

  /**
   * @notice Claims outstanding rewards (both platform and native) for the sender.
   * First updates outstanding reward allocation and then transfers.
   */
  function claimReward() external;

  /**
   * @notice Claims outstanding rewards for the sender. Only the native
   * rewards token, and not the platform rewards
   */
  function claimRewardOnly() external;

  /**
   * @notice Gets the last applicable timestamp for this reward period
   */
  function lastTimeRewardApplicable() external view returns (uint256);

  /**
   * @notice Calculates the amount of unclaimed rewards a user has earned
   * @return 'Reward' per staked token
   */
  function rewardPerToken() external view returns (uint256, uint256);

  /**
   * @notice Calculates the amount of unclaimed rewards a user has earned
   * @param _account User address
   * @return Total reward amount earned
   */
  function earned(address _account) external view returns (uint256, uint256);
}
