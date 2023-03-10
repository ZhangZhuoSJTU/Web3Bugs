//SPDX-License-Identifier: Unlicense
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IPangolinRouter} from "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";

import "../interfaces/IBasketFacet.sol";

contract SingleTokenJoinV2 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Can be any IPangolinRouter or IUniRouter ...
    IPangolinRouter public immutable uniSwapLikeRouter;
    // WETH or WAVAX ...
    IERC20 public immutable INTERMEDIATE_TOKEN;

    struct UnderlyingTrade {
        UniswapV2SwapStruct[] swaps;
        uint256 quantity; //Quantity to buy
    }

    struct UniswapV2SwapStruct {
        address exchange;
        address[] path;
    }
    struct JoinTokenStructV2 {
        address inputToken;
        address outputBasket;
        uint256 inputAmount;
        uint256 outputAmount;
        UnderlyingTrade[] trades;
        uint256 deadline;
        uint16 referral;
    }

    constructor(address _INTERMEDIATE_TOKEN, address _uniSwapLikeRouter) {
        require(_INTERMEDIATE_TOKEN != address(0), "INTERMEDIATE_ZERO");
        require(_uniSwapLikeRouter != address(0), "UNI_ROUTER_ZERO");

        INTERMEDIATE_TOKEN = IERC20(_INTERMEDIATE_TOKEN);
        uniSwapLikeRouter = IPangolinRouter(_uniSwapLikeRouter);
    }

    function _maxApprove(IERC20 token, address spender) internal {
        if (
            token.allowance(address(this), spender) <
            token.balanceOf(address(this))
        ) {
            token.approve(spender, uint256(-1));
        }
    }

    function joinTokenSingle(JoinTokenStructV2 calldata _joinTokenStruct)
        external
    {
        // ######## INIT TOKEN #########
        IERC20 inputToken = IERC20(_joinTokenStruct.inputToken);

        inputToken.safeTransferFrom(
            msg.sender,
            address(this),
            _joinTokenStruct.inputAmount
        );

        _joinTokenSingle(_joinTokenStruct);

        // ######## SEND TOKEN #########
        uint256 remainingIntermediateBalance = inputToken.balanceOf(
            address(this)
        );
        if (remainingIntermediateBalance > 0) {
            inputToken.safeTransfer(msg.sender, remainingIntermediateBalance);
        }
    }

    function _joinTokenSingle(JoinTokenStructV2 calldata _joinTokenStruct)
        internal
    {
        // ######## INIT TOKEN #########
        IERC20 outputToken = IERC20(_joinTokenStruct.outputBasket);

        for (uint256 i; i < _joinTokenStruct.trades.length; i++) {
            UnderlyingTrade calldata trade = _joinTokenStruct.trades[i];
            uint256[] memory inputs = new uint256[](trade.swaps.length + 1);
            inputs[0] = trade.quantity;
            //Get inputs to
            for (uint256 j; j < trade.swaps.length; j++) {
                UniswapV2SwapStruct calldata swap = trade.swaps[
                    trade.swaps.length - j - 1
                ];
                uint256[] memory amounts = IPangolinRouter(swap.exchange)
                    .getAmountsIn(inputs[j], swap.path);
                inputs[j + 1] = amounts[0];
            }

            for (uint256 j; j < trade.swaps.length; j++) {
                UniswapV2SwapStruct calldata swap = trade.swaps[j];
                uint256 amountIn = inputs[trade.swaps.length - j];
                _maxApprove(IERC20(swap.path[0]), address(swap.exchange));
                IPangolinRouter(swap.exchange).swapExactTokensForTokens(
                    amountIn,
                    0,
                    swap.path,
                    address(this),
                    block.timestamp
                );
            }
        }

        address[] memory tokens = IBasketFacet(_joinTokenStruct.outputBasket)
            .getTokens();

        for (uint256 i; i < tokens.length; i++) {
            _maxApprove(IERC20(tokens[i]), _joinTokenStruct.outputBasket);
        }

        IBasketFacet(_joinTokenStruct.outputBasket).joinPool(
            _joinTokenStruct.outputAmount,
            _joinTokenStruct.referral
        );

        // ######## SEND TOKEN #########

        uint256 outputAmount = outputToken.balanceOf(address(this));
        require(
            outputAmount == _joinTokenStruct.outputAmount,
            "FAILED_OUTPUT_AMOUNT"
        );
        outputToken.safeTransfer(msg.sender, outputAmount);
    }
}
