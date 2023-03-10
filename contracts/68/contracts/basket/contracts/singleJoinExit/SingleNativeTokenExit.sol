//SPDX-License-Identifier: Unlicense
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IWrappedNativeToken.sol";
import {IPangolinRouter} from "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";

import "../interfaces/IBasketFacet.sol";

contract SingleNativeTokenExit {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Can be any IPangolinRouter or IUniRouter ...
    IPangolinRouter public immutable uniSwapLikeRouter;
    // WETH or WAVAX ...
    IERC20 public immutable INTERMEDIATE_TOKEN;
    struct ExitTokenStruct {
        address inputBasket;
        uint256 inputAmount;
        uint256 minAmount;
        uint256 deadline;
        uint16 referral;
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

    function exitEth(ExitTokenStruct calldata _exitTokenStruct) external {
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

        address[] memory tokens = IBasketFacet(address(inputBasket))
            .getTokens();

        address[] memory path = new address[](2);
        path[1] = address(INTERMEDIATE_TOKEN);

        for (uint256 i; i < tokens.length; i++) {
            path[0] = tokens[i];

            _maxApprove(IERC20(tokens[i]), address(uniSwapLikeRouter));
            uniSwapLikeRouter.swapExactTokensForTokens(
                IERC20(tokens[i]).balanceOf(address(this)),
                0,
                path,
                address(this),
                _exitTokenStruct.deadline
            );
        }

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
