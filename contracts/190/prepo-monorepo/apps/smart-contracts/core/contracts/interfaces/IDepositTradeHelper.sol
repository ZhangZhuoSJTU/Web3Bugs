// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ICollateral.sol";
import "./IPrePOMarket.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/**
 * @notice Helper contract to streamline user purchases of PrePO market
 * positions.
 */
interface IDepositTradeHelper {
  /**
   * @notice A EIP-2612 permit.
   * @param deadline After this time, the permit is invalid
   * @param v `v` component of a `secp256k1` signature
   * @param r `r` component of a `secp256k1` signature
   * @param s `s` component of a `secp256k1` signature
   */
  struct Permit {
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  /**
   * @notice Uniswap SwapRouter params that aren't determined on-chain.
   * @param tokenOut The output token of a swap, most likely a LongShortToken
   * @param deadline After this time, the swap is invalid
   * @param amountOutMinimum Swap tolerance based on amount to receive
   * @param sqrtPriceLimitX96 Swap tolerance based on maximum price
   */
  struct OffChainTradeParams {
    address tokenOut;
    uint256 deadline;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
  }

  /**
   * @dev `baseTokenAmount` will be taken from `msg.sender` to mint Collateral
   * that will be used entirely towards purchasing either Long or Short
   * positions from the corresponding UniswapV3 pool.
   *
   * Approvals to both take BaseToken from the user and the Collateral
   * subsequently minted to them, will be processed using `_baseTokenPermit`
   * and `collateralPermit`. If a user has already given these approvals,
   * these permits can remain empty and will be ignored.
   *
   * The LongShortToken to be purchased must be specified within
   * `_tradeParams`, as well as slippage requirements and swap deadline.
   * The pool to swap with will be automatically routed to using Uniswap's
   * SwapRouter contract.
   * @param _baseTokenAmount Base Token to be used towards position
   * @param _baseTokenPermit Permit to let contract take user's base token
   * @param _collateralPermit Permit to let contract take user's collateral
   * @param _tradeParams Swap parameters determined off-chain
   */
  function depositAndTrade(
    uint256 _baseTokenAmount,
    Permit calldata _baseTokenPermit,
    Permit calldata _collateralPermit,
    OffChainTradeParams calldata _tradeParams
  ) external;

  /// @return The Base Token to mint Collateral with on the user's behalf
  function getBaseToken() external view returns (IERC20);

  /// @return The Collateral to purchase positions with on the user's behalf
  function getCollateral() external view returns (ICollateral);

  /// @return The Uniswapv3 SwapRouter
  function getSwapRouter() external view returns (ISwapRouter);

  /// @return The fee tier all PrePO UniswapV3 pools will use, fixed at 1%
  function POOL_FEE_TIER() external view returns (uint24);
}
