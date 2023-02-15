// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "../external/libraries/UniswapV2Library.sol";

contract MockUniswapV2Library {
    function pairFor(
        address _factory,
        address _token0,
        address _token1
    ) external pure returns (address) {
        return UniswapV2Library.pairFor(_factory, _token0, _token1);
    }
}
