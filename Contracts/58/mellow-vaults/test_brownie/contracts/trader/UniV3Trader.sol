// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/external/univ3/ISwapRouter.sol";
import "./libraries/TraderExceptionsLibrary.sol";
import "./Trader.sol";

/// @notice Contract that can execute ERC20 swaps on Uniswap V3
contract UniV3Trader is Trader, ITrader {
    using SafeERC20 for IERC20;

    struct Options {
        uint24 fee;
        uint160 sqrtPriceLimitX96;
        uint256 deadline;
        uint256 limitAmount;
    }

    struct PathItemOptions {
        uint24 fee;
    }

    ISwapRouter public swapRouter;

    constructor(address _swapRouter) {
        swapRouter = ISwapRouter(_swapRouter);
    }

    /// @inheritdoc ITrader
    function swapExactInput(
        uint256,
        uint256 amount,
        address recipient,
        PathItem[] memory path,
        bytes memory options
    ) external returns (uint256) {
        Options memory options_ = abi.decode(options, (Options));
        if (path.length == 1) {
            return _swapExactInputSingle(path[0].token0, path[0].token1, amount, recipient, options_);
        } else {
            require(_validatePathLinked(path), TraderExceptionsLibrary.INVALID_TRADE_PATH_EXCEPTION);
            return _swapExactInputMultihop(amount, recipient, path, options_);
        }
    }

    /// @inheritdoc ITrader
    function swapExactOutput(
        uint256,
        uint256 amount,
        address recipient,
        PathItem[] memory path,
        bytes memory options
    ) external returns (uint256) {
        Options memory options_ = abi.decode(options, (Options));
        if (path.length == 0) {
            return _swapExactOutputSingle(path[0].token0, path[0].token1, amount, recipient, options_);
        } else {
            require(_validatePathLinked(path), TraderExceptionsLibrary.INVALID_TRADE_PATH_EXCEPTION);
            return _swapExactOutputMultihop(amount, recipient, path, options_);
        }
    }

    function _validatePathLinked(PathItem[] memory path) internal pure returns (bool result) {
        if (path.length == 0) return false;
        for (uint256 i = 0; i < path.length - 1; ++i) if (path[0].token1 != path[i + 1].token0) return false;
        return true;
    }

    function _swapExactInputSingle(
        address input,
        address output,
        uint256 amount,
        address recipient,
        Options memory options
    ) internal returns (uint256 amountOut) {
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: input,
            tokenOut: output,
            fee: options.fee,
            recipient: recipient,
            deadline: options.deadline,
            amountIn: amount,
            amountOutMinimum: options.limitAmount,
            sqrtPriceLimitX96: options.sqrtPriceLimitX96
        });
        IERC20(input).safeTransferFrom(msg.sender, address(this), amount);
        _approveERC20TokenIfNecessary(input, address(swapRouter));
        amountOut = swapRouter.exactInputSingle(params);
    }

    function _swapExactOutputSingle(
        address input,
        address output,
        uint256 amount,
        address recipient,
        Options memory options
    ) internal returns (uint256 amountIn) {
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: input,
            tokenOut: output,
            fee: options.fee,
            recipient: recipient,
            deadline: options.deadline,
            amountOut: amount,
            amountInMaximum: options.limitAmount,
            sqrtPriceLimitX96: options.sqrtPriceLimitX96
        });
        IERC20(input).safeTransferFrom(msg.sender, address(this), options.limitAmount);
        _approveERC20TokenIfNecessary(input, address(swapRouter));
        amountIn = swapRouter.exactOutputSingle(params);
        if (amountIn < options.limitAmount)
            IERC20(input).safeTransferFrom(address(this), recipient, options.limitAmount - amountIn);
    }

    function _swapExactInputMultihop(
        uint256 amount,
        address recipient,
        PathItem[] memory path,
        Options memory options
    ) internal returns (uint256 amountOut) {
        address input = path[0].token0;
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: _makeMultihopPath(path),
            recipient: recipient,
            deadline: options.deadline,
            amountIn: amount,
            amountOutMinimum: options.limitAmount
        });
        IERC20(input).safeTransferFrom(msg.sender, address(this), amount);
        _approveERC20TokenIfNecessary(input, address(swapRouter));
        amountOut = swapRouter.exactInput(params);
    }

    function _swapExactOutputMultihop(
        uint256 amount,
        address recipient,
        PathItem[] memory path,
        Options memory options
    ) internal returns (uint256 amountIn) {
        address input = path[0].token0;
        ISwapRouter.ExactOutputParams memory params = ISwapRouter.ExactOutputParams({
            path: _reverseBytes(_makeMultihopPath(path)),
            recipient: recipient,
            deadline: options.deadline,
            amountOut: amount,
            amountInMaximum: options.limitAmount
        });
        IERC20(input).safeTransferFrom(msg.sender, address(this), options.limitAmount);
        _approveERC20TokenIfNecessary(input, address(swapRouter));
        amountIn = swapRouter.exactOutput(params);
        if (amountIn < options.limitAmount)
            IERC20(input).safeTransferFrom(address(this), recipient, options.limitAmount - amountIn);
    }

    function _reverseBytes(bytes memory input) internal pure returns (bytes memory output) {
        for (uint256 i = 0; i < input.length; ++i) output[i] = input[input.length - 1 - i];
    }

    function _makeMultihopPath(PathItem[] memory path) internal pure returns (bytes memory) {
        bytes memory result;
        for (uint256 i = 0; i < path.length; ++i) {
            PathItemOptions memory pathItemOptions = abi.decode(path[i].options, (PathItemOptions));
            result = bytes.concat(result, abi.encodePacked(path[i].token0, abi.encodePacked(pathItemOptions.fee)));
        }
        result = bytes.concat(result, abi.encodePacked(path[path.length - 1].token1));
        return result;
    }
}
