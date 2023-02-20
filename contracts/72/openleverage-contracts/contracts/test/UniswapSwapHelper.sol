// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;


import "./IUniswapV2Router.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract UniswapSwapHelper {
    IUniswapV2Router router;
    constructor (IUniswapV2Router _router) {
        router = _router;
    }

    function swap(address[] memory path) internal {
        uint balance = IERC20(path[0]).balanceOf(address(this));
        IERC20(path[0]).approve(address(router), balance);
        router.swapExactTokensForTokens(balance, 0, path, address(this), block.timestamp + 12 hours);
    }
}
