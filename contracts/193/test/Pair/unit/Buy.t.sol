// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";

contract BuyTest is Fixture {
    event Buy(uint256 inputAmount, uint256 outputAmount);

    uint256 public outputAmount = 0.1e18;
    uint256 public maxInputAmount;

    function setUp() public {
        uint256 baseTokenAmount = 100e18;
        uint256 fractionalTokenAmount = 30.123e18;

        deal(address(usd), address(this), baseTokenAmount, true);
        deal(address(p), address(this), fractionalTokenAmount, true);

        usd.approve(address(p), type(uint256).max);

        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);

        maxInputAmount =
            (outputAmount * p.baseTokenReserves() * 1000) / ((p.fractionalTokenReserves() - outputAmount) * 997);
        deal(address(usd), address(this), maxInputAmount, true);

        deal(address(ethPair), address(this), fractionalTokenAmount, true);
        ethPair.add{value: baseTokenAmount}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItReturnsInputAmount() public {
        // arrange
        uint256 expectedInputAmount = maxInputAmount;

        // act
        uint256 inputAmount = p.buy(outputAmount, maxInputAmount);

        // assert
        assertEq(inputAmount, expectedInputAmount, "Should have returned input amount");
    }

    function testItTransfersBaseTokens() public {
        // arrange
        uint256 balanceBefore = usd.balanceOf(address(p));
        uint256 thisBalanceBefore = usd.balanceOf(address(this));

        // act
        p.buy(outputAmount, maxInputAmount);

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

    function testItTransfersFractionalTokens() public {
        // arrange
        uint256 balanceBefore = p.balanceOf(address(p));
        uint256 thisBalanceBefore = p.balanceOf(address(this));

        // act
        p.buy(outputAmount, maxInputAmount);

        // assert
        assertEq(
            p.balanceOf(address(this)) - thisBalanceBefore,
            outputAmount,
            "Should have transferred fractional tokens from sender"
        );
        assertEq(
            balanceBefore - p.balanceOf(address(p)), outputAmount, "Should have transferred fractional tokens to pair"
        );
    }

    function testItRevertsSlippageOnBuy() public {
        // arrange
        maxInputAmount -= 1; // subtract 1 to cause revert

        // act
        vm.expectRevert("Slippage: amount in");
        p.buy(outputAmount, maxInputAmount);
    }

    function testItRevertsIfValueIsGreaterThanZeroAndBaseTokenIsNot0() public {
        // act
        vm.expectRevert("Invalid ether input");
        p.buy{value: maxInputAmount}(outputAmount, maxInputAmount);
    }

    function testItTransfersEther() public {
        // arrange
        uint256 balanceBefore = address(ethPair).balance;
        uint256 thisBalanceBefore = address(this).balance;

        // act
        ethPair.buy{value: maxInputAmount}(outputAmount, maxInputAmount);

        // assert
        assertEq(address(ethPair).balance - balanceBefore, maxInputAmount, "Should have transferred ether to pair");
        assertEq(thisBalanceBefore - address(this).balance, maxInputAmount, "Should have transferred ether from sender");
    }

    function testItRefundsSurplusEther() public {
        // arrange
        uint256 surplus = 500;
        maxInputAmount += surplus;
        uint256 balanceBefore = address(ethPair).balance;
        uint256 thisBalanceBefore = address(this).balance;

        // act
        ethPair.buy{value: maxInputAmount}(outputAmount, maxInputAmount);

        // assert
        assertEq(
            address(ethPair).balance - balanceBefore, maxInputAmount - surplus, "Should have transferred ether to pair"
        );
        assertEq(
            thisBalanceBefore - address(this).balance,
            maxInputAmount - surplus,
            "Should have transferred ether from sender"
        );
    }

    function testItRevertsIfMaxInputAmountIsNotEqualToValue() public {
        // act
        vm.expectRevert("Invalid ether input");
        ethPair.buy{value: maxInputAmount + 100}(outputAmount, maxInputAmount);
    }

    function testItEmitsBuyEvent() public {
        // act
        vm.expectEmit(true, true, true, true);
        emit Buy(maxInputAmount, outputAmount);
        p.buy(outputAmount, maxInputAmount);
    }
}
