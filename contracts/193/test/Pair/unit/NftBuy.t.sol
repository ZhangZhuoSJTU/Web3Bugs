// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";

contract NftBuyTest is Fixture {
    uint256 public outputAmount;
    uint256 public maxInputAmount;
    uint256[] public tokenIds;
    bytes32[][] public proofs;

    function setUp() public {
        for (uint256 i = 0; i < 5; i++) {
            bayc.mint(address(this), i);
            tokenIds.push(i);
        }

        bayc.setApprovalForAll(address(p), true);
        usd.approve(address(p), type(uint256).max);

        uint256 baseTokenAmount = 3.15e18;
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);
        deal(address(usd), address(this), baseTokenAmount, true);
        p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);

        tokenIds.pop();
        tokenIds.pop();
        outputAmount = tokenIds.length * 1e18;
        maxInputAmount =
            (outputAmount * p.baseTokenReserves() * 1000) / ((p.fractionalTokenReserves() - outputAmount) * 997);
        deal(address(usd), address(this), maxInputAmount, true);
    }

    function testItReturnsInputAmount() public {
        // arrange
        uint256 expectedInputAmount = maxInputAmount;

        // act
        uint256 inputAmount = p.nftBuy(tokenIds, maxInputAmount);

        // assert
        assertEq(inputAmount, expectedInputAmount, "Should have returned input amount");
    }

    function testItTransfersBaseTokens() public {
        // arrange
        uint256 balanceBefore = usd.balanceOf(address(p));
        uint256 thisBalanceBefore = usd.balanceOf(address(this));

        // act
        p.nftBuy(tokenIds, maxInputAmount);

        // assert
        assertEq(
            usd.balanceOf(address(p)) - balanceBefore, maxInputAmount, "Should have transferred base tokens to pair"
        );
        assertEq(
            thisBalanceBefore - usd.balanceOf(address(this)),
            maxInputAmount,
            "Should have transferred base tokens from sender"
        );
    }

    function testItTransfersNfts() public {
        // act
        p.nftBuy(tokenIds, maxInputAmount);

        // assert
        for (uint256 i = 0; i < tokenIds.length; i++) {
            assertEq(bayc.ownerOf(i), address(this), "Should have sent bayc to sender");
        }
    }

    function testItRevertsSlippageOnBuy() public {
        // arrange
        maxInputAmount -= 1; // subtract 1 to cause revert

        // act
        vm.expectRevert("Slippage: amount in");
        p.nftBuy(tokenIds, maxInputAmount);
    }

    function testItBurnsFractionalTokens() public {
        // arrange
        uint256 totalSupplyBefore = p.totalSupply();

        // act
        p.nftBuy(tokenIds, maxInputAmount);

        // assert
        assertEq(totalSupplyBefore - p.totalSupply(), tokenIds.length * 1e18, "Should have burned fractional tokens");
    }
}
