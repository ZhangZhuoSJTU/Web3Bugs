// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../../shared/Fixture.t.sol";
import "../../../src/Caviar.sol";

contract CloseTest is Fixture {
    event Close(uint256 closeTimestamp);
    event Withdraw(uint256 tokenId);

    uint256[] public tokenIds;

    function setUp() public {
        bayc.setApprovalForAll(address(p), true);

        for (uint256 i = 0; i < 5; i++) {
            bayc.mint(address(this), i);
            tokenIds.push(i);
        }
    }

    function testExitSetsCloseTimestamp() public {
        // arrange
        uint256 expectedCloseTimestamp = block.timestamp + 7 days;

        // act
        p.close();

        // assert
        assertEq(p.closeTimestamp(), expectedCloseTimestamp, "Should have set close timestamp");
    }

    function testCannotExitIfNotAdmin() public {
        // act
        vm.prank(address(0xbabe));
        vm.expectRevert("Close: not owner");
        p.close();

        // assert
        assertEq(p.closeTimestamp(), 0, "Should not have set close timestamp");
    }

    function testCannotWithdrawIfNotAdmin() public {
        // arrange
        p.close();

        // act
        vm.prank(address(0xbabe));
        vm.expectRevert("Withdraw: not owner");
        p.withdraw(1);
    }

    function testCannotWithdrawIfNotClosed() public {
        // act
        vm.expectRevert("Withdraw not initiated");
        p.withdraw(1);
    }

    function testCannotWithdrawIfNotEnoughTimeElapsed() public {
        // arrange
        p.close();

        // act
        vm.expectRevert("Not withdrawable yet");
        p.withdraw(1);
    }

    function testItTransfersNftsAfterWithdraw() public {
        // arrange
        p.close();
        skip(7 days);
        uint256 tokenId = 1;
        bayc.transferFrom(address(this), address(p), tokenId);

        // act
        p.withdraw(tokenId);

        // assert
        assertEq(bayc.ownerOf(tokenId), address(this), "Should have sent bayc to sender");
    }

    function testItEmitsCloseEvent() public {
        // act
        vm.expectEmit(true, true, true, true);
        emit Close(block.timestamp + 7 days);
        p.close();
    }

    function testItEmitsWithdrawEvent() public {
        // arrange
        p.close();
        skip(7 days);
        uint256 tokenId = 1;
        bayc.transferFrom(address(this), address(p), tokenId);

        // act
        vm.expectEmit(true, true, true, true);
        emit Withdraw(tokenId);
        p.withdraw(tokenId);
    }
}
