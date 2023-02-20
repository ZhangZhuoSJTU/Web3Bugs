// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

import "./MockUniswapV2Pair.sol";
pragma experimental ABIEncoderV2;


contract MockUniswapV2Factory {

    mapping(address => mapping(address => MockUniswapV2Pair)) pairs;

    function addPair(MockUniswapV2Pair pair) external {
        pairs[pair.token0()][pair.token1()] = pair;
        pairs[pair.token1()][pair.token0()] = pair;
    }

    function getPair(
        address tokenA,
        address tokenB)
    external view returns (address)
    {
        MockUniswapV2Pair pair;

        if (tokenA < tokenB) {
            pair = pairs[tokenA][tokenB];
        } else {
            pair = pairs[tokenB][tokenA];
        }
        return address(pair);
    }


}
