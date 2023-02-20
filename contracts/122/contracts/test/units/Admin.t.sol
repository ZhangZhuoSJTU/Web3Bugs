// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestAdmin is Test, Fixture {
    function testItSetsFee() public {
        // arrange
        uint256 newFeeRate = 1000;

        // act
        c.setFee(newFeeRate);
        uint256 feeRate = c.feeRate();

        // assert
        assertEq(feeRate, newFeeRate, "Should have set fee rate");
    }

    function testItCannotLetNonAdminSetFee() public {
        // arrange
        vm.prank(babe);

        // act
        vm.expectRevert("Ownable: caller is not the owner");
        c.setFee(1000);
    }

    function testCannotLetNonAdminWithdrawProtocolFees() public {
        // arrange
        vm.prank(babe);

        // act
        vm.expectRevert("Ownable: caller is not the owner");
        c.withdrawProtocolFees();
    }
}
