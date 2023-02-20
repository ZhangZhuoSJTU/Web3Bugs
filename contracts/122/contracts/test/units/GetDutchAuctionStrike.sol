// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestGetDutchAuctionStrike is Fixture {
    uint32 internal auctionDuration;

    function setUp() public {
        auctionDuration = c.AUCTION_DURATION();
    }

    function testItReturnsStartingStrike() public {
        // arrange
        uint32 auctionEndTimestamp = uint32(block.timestamp + auctionDuration);
        uint256 startingStrike = 100 ether;

        // act
        uint256 strike = c.getDutchAuctionStrike(startingStrike, auctionEndTimestamp, 0);

        // assert
        assertEq(strike, startingStrike, "Strike should be the starting value if no time has passed");
    }

    function testItReturnsMidStrike() public {
        // arrange
        uint32 auctionEndTimestamp = uint32(block.timestamp + auctionDuration / 2);
        uint256 startingStrike = 100 ether;
        uint256 expectedStrike = 25 ether;

        // act
        uint256 strike = c.getDutchAuctionStrike(startingStrike, auctionEndTimestamp, 0);

        // assert
        assertEq(strike, expectedStrike, "Strike should be the mid value if 50% of time has passed");
    }

    function testItReturnsZeroAtEnd() public {
        // arrange
        uint32 auctionEndTimestamp = uint32(block.timestamp);
        uint256 startingStrike = 100 ether;
        uint256 expectedStrike = 0;

        // act
        uint256 strike = c.getDutchAuctionStrike(startingStrike, auctionEndTimestamp, 0);

        // assert
        assertEq(strike, expectedStrike, "Strike should return 0 at end");
    }

    function testItReturnsReserveStrikeIfGreater() public {
        // arrange
        uint32 auctionEndTimestamp = uint32(block.timestamp + auctionDuration / 2);
        uint256 startingStrike = 100 ether;
        uint256 reserveStrike = 30.337 ether;

        // act
        uint256 strike = c.getDutchAuctionStrike(startingStrike, auctionEndTimestamp, reserveStrike);

        // assert
        assertEq(strike, reserveStrike, "Should have returned reserve strike");
    }

    function testItReturnsZeroAfterEnd() public {
        // arrange
        uint32 auctionEndTimestamp = uint32(block.timestamp - 500);
        uint256 startingStrike = 100 ether;
        uint256 expectedStrike = 0;

        // act
        uint256 strike = c.getDutchAuctionStrike(startingStrike, auctionEndTimestamp, 0);

        // assert
        assertEq(strike, expectedStrike, "Strike should return 0 at end");
    }
}
