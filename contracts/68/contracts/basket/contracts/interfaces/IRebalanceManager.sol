// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

interface IRebalanceManager {
    struct UniswapV3SwapStruct {
        address exchange;
        bytes path;
        address tokenIn;
        address tokenOut;
        uint256 quantity; //Quantity to sell
        uint256 minReturn; //Minimum quantity to buy //todo change to price for safty
    }
    struct UniswapV2SwapStruct {
        address exchange;
        address[] path;
        uint256 quantity; //Quantity to sell
        uint256 minReturn; //Minimum quantity to buy //todo change to price for safty
    }

    /**
        @notice Rebalance underling token
        @param _swapsV2 Swaps to perform
        @param _swapsV3 Swaps to perform
        @param _deadline Unix timestamp after which the transaction will revert.
    */
    function rebalance(
        UniswapV2SwapStruct[] calldata _swapsV2,
        UniswapV3SwapStruct[] calldata _swapsV3,
        uint256 _deadline
    ) external;
}
