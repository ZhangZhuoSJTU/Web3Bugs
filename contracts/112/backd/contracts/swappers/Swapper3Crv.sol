// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/vendor/ICurveSwap.sol";
import "../../interfaces/vendor/UniswapRouter02.sol";
import "../../interfaces/ISwapper.sol";
import "../../libraries/Errors.sol";
import "../../libraries/ScaledMath.sol";

contract Swapper3Crv is ISwapper {
    using ScaledMath for uint256;
    using SafeERC20 for IERC20;

    // Dex contracts
    address public constant UNISWAP = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address public constant SUSHISWAP = address(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    // Dex factories
    address public constant UNISWAP_FACTORY = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    address public constant SUSHISWAP_FACTORY = address(0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac);

    // ERC20 tokens
    address public constant DAI = address(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    address public constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address public constant USDT = address(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    address public constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public constant TRI_CRV = address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);

    // Curve pool
    address public constant CURVE_POOL = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);

    mapping(address => int128) public triPoolIndex; // dev: 3Pool is immutable so these won't change
    mapping(address => mapping(address => address)) public lpTokens;

    constructor() {
        triPoolIndex[DAI] = int128(0);
        triPoolIndex[USDC] = int128(1);
        triPoolIndex[USDT] = int128(2);

        IERC20(DAI).safeApprove(SUSHISWAP, type(uint256).max);
        IERC20(USDC).safeApprove(SUSHISWAP, type(uint256).max);
        IERC20(USDT).safeApprove(SUSHISWAP, type(uint256).max);

        IERC20(DAI).safeApprove(UNISWAP, type(uint256).max);
        IERC20(USDC).safeApprove(UNISWAP, type(uint256).max);
        IERC20(USDT).safeApprove(UNISWAP, type(uint256).max);
    }

    function swap(
        address fromToken,
        address toToken,
        uint256 swapAmount,
        uint256 minAmount
    ) external override returns (uint256) {
        require(
            fromToken == TRI_CRV && ((toToken == DAI) || (toToken == USDC) || (toToken == USDT)),
            "Token pair not swappable"
        );
        IERC20(fromToken).transferFrom(msg.sender, address(this), swapAmount);
        (address dex, address token) = _getBestTokenToWithdraw(swapAmount, toToken);
        ICurveSwap(CURVE_POOL).remove_liquidity_one_coin(swapAmount, triPoolIndex[token], 0);
        uint256 amountReceived = _swapAll(token, toToken, dex);

        require(amountReceived >= minAmount, Error.INSUFFICIENT_FUNDS_RECEIVED);
        return amountReceived;
    }

    /**
     * @notice Calculate the exchange rate for the token pair.
     */
    function getRate(address fromToken, address toToken) external view override returns (uint256) {
        require(
            fromToken == TRI_CRV && ((toToken == DAI) || (toToken == USDC) || (toToken == USDT)),
            "Token pair not swappable"
        );
        if (toToken == DAI) return ICurveSwap(CURVE_POOL).get_virtual_price();
        return ICurveSwap(CURVE_POOL).get_virtual_price() / 1e12;
    }

    /**
     * @dev Swaps the contracts full balance of tokenIn for tokenOut.
     * @param tokenIn Token to swap for tokenOut.
     * @param tokenOut Target token to receive in swap.
     * @return The amount of tokenOut received.
     */
    function _swapAll(
        address tokenIn,
        address tokenOut,
        address dex
    ) internal returns (uint256) {
        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));
        if (tokenIn == tokenOut) {
            IERC20(tokenOut).safeTransfer(msg.sender, amountIn);
            return amountIn;
        }
        if (amountIn == 0) return 0;
        address[] memory path = new address[](3);
        path[0] = tokenIn;
        path[1] = WETH;
        path[2] = tokenOut;
        return
            UniswapRouter02(dex).swapExactTokensForTokens(
                amountIn,
                0,
                path,
                msg.sender,
                block.timestamp
            )[2];
    }

    /**
     * @dev Gets the best token to withdraw from Curve Pool for swapping.
     * @param amount Amount of 3CRV to withdraw and swap.
     * @param tokenOut Target token to receive in swap.
     * @return The best token to withdraw from Curve Pool for swapping.
     */
    function _getBestTokenToWithdraw(uint256 amount, address tokenOut)
        internal
        view
        returns (address, address)
    {
        (address daiDex, uint256 daiOutput) = _getAmountOut(amount, DAI, tokenOut);
        (address usdcDex, uint256 usdcOutput) = _getAmountOut(amount, USDC, tokenOut);
        (address usdtDex, uint256 usdtOutput) = _getAmountOut(amount, USDT, tokenOut);
        if (daiOutput > usdcOutput && daiOutput > usdtOutput) {
            return (daiDex, DAI);
        } else if (usdcOutput > usdtOutput) {
            return (usdcDex, USDC);
        } else {
            return (usdtDex, USDT);
        }
    }

    /**
     * @dev Gets the amount of tokenOut received if swapping 3CRV via tokenIn.
     * @param amountIn The amount of 3CRV to withdraw and swap.
     * @param tokenIn Token to withdraw liquidity in from Curve Pool and to swap with tokenOut.
     * @param tokenOut Target token out.
     * @return The amount of tokenOut received.
     */
    function _getAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) internal view returns (address, uint256) {
        uint256 coinReceived = ICurveSwap(CURVE_POOL).calc_withdraw_one_coin(
            amountIn,
            triPoolIndex[tokenIn]
        );
        if (tokenIn == tokenOut) return (address(0), coinReceived);
        (address dex, uint256 amountOut) = _getBestDex(tokenIn, tokenOut, coinReceived);
        return (dex, amountOut);
    }

    /**
     * @dev Gets the best DEX to use for swapping token.
     *      Compares the amount out for Uniswap and Sushiswap.
     * @param fromToken Token to swap from.
     * @param toToken Token to swap to.
     * @param amount Amount of fromToken to swap.
     * @return bestDex The address of the best DEX to use.
     * @return amountOut The amount of toToken received from swapping.
     */
    function _getBestDex(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal view returns (address bestDex, uint256 amountOut) {
        address uniswap_ = UNISWAP;
        address sushiSwap_ = UNISWAP;
        uint256 amountOutUniswap = _tokenAmountOut(fromToken, toToken, amount, uniswap_);
        uint256 amountOutSushiSwap = _tokenAmountOut(fromToken, toToken, amount, sushiSwap_);
        return
            amountOutUniswap >= amountOutSushiSwap
                ? (uniswap_, amountOutUniswap)
                : (sushiSwap_, amountOutSushiSwap);
    }

    /**
     * @notice Gets the amount of tokenOut that would be received by selling the tokenIn for underlying
     * @return tokenOut amount that would be received
     */
    function _tokenAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address dex
    ) internal view returns (uint256) {
        address[] memory path = new address[](3);
        path[0] = tokenIn;
        path[1] = WETH;
        path[2] = tokenOut;
        return UniswapRouter02(dex).getAmountsOut(amountIn, path)[2];
    }
}
