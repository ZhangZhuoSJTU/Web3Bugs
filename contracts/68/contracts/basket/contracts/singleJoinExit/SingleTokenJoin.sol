//SPDX-License-Identifier: Unlicense
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {IPangolinRouter} from "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";

import "../interfaces/IBasketFacet.sol";

contract SingleTokenJoin {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Can be any IPangolinRouter or IUniRouter ...
    IPangolinRouter public immutable uniSwapLikeRouter;
    // WETH or WAVAX ...
    IERC20 public immutable INTERMEDIATE_TOKEN;
    struct JoinTokenStruct {
        address inputToken;
        address outputBasket;
        uint256 inputAmount;
        uint256 outputAmount;
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

    function joinTokenSingle(JoinTokenStruct calldata _joinTokenStruct)
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
        uint256 remainingIntermediateBalance = INTERMEDIATE_TOKEN.balanceOf(
            address(this)
        );
        if (remainingIntermediateBalance > 0) {
            INTERMEDIATE_TOKEN.safeTransfer(
                msg.sender,
                remainingIntermediateBalance
            );
        }
    }

    function _joinTokenSingle(JoinTokenStruct calldata _joinTokenStruct)
        internal
    {
        // ######## INIT TOKEN #########
        IERC20 inputToken = IERC20(_joinTokenStruct.inputToken);
        IERC20 outputToken = IERC20(_joinTokenStruct.outputBasket);

        (address[] memory tokens, uint256[] memory amounts) = IBasketFacet(
            _joinTokenStruct.outputBasket
        ).calcTokensForAmount(_joinTokenStruct.outputAmount);

        // ######## SWAP TOKEN #########
        address[] memory path = new address[](2);
        if (_joinTokenStruct.inputToken != address(INTERMEDIATE_TOKEN)) {
            _maxApprove(inputToken, address(uniSwapLikeRouter));

            path[0] = _joinTokenStruct.inputToken;
            path[1] = address(INTERMEDIATE_TOKEN);
            uint256[] memory amountsOut = uniSwapLikeRouter.getAmountsOut(
                _joinTokenStruct.inputAmount,
                path
            );

            uniSwapLikeRouter.swapExactTokensForTokens(
                _joinTokenStruct.inputAmount,
                amountsOut[amountsOut.length - 1],
                path,
                address(this),
                _joinTokenStruct.deadline
            );
        }

        path[0] = address(INTERMEDIATE_TOKEN);

        _maxApprove(INTERMEDIATE_TOKEN, address(uniSwapLikeRouter));
        for (uint256 i; i < tokens.length; i++) {
            path[1] = tokens[i];

            uint256[] memory amountsIn = uniSwapLikeRouter.getAmountsIn(
                amounts[i],
                path
            );

            uniSwapLikeRouter.swapTokensForExactTokens(
                amounts[i],
                amountsIn[0],
                path,
                address(this),
                _joinTokenStruct.deadline
            );
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
