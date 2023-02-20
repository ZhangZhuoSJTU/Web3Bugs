// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import {BaseFixture} from "./BaseFixture.sol";
import {SupplySchedule} from "../SupplySchedule.sol";
import {GlobalAccessControl} from "../GlobalAccessControl.sol";
import {Funding} from "../Funding.sol";
import {CitadelMinter} from "../CitadelMinter.sol";

contract MintingTest is BaseFixture {
    function setUp() public override {
        BaseFixture.setUp();
    }

    function testSetCitadelDistributionSplit() public{
        vm.expectRevert("GAC: invalid-caller-role");
        citadelMinter.setCitadelDistributionSplit(5000, 3000, 2000);

        vm.startPrank(policyOps);
        vm.expectRevert("CitadelMinter: Sum of propvalues must be 10000 bps");
        citadelMinter.setCitadelDistributionSplit(5000, 2000, 2000);

        citadelMinter.setCitadelDistributionSplit(5000, 3000, 2000);
        // check if distribution split is set.
        assertEq(citadelMinter.fundingBps(),5000);
        assertEq(citadelMinter.stakingBps(),3000);
        assertEq(citadelMinter.lockingBps(),2000);

        vm.stopPrank();

        // pausing should freeze setCitadelDistributionSplit
        vm.prank(guardian);
        gac.pause();
        vm.prank(address(policyOps));
        vm.expectRevert(bytes("global-paused"));
        citadelMinter.setCitadelDistributionSplit(5000, 3000, 2000);

    }

    function testSetFundingPoolWeight() public{
        _testSetFundingPoolWeight(address(fundingCvx), 8000);
        _testSetFundingPoolWeight(address(fundingWbtc), 2000);

        // check if totalFundingPoolWeight is updated
        assertEq(citadelMinter.totalFundingPoolWeight(), 10000);

        // check if weight is more than MAX_BPS
        _testSetFundingPoolWeight(address(fundingCvx), 11000);

    }

    function _testSetFundingPoolWeight(address fundingPool, uint256 weight) public{
        vm.stopPrank();
        vm.expectRevert("GAC: invalid-caller-role");
        citadelMinter.setFundingPoolWeight(fundingPool, weight);

        vm.startPrank(policyOps);
        if(weight > 10000){
            vm.expectRevert("exceed max funding pool weight");
            citadelMinter.setFundingPoolWeight(fundingPool , weight);
        }
        else{
            citadelMinter.setFundingPoolWeight(fundingPool , weight);
            assertEq(citadelMinter.fundingPoolWeights(fundingPool), weight);
        }
        vm.stopPrank();
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
