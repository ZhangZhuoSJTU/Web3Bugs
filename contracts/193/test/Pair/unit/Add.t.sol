// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";
import "../../../script/CreatePair.s.sol";

contract AddTest is Fixture {
    event Add(uint256 baseTokenAmount, uint256 fractionalTokenAmount, uint256 lpTokenAmount);

    uint256 public baseTokenAmount = 100;
    uint256 public fractionalTokenAmount = 30;

    function setUp() public {
        deal(address(usd), address(this), baseTokenAmount, true);
        deal(address(p), address(this), fractionalTokenAmount, true);
        deal(address(ethPair), address(this), fractionalTokenAmount, true);

        usd.approve(address(p), type(uint256).max);
    }

    function testItInitMintsLpTokensToSender() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        uint256 expectedLpTokenAmount = minLpTokenAmount;

        // act
        uint256 lpTokenAmount = p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(lpToken.balanceOf(address(this)), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(lpToken.totalSupply(), expectedLpTokenAmount, "Should have increased lp supply");
    }

    function testItTransfersBaseTokens() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        uint256 balanceBefore = usd.balanceOf(address(this));

        // act
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);

        // assert
        uint256 balanceAfter = usd.balanceOf(address(this));
        assertEq(balanceBefore - balanceAfter, baseTokenAmount, "Should transferred base tokens from sender");
        assertEq(usd.balanceOf(address(p)), baseTokenAmount, "Should have transferred base tokens to pair");
    }

    function testItTransfersFractionalTokens() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        uint256 balanceBefore = p.balanceOf(address(this));

        // act
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);

        // assert
        assertEq(p.balanceOf(address(p)), fractionalTokenAmount, "Should have transferred fractional tokens to pair");
        assertEq(
            balanceBefore - p.balanceOf(address(this)),
            fractionalTokenAmount,
            "Should transferred fractional tokens from sender"
        );
    }

    function testItRevertsSlippageOnInitMint() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount) + 1; // increase 1 to cause revert

        // act
        vm.expectRevert("Slippage: lp token amount out");
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItMintsLpTokensAfterInit() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount); // initial add
        uint256 lpTokenSupplyBefore = lpToken.totalSupply();

        uint256 expectedLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount) * 17;
        minLpTokenAmount = expectedLpTokenAmount;
        baseTokenAmount = baseTokenAmount * 17;
        fractionalTokenAmount = fractionalTokenAmount * 17;
        deal(address(usd), babe, baseTokenAmount, true);
        deal(address(p), babe, fractionalTokenAmount, true);

        // act
        vm.startPrank(babe);
        usd.approve(address(p), type(uint256).max);
        uint256 lpTokenAmount = p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
        vm.stopPrank();

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(lpToken.balanceOf(babe), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(lpToken.totalSupply() - lpTokenSupplyBefore, expectedLpTokenAmount, "Should have increased lp supply");
    }

    function testItRevertsSlippageAfterInitMint() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount); // initial add

        minLpTokenAmount = (baseTokenAmount * fractionalTokenAmount * 17) + 1; // add 1 to cause a revert
        baseTokenAmount = baseTokenAmount * 17;
        fractionalTokenAmount = fractionalTokenAmount * 17;

        // act
        vm.expectRevert("Slippage: lp token amount out");
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItRevertsIfValueIsNot0AndBaseTokenIsNot0() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount * 17);
        baseTokenAmount = baseTokenAmount * 17;
        fractionalTokenAmount = fractionalTokenAmount * 17;

        // act
        vm.expectRevert("Invalid ether input");
        p.add{value: 0.1 ether}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItRevertsIfValueDoesNotMatchBaseTokenAmount() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount * 17);
        baseTokenAmount = baseTokenAmount * 17;
        fractionalTokenAmount = fractionalTokenAmount * 17;

        // act
        vm.expectRevert("Invalid ether input");
        ethPair.add{value: baseTokenAmount - 1}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItTransfersEther() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        uint256 balanceBefore = address(this).balance;

        // act
        ethPair.add{value: baseTokenAmount}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);

        // assert
        uint256 balanceAfter = address(this).balance;
        assertEq(balanceBefore - balanceAfter, baseTokenAmount, "Should transferred ether from sender");
        assertEq(address(ethPair).balance, baseTokenAmount, "Should have transferred ether to pair");
    }

    function testItMintsLpTokensAfterInitWithEther() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        ethPair.add{value: baseTokenAmount}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount); // initial add
        uint256 lpTokenSupplyBefore = ethPairLpToken.totalSupply();

        uint256 expectedLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount) * 17;
        minLpTokenAmount = expectedLpTokenAmount;
        baseTokenAmount = baseTokenAmount * 17;
        fractionalTokenAmount = fractionalTokenAmount * 17;
        deal(address(ethPair), babe, fractionalTokenAmount, true);

        // act
        vm.startPrank(babe);
        deal(babe, baseTokenAmount);
        uint256 lpTokenAmount =
            ethPair.add{value: baseTokenAmount}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
        vm.stopPrank();

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(ethPairLpToken.balanceOf(babe), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(
            ethPairLpToken.totalSupply() - lpTokenSupplyBefore, expectedLpTokenAmount, "Should have increased lp supply"
        );
    }

    function testItEmitsAddEvent() public {
        // arrange
        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);

        // act
        vm.expectEmit(true, true, true, true);
        emit Add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItRevertsIfAmountIsZero() public {
        // act
        vm.expectRevert("Input token amount is zero");
        p.add(0, fractionalTokenAmount, 0);

        vm.expectRevert("Input token amount is zero");
        p.add(baseTokenAmount, 0, 0);
    }

    function testItInitMintsLpTokensToSender(uint256 _baseTokenAmount, uint256 _fractionalTokenAmount) public {
        // arrange
        _baseTokenAmount = bound(_baseTokenAmount, 1, type(uint128).max);
        _fractionalTokenAmount = bound(_fractionalTokenAmount, 1, 100_000_000 * 1e18);
        deal(address(usd), address(this), _baseTokenAmount, true);
        deal(address(p), address(this), _fractionalTokenAmount, true);
        uint256 minLpTokenAmount = Math.sqrt(_baseTokenAmount * _fractionalTokenAmount);
        uint256 expectedLpTokenAmount = minLpTokenAmount;

        // act
        uint256 lpTokenAmount = p.add(_baseTokenAmount, _fractionalTokenAmount, minLpTokenAmount);

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(lpToken.balanceOf(address(this)), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(lpToken.totalSupply(), expectedLpTokenAmount, "Should have increased lp supply");
    }

    function testItMintsLpTokensAfterInit(uint256 _initBaseTokenAmount, uint256 _initFractionalTokenAmount) public {
        // arrange
        _initBaseTokenAmount = bound(_initBaseTokenAmount, 1, type(uint128).max);
        _initFractionalTokenAmount = bound(_initFractionalTokenAmount, 1, 100_000_000 * 1e18);
        deal(address(usd), address(this), _initBaseTokenAmount, true);
        deal(address(p), address(this), _initFractionalTokenAmount, true);
        uint256 initMinLpTokenAmount = Math.sqrt(_initBaseTokenAmount * _initFractionalTokenAmount);
        p.add(_initBaseTokenAmount, _initFractionalTokenAmount, initMinLpTokenAmount); // initial add
        uint256 lpTokenSupplyBefore = lpToken.totalSupply();

        uint256 expectedLpTokenAmount = Math.sqrt(_initBaseTokenAmount * _initFractionalTokenAmount) * 17;
        uint256 minLpTokenAmount = expectedLpTokenAmount;
        baseTokenAmount = _initBaseTokenAmount * 17;
        fractionalTokenAmount = _initFractionalTokenAmount * 17;
        deal(address(usd), babe, baseTokenAmount, true);
        deal(address(p), babe, fractionalTokenAmount, true);

        // act
        vm.startPrank(babe);
        usd.approve(address(p), type(uint256).max);
        uint256 lpTokenAmount = p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
        vm.stopPrank();

        // assert
        assertEq(lpTokenAmount, expectedLpTokenAmount, "Should have returned correct lp token amount");
        assertEq(lpToken.balanceOf(babe), expectedLpTokenAmount, "Should have minted lp tokens");
        assertEq(lpToken.totalSupply() - lpTokenSupplyBefore, expectedLpTokenAmount, "Should have increased lp supply");
    }
}
