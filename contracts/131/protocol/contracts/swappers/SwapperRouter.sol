// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../access/Authorization.sol";

import "../../libraries/AddressProviderHelpers.sol";
import "../../libraries/Errors.sol";
import "../../libraries/DecimalScale.sol";
import "../../libraries/ScaledMath.sol";

import "../../interfaces/IAddressProvider.sol";
import "../../interfaces/ISwapperRouter.sol";
import "../../interfaces/vendor/UniswapRouter02.sol";
import "../../interfaces/vendor/IWETH.sol";
import "../../interfaces/IERC20Full.sol";
import "../../interfaces/vendor/ICurveSwapEth.sol";

/**
 * The swapper router handles the swapping from one token to another.
 * By default it does all swaps through WETH, in two steps checking which DEX is better for each stage of the swap.
 * It also supports ETH in or out and handles it by converting to WETH and back.
 */
contract SwapperRouter is ISwapperRouter, Authorization {
    using SafeERC20 for IERC20;
    using DecimalScale for uint256;
    using ScaledMath for uint256;
    using AddressProviderHelpers for IAddressProvider;

    // Dex contracts
    address private constant _UNISWAP = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); // Uniswap Router, used for swapping tokens on Uniswap
    address private constant _SUSHISWAP = address(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F); // Sushiswap Router, used for swapping tokens on Sushiswap
    IWETH private constant _WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // WETH, used for wrapping and unwrapping ETH for swaps

    IAddressProvider private immutable _addressProvider; // Address provider used for getting oracle provider

    uint256 public slippageTolerance; // The amount of slippage to allow from the oracle price of an asset
    mapping(address => ICurveSwapEth) public curvePools; // Curve Pool to use for swapping with WETH

    event Swapped(address fromToken, address toToken, uint256 amountIn, uint256 amountOut); // Emmited after a successfull swap
    event SetSlippageTolerance(uint256 value); // Emitted after a successful setting of slippage tolerance
    event SetCurvePool(address token, address curvePool); // Emitted after a successful setting of a Curve Pool

    constructor(address addressProvider_)
        Authorization(IAddressProvider(addressProvider_).getRoleManager())
    {
        _addressProvider = IAddressProvider(addressProvider_);
        slippageTolerance = 0.97e18;
    }

    receive() external payable {} // Used for receiving ETH when unwrapping WETH

    /**
     * @notice Swaps all of the users balance of fromToken for toToken.
     * @param fromToken_ The token to swap from.
     * @param toToken_ The token to swap to.
     * @return amountOut The amount of toToken received.
     */
    function swapAll(address fromToken_, address toToken_)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        // Swapping if from token is ETH
        if (fromToken_ == address(0)) {
            return swap(fromToken_, toToken_, address(this).balance);
        }

        // Swapping if from token is ERC20
        return swap(fromToken_, toToken_, IERC20(fromToken_).balanceOf(address(msg.sender)));
    }

    /**
     * @notice Set slippage tolerance for swaps.
     * @dev Stored as a multiplier, e.g. 2% would be set as 0.98.
     * @param slippageTolerance_ New slippage tolerance.
     */
    function setSlippageTolerance(uint256 slippageTolerance_) external override onlyGovernance {
        require(slippageTolerance_ <= ScaledMath.ONE, Error.INVALID_SLIPPAGE_TOLERANCE);
        slippageTolerance = slippageTolerance_;
        emit SetSlippageTolerance(slippageTolerance_);
    }

    /**
     * @notice Sets the Curve Pool to use for swapping a token with WETH.
     * @dev To use Uniswap or Sushiswap instead, set the Curve Pool to the zero address.
     * @param token_ The token to set the Curve Pool for.
     * @param curvePool_ The address of the Curve Pool.
     */
    function setCurvePool(address token_, address curvePool_) external override onlyGovernance {
        require(token_ != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        require(curvePool_ != address(curvePools[token_]), Error.SAME_ADDRESS_NOT_ALLOWED);
        curvePools[token_] = ICurveSwapEth(curvePool_);
        emit SetCurvePool(token_, curvePool_);
    }

    /**
     * @notice Gets the amount of toToken received by swapping amountIn of fromToken.
     * @dev In the case where a custom swapper is used, return value may not be precise.
     * @param fromToken_ The token to swap from.
     * @param toToken_ The token to swap to.
     * @param amountIn_ The amount of fromToken being swapped.
     * @return amountOut The amount of toToken received by swapping amountIn of fromToken.
     */
    function getAmountOut(
        address fromToken_,
        address toToken_,
        uint256 amountIn_
    ) external view override returns (uint256 amountOut) {
        if (fromToken_ == toToken_ || amountIn_ == 0) return amountIn_;

        return _getTokenOut(toToken_, _getWethOut(fromToken_, amountIn_));
    }

    /**
     * @notice Swaps an amount of fromToken to toToken.
     * @param fromToken_ The token to swap from.
     * @param toToken_ The token to swap to.
     * @param amountIn_ The amount of fromToken to swap for toToken.
     * @return amountOut The amount of toToken received.
     */
    function swap(
        address fromToken_,
        address toToken_,
        uint256 amountIn_
    ) public payable override returns (uint256 amountOut) {
        // Validating ETH value sent
        require(msg.value == (fromToken_ == address(0) ? amountIn_ : 0), Error.INVALID_AMOUNT);
        if (amountIn_ == 0) {
            emit Swapped(fromToken_, toToken_, 0, 0);
            return 0;
        }

        // Handling swap between the same token
        if (fromToken_ == toToken_) {
            if (fromToken_ == address(0)) {
                payable(msg.sender).transfer(amountIn_);
            }
            emit Swapped(fromToken_, toToken_, amountIn_, amountIn_);
            return amountIn_;
        }

        // Transferring to contract if ERC20
        if (fromToken_ != address(0)) {
            IERC20(fromToken_).safeTransferFrom(msg.sender, address(this), amountIn_);
        }

        // Swapping token via WETH
        uint256 amountOut_ = _swapWethForToken(toToken_, _swapForWeth(fromToken_));
        emit Swapped(fromToken_, toToken_, amountIn_, amountOut_);
        return _returnTokens(toToken_, amountOut_);
    }

    /**
     * @dev Swaps the full contract balance of token to WETH.
     * @param token_ The token to swap to WETH.
     * @return amountOut The amount of WETH received from the swap.
     */
    function _swapForWeth(address token_) internal returns (uint256 amountOut) {
        if (token_ == address(_WETH)) return _WETH.balanceOf(address(this));

        // Handling ETH -> WETH
        if (token_ == address(0)) {
            uint256 ethBalance_ = address(this).balance;
            if (ethBalance_ == 0) return 0;
            _WETH.deposit{value: ethBalance_}();
            return ethBalance_;
        }

        // Handling Curve Pool swaps
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            uint256 amount_ = IERC20(token_).balanceOf(address(this));
            if (amount_ == 0) return 0;
            _approve(token_, address(curvePool_));
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            curvePool_.exchange(
                tokenIndex_,
                wethIndex_,
                amount_,
                _minWethAmountOut(amount_, token_)
            );
            return _WETH.balanceOf(address(this));
        }

        // Handling ERC20 -> WETH
        return _swap(token_, address(_WETH), IERC20(token_).balanceOf(address(this)));
    }

    /**
     * @dev Swaps the full contract balance of WETH to token.
     * @param token_ The token to swap WETH to.
     * @return amountOut The amount of token received from the swap.
     */
    function _swapWethForToken(address token_, uint256 amount_)
        internal
        returns (uint256 amountOut)
    {
        if (amount_ == 0) return 0;
        if (token_ == address(_WETH)) return amount_;

        // Handling WETH -> ETH
        if (token_ == address(0)) {
            _WETH.withdraw(amount_);
            return amount_;
        }

        // Handling Curve Pool swaps
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            _approve(address(_WETH), address(curvePool_));
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            curvePool_.exchange(
                wethIndex_,
                tokenIndex_,
                amount_,
                _minTokenAmountOut(amount_, token_)
            );
            return IERC20(token_).balanceOf(address(this));
        }

        // Handling WETH -> ERC20
        return _swap(address(_WETH), token_, amount_);
    }

    /**
     * @dev Swaps an amount of fromToken to toToken.
     * @param fromToken_ The token to swap from.
     * @param toToken_ The token to swap to.
     * @param amount_ The amount of fromToken to swap.
     * @return amountOut The amount of toToken received from the swap.
     */
    function _swap(
        address fromToken_,
        address toToken_,
        uint256 amount_
    ) internal returns (uint256 amountOut) {
        if (amount_ == 0) return 0;
        if (fromToken_ == toToken_) return amount_;
        address dex_ = _getBestDex(fromToken_, toToken_, amount_);
        _approve(fromToken_, dex_);
        address[] memory path_ = new address[](2);
        path_[0] = fromToken_;
        path_[1] = toToken_;
        return
            UniswapRouter02(dex_).swapExactTokensForTokens(
                amount_,
                _getAmountOutMin(amount_, fromToken_, toToken_),
                path_,
                address(this),
                block.timestamp
            )[1];
    }

    /**
     * @dev Approves infinite spending for the given spender.
     * @param token_ The token to approve for.
     * @param spender_ The spender to approve.
     */
    function _approve(address token_, address spender_) internal {
        if (IERC20(token_).allowance(address(this), spender_) > 0) return;
        IERC20(token_).safeApprove(spender_, type(uint256).max);
    }

    /**
     * @dev Returns an amount of tokens to the sender.
     * @param token_ The token to return to sender.
     * @param amount_ The amount of tokens to return to sender.
     * @return amountReturned The amount of tokens returned to sender.
     */
    function _returnTokens(address token_, uint256 amount_)
        internal
        returns (uint256 amountReturned)
    {
        // Returning if ETH
        if (token_ == address(0)) {
            payable(msg.sender).transfer(amount_);
            return amount_;
        }

        // Returning if ERC20
        IERC20(token_).safeTransfer(msg.sender, amount_);
        return amount_;
    }

    /**
     * @dev Gets the amount of WETH received by swapping amount of token
     *      In the case where a custom swapper is used, return value may not be precise.
     * @param token_ The token to swap from.
     * @param amount_ The mount of token being swapped.
     * @return amountOut The amount of WETH received by swapping amount of token.
     */
    function _getWethOut(address token_, uint256 amount_)
        internal
        view
        returns (uint256 amountOut)
    {
        if (token_ == address(_WETH) || token_ == address(0)) return amount_;

        // Handling Curve Pool swaps
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            return curvePool_.get_dy(tokenIndex_, wethIndex_, amount_);
        }

        return
            _tokenAmountOut(
                token_,
                address(_WETH),
                amount_,
                _getBestDex(token_, address(_WETH), amount_)
            );
    }

    /**
     * @dev Gets the amount of token received by swapping amount of WETH
     *      In the case where a custom swapper is used, return value may not be precise.
     * @param token_ The token to swap to.
     * @param amount_ The amount of WETH being swapped.
     * @return amountOut The amount of token received by swapping amount of WETH.
     */
    function _getTokenOut(address token_, uint256 amount_)
        internal
        view
        returns (uint256 amountOut)
    {
        if (token_ == address(_WETH) || token_ == address(0)) return amount_;

        // Handling Curve Pool swaps
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            return curvePool_.get_dy(wethIndex_, tokenIndex_, amount_);
        }

        return
            _tokenAmountOut(
                address(_WETH),
                token_,
                amount_,
                _getBestDex(address(_WETH), token_, amount_)
            );
    }

    /**
     * @dev Gets the best dex to use for swapping tokens based on which gives the highest amount out.
     * @param fromToken_ The token to swap from.
     * @param toToken_ The token to swap to.
     * @param amount_ The amount of fromToken to swap.
     * @return bestDex The best dex to use for swapping tokens based on which gives the highest amount out
     */
    function _getBestDex(
        address fromToken_,
        address toToken_,
        uint256 amount_
    ) internal view returns (address bestDex) {
        address uniswap_ = _UNISWAP;
        address sushiswap_ = _SUSHISWAP;
        return
            _tokenAmountOut(fromToken_, toToken_, amount_, uniswap_) >=
                _tokenAmountOut(fromToken_, toToken_, amount_, sushiswap_)
                ? uniswap_
                : sushiswap_;
    }

    /**
     * @notice Gets the amount of toToken received by swapping amountIn of fromToken.
     * @param fromToken_ The token to swap from.
     * @param toToken_ The token to swap to.
     * @param amountIn_ The amount of fromToken being swapped.
     * @param dex_ The DEX to use for the swap.
     * @return amountOut The amount of toToken received by swapping amountIn of fromToken.
     */
    function _tokenAmountOut(
        address fromToken_,
        address toToken_,
        uint256 amountIn_,
        address dex_
    ) internal view returns (uint256 amountOut) {
        address[] memory path_ = new address[](2);
        path_[0] = fromToken_;
        path_[1] = toToken_;
        return UniswapRouter02(dex_).getAmountsOut(amountIn_, path_)[1];
    }

    /**
     * @dev Returns the minimum amount of toToken_ to receive from swap.
     * @param amount_ The amount of fromToken_ being swapped.
     * @param fromToken_ The Token being swapped from.
     * @param toToken_ The Token being swapped to.
     * @return amountOutMin The minimum amount of toToken_ to receive from swap.
     */
    function _getAmountOutMin(
        uint256 amount_,
        address fromToken_,
        address toToken_
    ) internal view returns (uint256 amountOutMin) {
        return
            fromToken_ == address(_WETH)
                ? _minTokenAmountOut(amount_, toToken_)
                : _minWethAmountOut(amount_, fromToken_);
    }

    /**
     * @dev Returns the minimum amount of Token to receive from swap.
     * @param wethAmount_ The amount of WETH being swapped.
     * @param token_ The Token the WETH is being swapped to.
     * @return minAmountOut The minimum amount of Token to receive from swap.
     */
    function _minTokenAmountOut(uint256 wethAmount_, address token_)
        internal
        view
        returns (uint256 minAmountOut)
    {
        uint256 priceInEth_ = _getPriceInEth(token_);
        if (priceInEth_ == 0) return 0;
        return
            wethAmount_.scaledDiv(priceInEth_).scaledMul(slippageTolerance).scaleTo(
                IERC20Full(token_).decimals()
            );
    }

    /**
     * @dev Returns the minimum amount of WETH to receive from swap.
     * @param tokenAmount_ The amount of Token being swapped.
     * @param token_ The Token that is being swapped for WETH.
     * @return minAmountOut The minimum amount of WETH to receive from swap.
     */
    function _minWethAmountOut(uint256 tokenAmount_, address token_)
        internal
        view
        returns (uint256 minAmountOut)
    {
        uint256 priceInEth_ = _getPriceInEth(token_);
        if (priceInEth_ == 0) return 0;
        return
            tokenAmount_.scaledMul(priceInEth_).scaledMul(slippageTolerance).scaleFrom(
                IERC20Full(token_).decimals()
            );
    }

    /**
     * @dev Returns the price in ETH of the given token. If no oracle exists for the token, returns 0.
     * @param token_ The token to get the price for.
     * @return tokenPriceInEth The price of the token in ETH.
     */
    function _getPriceInEth(address token_) internal view returns (uint256 tokenPriceInEth) {
        try _addressProvider.getOracleProvider().getPriceETH(token_) returns (uint256 price_) {
            return price_;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Returns the Curve Pool coin indices for a given Token.
     * @param curvePool_ The Curve Pool to return the indices for.
     * @param token_ The Token to get the indices for.
     * @return wethIndex_ The coin index for WETH.
     * @return tokenIndex_ The coin index for the Token.
     */
    function _getIndices(ICurveSwapEth curvePool_, address token_)
        internal
        view
        returns (uint256 wethIndex_, uint256 tokenIndex_)
    {
        return curvePool_.coins(1) == token_ ? (0, 1) : (1, 0);
    }
}
