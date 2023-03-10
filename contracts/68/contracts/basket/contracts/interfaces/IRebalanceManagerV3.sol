// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

interface IRebalanceManagerV3 {
    struct UnderlyingTrade {
        UniswapV2SwapStruct[] swaps;
        uint256 quantity;
        uint256 minimumReturn;
    }

    struct UniswapV2SwapStruct {
        address exchange;
        address[] path;
    }

    /**
        @notice Rebalance underling token
        @param _swapsV2 Swaps to perform
        @param _deadline Unix timestamp after which the transaction will revert.
    */
    function rebalance(UnderlyingTrade[] calldata _swapsV2, uint256 _deadline)
        external;
}
