// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import {BaseFixture} from "./BaseFixture.sol";
import {SupplySchedule} from "../SupplySchedule.sol";
import {GlobalAccessControl} from "../GlobalAccessControl.sol";

contract SupplyScheduleTest is BaseFixture {
    function setUp() public override {
        BaseFixture.setUp();
    }

    function testSetMintingStart() public {
        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        schedule.setMintingStart(1000);

        vm.startPrank(governance);

        vm.expectRevert("SupplySchedule: minting must start at or after current time");
        schedule.setMintingStart(block.timestamp-10);

        uint timestamp = block.timestamp + 1000 ; 
        schedule.setMintingStart(timestamp);
        assertEq(schedule.globalStartTimestamp() , timestamp); // check if globalStartTimeStamp is set.

        vm.expectRevert("SupplySchedule: minting already started");
        schedule.setMintingStart(block.timestamp + 1000);
        vm.stopPrank();

        // check if pausing freezes setMintingStart
        vm.prank(guardian);
        gac.pause();
        vm.prank(governance);
        vm.expectRevert(bytes("global-paused"));
        schedule.setMintingStart(block.timestamp + 1000);

    }

    function testSetEpochRate() public{
        uint256 epochLength = schedule.epochLength();
        uint256 epochRate = 514986000000000000000000 / epochLength ;
        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        schedule.setEpochRate(0, epochRate);

        vm.startPrank(governance);

        // initial epochRates are aleady set in initialize function so the transaction should revert.
        vm.expectRevert("SupplySchedule: rate already set for given epoch");
        schedule.setEpochRate(0, epochRate);

        schedule.setEpochRate(7, epochRate);
        assertEq(schedule.epochRate(7) , epochRate); // check if epochRate is set

        vm.stopPrank();

        // check if pausing freezes setEpochRate
        vm.prank(guardian);
        gac.pause();
        vm.prank(governance);
        vm.expectRevert(bytes("global-paused"));
        schedule.setEpochRate(8 , epochRate);

    }

    function testExampleEpochRates() public {
        assertTrue(true);
        emit log("Epoch Rates");
        emit log_uint(schedule.epochRate(0));
        emit log_uint(schedule.epochRate(1));
        emit log_uint(schedule.epochRate(2));
        emit log_uint(schedule.epochRate(3));
        emit log_uint(schedule.epochRate(4));
        emit log_uint(schedule.epochRate(5));
        emit log_uint(schedule.epochRate(6));
    }
}
