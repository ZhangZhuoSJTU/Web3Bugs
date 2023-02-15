// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../../interfaces/ISwap.sol";
import "../../hardhat/console.sol";

contract TestSwapReturnValues {
    using SafeMath for uint256;

    ISwap public swap;
    IERC20 public lpToken;
    uint8 public n;

    uint256 public constant MAX_INT = 2**256 - 1;

    constructor(
        ISwap swapContract,
        IERC20 lpTokenContract,
        uint8 numOfTokens
    ) public {
        swap = swapContract;
        lpToken = lpTokenContract;
        n = numOfTokens;

        // Pre-approve tokens
        for (uint8 i; i < n; i++) {
            swap.getToken(i).approve(address(swap), MAX_INT);
        }
        lpToken.approve(address(swap), MAX_INT);
    }

    function test_swap(
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx,
        uint256 minDy
    ) public {
        uint256 balanceBefore =
            swap.getToken(tokenIndexTo).balanceOf(address(this));
        uint256 returnValue =
            swap.swap(tokenIndexFrom, tokenIndexTo, dx, minDy, block.timestamp);
        uint256 balanceAfter =
            swap.getToken(tokenIndexTo).balanceOf(address(this));

        console.log(
            "swap: Expected %s, got %s",
            balanceAfter.sub(balanceBefore),
            returnValue
        );

        require(
            returnValue == balanceAfter.sub(balanceBefore),
            "swap()'s return value does not match received amount"
        );
    }

    function test_addLiquidity(
        uint256[] calldata amounts,
        uint256 minToMint
        // bytes32[] calldata merkleProof
    ) public {
        uint256 balanceBefore = lpToken.balanceOf(address(this));       // -> 0
/*        console.log(
            "balance before: %s,",
            balanceBefore
        );
*/      
        uint256 returnValue =
            swap.addLiquidity(amounts, minToMint, MAX_INT/*, merkleProof*/);
        uint256 balanceAfter = lpToken.balanceOf(address(this));        // -> 2997459774673651937
/*        console.log(
            "balance after: %s,",
            balanceAfter
        );
*/
        console.log(
            "addLiquidity: Expected %s, got %s",
            balanceAfter.sub(balanceBefore),
            returnValue
        );

        require(
            returnValue == balanceAfter.sub(balanceBefore),
            "addLiquidity()'s return value does not match minted amount"
        );
    }

    function test_removeLiquidity(uint256 amount, uint256[] memory minAmounts)
        public
    {
        uint256[] memory balanceBefore = new uint256[](n);
        uint256[] memory balanceAfter = new uint256[](n);

        for (uint8 i = 0; i < n; i++) {
            balanceBefore[i] = swap.getToken(i).balanceOf(address(this));
        }

        uint256[] memory returnValue =
            swap.removeLiquidity(amount, minAmounts, MAX_INT);

        for (uint8 i = 0; i < n; i++) {
            balanceAfter[i] = swap.getToken(i).balanceOf(address(this));
            console.log(
                "removeLiquidity: Expected %s, got %s",
                balanceAfter[i].sub(balanceBefore[i]),
                returnValue[i]
            );
            require(
                balanceAfter[i].sub(balanceBefore[i]) == returnValue[i],
                "removeLiquidity()'s return value does not match received amounts of tokens"
            );
        }
    }

    function test_removeLiquidityImbalance(
        uint256[] calldata amounts,
        uint256 maxBurnAmount
    ) public {
        uint256 balanceBefore = lpToken.balanceOf(address(this));
        uint256 returnValue =
            swap.removeLiquidityImbalance(amounts, maxBurnAmount, MAX_INT);
        uint256 balanceAfter = lpToken.balanceOf(address(this));

        console.log(
            "removeLiquidityImbalance: Expected %s, got %s",
            balanceBefore.sub(balanceAfter),
            returnValue
        );

        require(
            returnValue == balanceBefore.sub(balanceAfter),
            "removeLiquidityImbalance()'s return value does not match burned lpToken amount"
        );
    }

    function test_removeLiquidityOneToken(
        uint256 tokenAmount,
        uint8 tokenIndex,
        uint256 minAmount
    ) public {
        uint256 balanceBefore =
            swap.getToken(tokenIndex).balanceOf(address(this));
        uint256 returnValue =
            swap.removeLiquidityOneToken(
                tokenAmount,
                tokenIndex,
                minAmount,
                MAX_INT
            );
        uint256 balanceAfter =
            swap.getToken(tokenIndex).balanceOf(address(this));

        console.log(
            "removeLiquidityOneToken: Expected %s, got %s",
            balanceAfter.sub(balanceBefore),
            returnValue
        );

        require(
            returnValue == balanceAfter.sub(balanceBefore),
            "removeLiquidityOneToken()'s return value does not match received token amount"
        );
    }
}
