// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";

contract NftAddTest is Fixture {
    uint256 public baseTokenAmount = 100 * 1e18;
    uint256[] public tokenIds;
    bytes32[][] public proofs;

    function setUp() public {
        deal(address(usd), address(this), baseTokenAmount, true);

        for (uint256 i = 0; i < 5; i++) {
            bayc.mint(address(this), i);
            tokenIds.push(i);
        }

        bayc.setApprovalForAll(address(p), true);
        usd.approve(address(p), type(uint256).max);
    }

    function testItInitMintsLpTokensToSender() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);
        uint256 expectedLpTokenAmount = minLpTokenAmount;

        // act
        uint256 lpTokenAmount = p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(lpToken.balanceOf(address(this)), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(lpToken.totalSupply(), expectedLpTokenAmount, "Should have increased lp supply");
    }

    function testItTransfersBaseTokens() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);
        uint256 balanceBefore = usd.balanceOf(address(this));

        // act
        p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);

        // assert
        uint256 balanceAfter = usd.balanceOf(address(this));
        assertEq(balanceBefore - balanceAfter, baseTokenAmount, "Should transferred base tokens from sender");
        assertEq(usd.balanceOf(address(p)), baseTokenAmount, "Should have transferred base tokens to pair");
    }

    function testItTransfersNfts() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);

        // act
        p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);

        // assert
        for (uint256 i = 0; i < tokenIds.length; i++) {
            assertEq(bayc.ownerOf(i), address(p), "Should have sent bayc to pair");
        }
    }

    function testItRevertsSlippageOnInitMint() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18) + 1; // increase 1 to cause revert

        // act
        vm.expectRevert("Slippage: lp token amount out");
        p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);
    }

    function testItMintsLpTokensAfterInit() public {
        // arrange
        uint256 fractionalTokenAmount = 101 * 1e18;
        deal(address(p), address(this), fractionalTokenAmount, true);
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount); // initial add
        uint256 lpTokenSupplyBefore = lpToken.totalSupply();

        uint256 expectedLpTokenAmount = (lpToken.totalSupply() * tokenIds.length * 1e18) / p.fractionalTokenReserves();
        minLpTokenAmount = 0;
        baseTokenAmount = ((p.baseTokenReserves() + 100) * tokenIds.length * 1e18) / p.fractionalTokenReserves();
        deal(address(usd), babe, baseTokenAmount, true);

        vm.startPrank(babe);
        bayc.setApprovalForAll(address(p), true);
        usd.approve(address(p), type(uint256).max);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = i + tokenIds.length;
            bayc.mint(babe, tokenId);
            tokenIds[i] = tokenId;
        }

        // act
        uint256 lpTokenAmount = p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);
        vm.stopPrank();

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(lpToken.balanceOf(babe), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(lpToken.totalSupply() - lpTokenSupplyBefore, expectedLpTokenAmount, "Should have increased lp supply");
    }

    function testItRevertsSlippageAfterInitMint() public {
        // arrange
        uint256 fractionalTokenAmount = 101 * 1e18;
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);
        deal(address(p), address(this), fractionalTokenAmount, true);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount); // initial add

        minLpTokenAmount = (lpToken.totalSupply() * tokenIds.length * 1e18) / p.fractionalTokenReserves() + 1; // add 1 to cause a revert
        baseTokenAmount = ((p.baseTokenReserves() + 100) * tokenIds.length * 1e18) / p.fractionalTokenReserves();

        // act
        vm.expectRevert("Slippage: lp token amount out");
        p.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);
    }

    function testItAddsWithMerkleProof() public {
        // arrange
        Pair pair = createPairScript.create(address(bayc), address(usd), "YEET-mids.json", address(c));
        proofs = createPairScript.generateMerkleProofs("YEET-mids.json", tokenIds);
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * tokenIds.length * 1e18);
        bayc.setApprovalForAll(address(pair), true);
        usd.approve(address(pair), type(uint256).max);

        // act
        pair.nftAdd(baseTokenAmount, tokenIds, minLpTokenAmount, proofs);

        // assert
        for (uint256 i = 0; i < tokenIds.length; i++) {
            assertEq(bayc.ownerOf(i), address(pair), "Should have sent bayc to pair");
        }
    }
}
