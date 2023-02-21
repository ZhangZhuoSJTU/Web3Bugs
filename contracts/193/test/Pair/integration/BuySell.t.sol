// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";

contract BuySellTest is Fixture {
    function setUp() public {
        uint256 baseTokenAmount = 100e18;
        uint256 fractionalTokenAmount = 100e18;

        deal(address(usd), address(this), baseTokenAmount, true);
        deal(address(p), address(this), fractionalTokenAmount, true);

        usd.approve(address(p), type(uint256).max);

        uint256 minLpTokenAmount = Math.sqrt(baseTokenAmount * fractionalTokenAmount);
        p.add(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);

        deal(address(ethPair), address(this), fractionalTokenAmount, true);
        ethPair.add{value: baseTokenAmount}(baseTokenAmount, fractionalTokenAmount, minLpTokenAmount);
    }

    function testItBuysSellsEqualAmounts(uint256 outputAmount) public {
        outputAmount = bound(outputAmount, 1e2, p.fractionalTokenReserves() - 1e18);
        uint256 maxInputAmount =
            (outputAmount * p.baseTokenReserves() * 1000) / ((p.fractionalTokenReserves() - outputAmount) * 997);
        deal(address(usd), address(this), maxInputAmount, true);

        // act
        p.buy(outputAmount, maxInputAmount);
        p.sell(outputAmount, 0);

        // assert
        assertApproxEqAbs(
            usd.balanceOf(address(this)),
            maxInputAmount,
            maxInputAmount - (((maxInputAmount * 997) / 1000) * 997) / 1000, // allow margin of error for approx. fee amount
            "Should have bought and sold equal amounts of assets"
        );

        assertGt(
            maxInputAmount, usd.balanceOf(address(this)), "Should have less usd than starting with because of fees"
        );
    }
}
