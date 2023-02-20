// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/IAddressProvider.sol";
import "../access/Authorization.sol";
import "./IStrategySwapper.sol";
import "../../interfaces/vendor/UniswapRouter02.sol";
import "../../interfaces/vendor/ICurveSwapEth.sol";
import "../../libraries/ScaledMath.sol";
import "../../libraries/AddressProviderHelpers.sol";
import "../../interfaces/IERC20Full.sol";
import "../../interfaces/vendor/IWETH.sol";

contract StrategySwapper is IStrategySwapper, Authorization {
    using ScaledMath for uint256;
    using SafeERC20 for IERC20;
    using AddressProviderHelpers for IAddressProvider;

    IWETH internal constant _WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // WETH
    UniswapRouter02 internal constant _SUSHISWAP =
        UniswapRouter02(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F); // Sushiswap Router for swaps
    UniswapRouter02 internal constant _UNISWAP =
        UniswapRouter02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); // Uniswap Router for swaps

    IAddressProvider internal immutable _addressProvider; // Address provider used for getting oracle provider

    uint256 public slippageTolerance; // The amount of slippage to allow from the oracle price of an asset
    mapping(address => ICurveSwapEth) public curvePools; // Curve Pool to use for swaps to ETH (if any)
    mapping(address => bool) public swapViaUniswap; // If Uniswap should be used over Sushiswap for swaps

    event SetSlippageTolerance(uint256 value); // Emitted after a succuessful setting of slippage tolerance
    event SetCurvePool(address token, address curvePool); // Emitted after a succuessful setting of a Curve Pool
    event SetSwapViaUniswap(address token, bool swapViaUniswap); // Emitted after a succuessful setting of swap via Uniswap

    constructor(address addressProvider_, uint256 slippageTolerance_)
        Authorization(IAddressProvider(addressProvider_).getRoleManager())
    {
        _addressProvider = IAddressProvider(addressProvider_);
        slippageTolerance = slippageTolerance_;
    }

    receive() external payable {}

    /**
     * @notice Swaps all the balance of a token for WETH.
     * @param token_ Address of the token to swap for WETH.
     */
    function swapAllForWeth(address token_) external override {
        return swapForWeth(token_, IERC20(token_).balanceOf(msg.sender));
    }

    /**
     * @notice Swaps all available WETH for underlying.
     * @param token_ Address of the token to swap WETH to.
     */
    function swapAllWethForToken(address token_) external override {
        IWETH weth_ = _WETH;
        uint256 wethBalance_ = weth_.balanceOf(msg.sender);
        if (wethBalance_ == 0) return;
        weth_.transferFrom(msg.sender, address(this), wethBalance_);

        if (token_ == address(0)) {
            weth_.withdraw(wethBalance_);
            // solhint-disable-next-line avoid-low-level-calls
            (bool sent, ) = payable(msg.sender).call{value: wethBalance_}("");
            require(sent, "failed to send eth");
            return;
        }

        // Handling Curve Pool swaps
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            _approve(address(weth_), address(curvePool_));
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            curvePool_.exchange(
                wethIndex_,
                tokenIndex_,
                wethBalance_,
                _minTokenAmountOut(wethBalance_, token_)
            );
            IERC20(token_).safeTransfer(msg.sender, IERC20(token_).balanceOf(address(this)));
            return;
        }

        // Handling Uniswap or Sushiswap swaps
        address[] memory path_ = new address[](2);
        path_[0] = address(weth_);
        path_[1] = token_;
        UniswapRouter02 dex_ = _getDex(token_);
        _approve(address(weth_), address(dex_));
        uint256 amountOut_ = dex_.swapExactTokensForTokens(
            wethBalance_,
            _minTokenAmountOut(wethBalance_, token_),
            path_,
            address(this),
            block.timestamp
        )[1];
        IERC20(token_).safeTransfer(msg.sender, amountOut_);
    }

    /**
     * @notice Set slippage tolerance for swaps.
     * @dev Stored as a multiplier, e.g. 2% would be set as 0.98.
     * @param slippageTolerance_ New slippage tolerance.
     */
    function setSlippageTolerance(uint256 slippageTolerance_) external override onlyGovernance {
        require(slippageTolerance_ <= ScaledMath.ONE, Error.INVALID_SLIPPAGE_TOLERANCE);
        require(slippageTolerance_ > 0.8e18, Error.INVALID_SLIPPAGE_TOLERANCE);
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
     * @notice Sets if swaps should go via Uniswap for the given token_.
     * @param token_ The token to set the swapViaUniswap for.
     * @param swapViaUniswap_ If Sushiswap should be use for swaps for token_.
     */
    function setSwapViaUniswap(address token_, bool swapViaUniswap_)
        external
        override
        onlyGovernance
    {
        require(token_ != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        swapViaUniswap[token_] = swapViaUniswap_;
        emit SetSwapViaUniswap(token_, swapViaUniswap_);
    }

    /**
     * @notice Gets the amount of tokenOut_ that would be received by swapping amountIn_ of tokenIn_.
     * @param tokenIn_ The token to swap in.
     * @param tokenOut_ The token to get out.
     * @param amountIn_ The amount to swap in.
     * @return The amount of tokenOut_ that would be received by swapping amountIn_ of tokenIn_.
     */
    function amountOut(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_
    ) external view override returns (uint256) {
        if (amountIn_ == 0) return 0;
        uint256 wethOut_ = _tokenToWethAmountOut(tokenIn_, amountIn_);
        return _wethToTokenAmountOut(tokenOut_, wethOut_);
    }

    /**
     * @notice Swaps a token for WETH.
     * @param token_ Address of the token to swap for WETH.
     * @param amount_ Amount of the token to swap for WETH.
     */
    function swapForWeth(address token_, uint256 amount_) public override {
        if (amount_ == 0) return;
        IERC20(token_).safeTransferFrom(msg.sender, address(this), amount_);

        // Handling Curve Pool swaps
        ICurveSwapEth curvePool_ = curvePools[token_];
        IWETH weth_ = _WETH;
        if (address(curvePool_) != address(0)) {
            _approve(token_, address(curvePool_));
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            curvePool_.exchange(
                tokenIndex_,
                wethIndex_,
                amount_,
                _minWethAmountOut(amount_, token_)
            );
            IERC20(weth_).safeTransfer(msg.sender, weth_.balanceOf(address(this)));
            return;
        }

        // Handling Uniswap or Sushiswap swaps
        address[] memory path_ = new address[](2);
        path_[0] = token_;
        path_[1] = address(weth_);
        UniswapRouter02 dex_ = _getDex(token_);
        _approve(token_, address(dex_));
        uint256 amountOut_ = dex_.swapExactTokensForTokens(
            amount_,
            _minWethAmountOut(amount_, token_),
            path_,
            address(this),
            block.timestamp
        )[1];
        IERC20(weth_).safeTransfer(msg.sender, amountOut_);
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
     * @dev Gets the dex to use for swapping a given token.
     * @param token_ The token to get the dex for.
     * @return The dex to use for swapping a given token.
     */
    function _getDex(address token_) internal view returns (UniswapRouter02) {
        return swapViaUniswap[token_] ? _UNISWAP : _SUSHISWAP;
    }

    /**
     * @dev Returns the amount of WETH received by swapping amount_ of token_.
     * @param token_ The token to get the amount for swapping to WETH.
     * @param amount_ The amount of token_ that is being swapped to WETH.
     * @return The amount of WETH received by swapping amount_ of token_.
     */
    function _tokenToWethAmountOut(address token_, uint256 amount_)
        internal
        view
        returns (uint256)
    {
        if (amount_ == 0) return 0;
        IWETH weth_ = _WETH;
        if (token_ == address(weth_)) return amount_;
        if (token_ == address(0)) return amount_;

        // Getting amount via Curve Pool if set
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            return curvePool_.get_dy(tokenIndex_, wethIndex_, amount_);
        }

        // Getting amount via Uniswap or Sushiswap
        address[] memory path_ = new address[](2);
        path_[0] = token_;
        path_[1] = address(weth_);
        return _getDex(token_).getAmountsOut(amount_, path_)[1];
    }

    /**
     * @dev Returns the amount of token_ received by swapping amount_ of WETH.
     * @param token_ The token to get the amount for swapping from WETH.
     * @param amount_ The amount of WETH that is being swapped to token_.
     * @return The amount of token_ received by swapping amount_ of WETH.
     */
    function _wethToTokenAmountOut(address token_, uint256 amount_)
        internal
        view
        returns (uint256)
    {
        if (amount_ == 0) return 0;
        IWETH weth_ = _WETH;
        if (token_ == address(weth_)) return amount_;
        if (token_ == address(0)) return amount_;

        // Getting amount via Curve Pool if set
        ICurveSwapEth curvePool_ = curvePools[token_];
        if (address(curvePool_) != address(0)) {
            (uint256 wethIndex_, uint256 tokenIndex_) = _getIndices(curvePool_, token_);
            return curvePool_.get_dy(wethIndex_, tokenIndex_, amount_);
        }

        // Getting amount via Uniswap or Sushiswap
        address[] memory path_ = new address[](2);
        path_[0] = address(weth_);
        path_[1] = token_;
        return _getDex(token_).getAmountsOut(amount_, path_)[1];
    }

    /**
     * @dev Returns the multiplier for converting a token_ amount to the same decimals as WETH.
     *   For example, USDC (which has decimals of 6) would have a multiplier of 12e18.
     * @param token_ The token to get the decimal multiplier for.
     * @return the multiplier for converting a token_ amount to the same decimals as WETH.
     */
    function _decimalMultiplier(address token_) internal view returns (uint256) {
        return 10**(18 - IERC20Full(token_).decimals());
    }

    /**
     * @dev Returns the Curve Pool coin indicies for a given Token.
     * @param curvePool_ The Curve Pool to return the indicies for.
     * @param token_ The Token to get the indicies for.
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

    /**
     * @dev Returns the minimum amount of Token to recieve from swap.
     * @param wethAmount_ The amount of WETH being swapped.
     * @param token_ The Token the WETH is being swapped to.
     * @return minAmountOut The minimum amount of Token to recieve from swap.
     */
    function _minTokenAmountOut(uint256 wethAmount_, address token_)
        internal
        view
        returns (uint256 minAmountOut)
    {
        return
            wethAmount_
                .scaledDiv(_addressProvider.getOracleProvider().getPriceETH(token_))
                .scaledMul(slippageTolerance) / _decimalMultiplier(token_);
    }

    /**
     * @dev Returns the minimum amount of WETH to recieve from swap.
     * @param tokenAmount_ The amount of Token being swapped.
     * @param token_ The Token that is being swapped for WETH.
     * @return minAmountOut The minimum amount of WETH to recieve from swap.
     */
    function _minWethAmountOut(uint256 tokenAmount_, address token_)
        internal
        view
        returns (uint256 minAmountOut)
    {
        return
            tokenAmount_
                .scaledMul(_addressProvider.getOracleProvider().getPriceETH(token_))
                .scaledMul(slippageTolerance) * _decimalMultiplier(token_);
    }
}
