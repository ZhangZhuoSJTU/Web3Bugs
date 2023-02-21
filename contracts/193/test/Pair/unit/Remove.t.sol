// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";

contract RemoveTest is Fixture {
    event Remove(uint256 baseTokenAmount, uint256 fractionalTokenAmount, uint256 lpTokenAmount);

    uint256 public totalBaseTokenAmount = 100;
    uint256 public totalFractionalTokenAmount = 30;
    uint256 public totalLpTokenAmount;

    function setUp() public {
        deal(address(usd), address(this), totalBaseTokenAmount, true);
        deal(address(p), address(this), totalFractionalTokenAmount, true);

        usd.approve(address(p), type(uint256).max);

        uint256 minLpTokenAmount = Math.sqrt(totalBaseTokenAmount * totalFractionalTokenAmount);
        totalLpTokenAmount = p.add(totalBaseTokenAmount, totalFractionalTokenAmount, minLpTokenAmount);

        deal(address(ethPair), address(this), totalFractionalTokenAmount, true);
        ethPair.add{value: totalBaseTokenAmount}(totalBaseTokenAmount, totalFractionalTokenAmount, minLpTokenAmount);
    }

    function testItReturnsBaseTokenAmountAndFractionalTokenAmount() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 expectedBaseTokenAmount = totalBaseTokenAmount / 2;
        uint256 expectedFractionalTokenAmount = totalFractionalTokenAmount / 2;

        // act
        (uint256 baseTokenAmount, uint256 fractionalTokenAmount) =
            p.remove(lpTokenAmount, expectedBaseTokenAmount, expectedFractionalTokenAmount);

        // assert
        assertEq(baseTokenAmount, expectedBaseTokenAmount, "Should have returned correct base token amount");
        assertEq(
            fractionalTokenAmount, expectedFractionalTokenAmount, "Should have returned correct fractional token amount"
        );
    }

    function testItBurnsLpTokens() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 minBaseTokenOutputAmount = totalBaseTokenAmount / 2;
        uint256 minFractionalTokenOutputAmount = totalFractionalTokenAmount / 2;
        uint256 balanceBefore = lpToken.balanceOf(address(this));
        uint256 totalSupplyBefore = lpToken.totalSupply();

        // act
        p.remove(lpTokenAmount, minBaseTokenOutputAmount, minFractionalTokenOutputAmount);

        // assert
        assertEq(
            balanceBefore - lpToken.balanceOf(address(this)), lpTokenAmount, "Should have burned lp tokens from sender"
        );
        assertEq(totalSupplyBefore - lpToken.totalSupply(), lpTokenAmount, "Should have burned lp tokens");
    }

    function testItTransfersBaseTokens() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 minBaseTokenOutputAmount = totalBaseTokenAmount / 2;
        uint256 minFractionalTokenOutputAmount = totalFractionalTokenAmount / 2;
        uint256 thisBalanceBefore = usd.balanceOf(address(this));
        uint256 balanceBefore = usd.balanceOf(address(p));

        // act
        p.remove(lpTokenAmount, minBaseTokenOutputAmount, minFractionalTokenOutputAmount);

        // assert
        assertEq(
            usd.balanceOf(address(this)) - thisBalanceBefore,
            minBaseTokenOutputAmount,
            "Should have transferred base tokens to sender"
        );

        assertEq(
            balanceBefore - usd.balanceOf(address(p)),
            minBaseTokenOutputAmount,
            "Should have transferred base tokens from pair"
        );
    }

    function testItTransfersFractionalTokens() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 minBaseTokenOutputAmount = totalBaseTokenAmount / 2;
        uint256 minFractionalTokenOutputAmount = totalFractionalTokenAmount / 2;
        uint256 thisBalanceBefore = p.balanceOf(address(this));
        uint256 balanceBefore = p.balanceOf(address(p));

        // act
        p.remove(lpTokenAmount, minBaseTokenOutputAmount, minFractionalTokenOutputAmount);

        // assert
        assertEq(
            p.balanceOf(address(this)) - thisBalanceBefore,
            minFractionalTokenOutputAmount,
            "Should have transferred fractionall tokens to sender"
        );

        assertEq(
            balanceBefore - p.balanceOf(address(p)),
            minFractionalTokenOutputAmount,
            "Should have transferred fractional tokens from pair"
        );
    }

    function testItRevertsFractionalTokenSlippage() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 minBaseTokenOutputAmount = totalBaseTokenAmount / 2;
        uint256 minFractionalTokenOutputAmount = totalFractionalTokenAmount / 2 + 1; // add 1 to cause revert

        // act
        vm.expectRevert("Slippage: fractional token out");
        p.remove(lpTokenAmount, minBaseTokenOutputAmount, minFractionalTokenOutputAmount);
    }

    function testItRevertsBaseTokenSlippage() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 minBaseTokenOutputAmount = totalBaseTokenAmount / 2 + 1; // add 1 to cause revert
        uint256 minFractionalTokenOutputAmount = totalFractionalTokenAmount / 2;

        // act
        vm.expectRevert("Slippage: base token amount out");
        p.remove(lpTokenAmount, minBaseTokenOutputAmount, minFractionalTokenOutputAmount);
    }

    function testItTransfersEther() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 minBaseTokenOutputAmount = totalBaseTokenAmount / 2;
        uint256 minFractionalTokenOutputAmount = totalFractionalTokenAmount / 2;
        uint256 thisBalanceBefore = address(this).balance;
        uint256 balanceBefore = address(ethPair).balance;

        // act
        ethPair.remove(lpTokenAmount, minBaseTokenOutputAmount, minFractionalTokenOutputAmount);

        // assert
        assertEq(
            address(this).balance - thisBalanceBefore,
            minBaseTokenOutputAmount,
            "Should have transferred ether to sender"
        );

        assertEq(
            balanceBefore - address(ethPair).balance,
            minBaseTokenOutputAmount,
            "Should have transferred ether from pair"
        );
    }

    function testItEmitsRemoveEvent() public {
        // arrange
        uint256 lpTokenAmount = totalLpTokenAmount / 2;
        uint256 expectedBaseTokenAmount = totalBaseTokenAmount / 2;
        uint256 expectedFractionalTokenAmount = totalFractionalTokenAmount / 2;

        // act
        vm.expectEmit(true, true, true, true);
        emit Remove(expectedBaseTokenAmount, expectedFractionalTokenAmount, lpTokenAmount);
        p.remove(lpTokenAmount, expectedBaseTokenAmount, expectedFractionalTokenAmount);
    }

    function testItReturnsBaseTokenAmountAndFractionalTokenAmount(uint256 fractionToRemove) public {
        // arrange
        fractionToRemove = bound(fractionToRemove, 0, 1e18);
        uint256 lpTokenAmount = totalLpTokenAmount * fractionToRemove / 1e18;
        uint256 expectedBaseTokenAmount = totalBaseTokenAmount * lpTokenAmount / lpToken.totalSupply();
        uint256 expectedFractionalTokenAmount = totalFractionalTokenAmount * lpTokenAmount / lpToken.totalSupply();

        // act
        (uint256 baseTokenAmount, uint256 fractionalTokenAmount) =
            p.remove(lpTokenAmount, expectedBaseTokenAmount, expectedFractionalTokenAmount);

        // assert
        assertEq(baseTokenAmount, expectedBaseTokenAmount, "Should have returned correct base token amount");
        assertEq(
            fractionalTokenAmount, expectedFractionalTokenAmount, "Should have returned correct fractional token amount"
        );
    }
}
