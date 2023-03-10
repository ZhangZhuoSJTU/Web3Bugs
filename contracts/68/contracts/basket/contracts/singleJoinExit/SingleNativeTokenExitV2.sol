//SPDX-License-Identifier: Unlicense
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IWrappedNativeToken.sol";

import {IPangolinRouter} from "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";

import "../interfaces/IBasketFacet.sol";

contract SingleNativeTokenExitV2 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Can be any IPangolinRouter or IUniRouter ...
    IPangolinRouter public immutable uniSwapLikeRouter;
    // WETH or WAVAX ...
    IERC20 public immutable INTERMEDIATE_TOKEN;

    struct ExitUnderlyingTrade {
        ExitUniswapV2SwapStruct[] swaps;
    }

    struct ExitUniswapV2SwapStruct {
        address exchange;
        address[] path;
    }
    struct ExitTokenStructV2 {
        address inputBasket;
        uint256 inputAmount;
        uint256 minAmount;
        uint256 deadline;
        uint16 referral;
        ExitUnderlyingTrade[] trades;
    }

    constructor(address _INTERMEDIATE_TOKEN, address _uniSwapLikeRouter) {
        require(_INTERMEDIATE_TOKEN != address(0), "INTERMEDIATE_ZERO");
        require(_uniSwapLikeRouter != address(0), "UNI_ROUTER_ZERO");

        INTERMEDIATE_TOKEN = IERC20(_INTERMEDIATE_TOKEN);
        uniSwapLikeRouter = IPangolinRouter(_uniSwapLikeRouter);
    }

    receive() external payable {}

    function _maxApprove(IERC20 token, address spender) internal {
        if (
            token.allowance(address(this), spender) <
            token.balanceOf(address(this))
        ) {
            token.approve(spender, uint256(-1));
        }
    }

    function _exit(ExitTokenStructV2 calldata _exitTokenStruct) internal {
        // ######## INIT TOKEN #########
        IERC20 inputBasket = IERC20(_exitTokenStruct.inputBasket);

        inputBasket.safeTransferFrom(
            msg.sender,
            address(this),
            _exitTokenStruct.inputAmount
        );

        IBasketFacet(address(inputBasket)).exitPool(
            _exitTokenStruct.inputAmount,
            _exitTokenStruct.referral
        );

        for (uint256 i; i < _exitTokenStruct.trades.length; i++) {
            ExitUnderlyingTrade calldata trade = _exitTokenStruct.trades[i];
            for (uint256 j; j < trade.swaps.length; j++) {
                ExitUniswapV2SwapStruct calldata swap = trade.swaps[j];
                _maxApprove(IERC20(swap.path[0]), address(swap.exchange));
                IPangolinRouter(swap.exchange).swapExactTokensForTokens(
                    IERC20(swap.path[0]).balanceOf(address(this)),
                    0,
                    swap.path,
                    address(this),
                    block.timestamp
                );
            }
        }
    }

    function exit(ExitTokenStructV2 calldata _exitTokenStruct) external {
        _exit(_exitTokenStruct);
        address[] calldata path = _exitTokenStruct
            .trades[0]
            .swaps[_exitTokenStruct.trades[0].swaps.length - 1]
            .path;
        IERC20 outputToken = IERC20(path[path.length - 1]); //this could be not the target token

        uint256 outputTokenBalance = outputToken.balanceOf(address(this));
        require(
            outputTokenBalance >= _exitTokenStruct.minAmount,
            "Insufficient output"
        );

        outputToken.transfer(msg.sender, outputTokenBalance);
    }

    function exitEth(ExitTokenStructV2 calldata _exitTokenStruct) external {
        _exit(_exitTokenStruct);

        uint256 intermediateTokenBalance = INTERMEDIATE_TOKEN.balanceOf(
            address(this)
        );
        require(
            intermediateTokenBalance >= _exitTokenStruct.minAmount,
            "Insufficient output"
        );

        IWrappedNativeToken(address(INTERMEDIATE_TOKEN)).withdraw(
            intermediateTokenBalance
        );
        msg.sender.transfer(intermediateTokenBalance);
    }
}
