// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import {BaseFixture} from "./BaseFixture.sol";
import {SupplySchedule} from "../SupplySchedule.sol";
import {GlobalAccessControl} from "../GlobalAccessControl.sol";

contract MintAndDistributeTest is BaseFixture {
    function setUp() public override {
        BaseFixture.setUp();
    }

    function testMintAndDistribute() public {
        /*
            Flow:
            - policy ops pings minter with the proportions to go to funding, locking, staking (decided off-chain for now)
            - this can be called at any frequency (not sure on rounding impact at very fast rate such as per-block)
                - we could set a max frequency by governance when we move to permissionless here
            - minted amount should match from epoch data
            - should handle the case at the border of two epochs gracefully
            - if there is an undefined epoch, it should fail until that epoch is defined. 
                -  after this is corrected, it should mint as expected from last mint as if that data had been there.
            - the assets should end up in the proper places in the expected proprotions
                - xCitadel balance and ppfs going up
                - vlCitadel rewards data changing as expected
                - various funding contracts funding in expected proportions
                - test a few cases for adding and removing funding contracts

            There unfortunately is the daily manual step of the initial mint destination propotions, we can automate this via contract with some work and oracles.
        */

        assertTrue(address(citadelMinter.supplySchedule()) == address(schedule));

        uint fundingBps = 4000;
        uint stakingBps = 3000;
        uint lockingBps = 3000;
        uint MAX_BPS = 10000;

        uint wbtcFundingPoolWeight = 8000;
        uint cvxFundingPoolWeight = 2000;
        uint expectedTotalPoolWeight = 10000;

        vm.startPrank(policyOps);
        citadelMinter.setCitadelDistributionSplit(fundingBps,stakingBps,lockingBps);
        // confirm only policy ops can call
        // bps between three positions must add up to 10000 (100%)

        // can't mint before start
        assertTrue(schedule.globalStartTimestamp() == 0);
        vm.expectRevert("SupplySchedule: minting not started");
        citadelMinter.mintAndDistribute();
        
        // policy ops should not be able to start minting schedule
        vm.expectRevert("GAC: invalid-caller-role");
        schedule.setMintingStart(block.timestamp);
        assertTrue(schedule.globalStartTimestamp() == 0);

        vm.stopPrank();
        vm.prank(governance);
        schedule.setMintingStart(block.timestamp);

        vm.prank(governance);
        citadelMinter.initializeLastMintTimestamp();
        assertTrue(schedule.globalStartTimestamp() == block.timestamp);

        vm.startPrank(policyOps);

        vm.expectRevert("SupplySchedule: already minted up to current block");
        citadelMinter.mintAndDistribute();

        vm.warp(block.timestamp + 1000);

        // can't mint without funding pools setup
        vm.expectRevert("CitadelMinter: no funding pools");
        citadelMinter.mintAndDistribute();

        citadelMinter.setFundingPoolWeight(address(fundingWbtc), wbtcFundingPoolWeight);
        citadelMinter.setFundingPoolWeight(address(fundingCvx), cvxFundingPoolWeight);

        comparator.snapPrev();
        uint expectedMint = schedule.getMintable(citadelMinter.lastMintTimestamp());

        citadelMinter.mintAndDistribute();

        comparator.snapCurr();

        // funding pools should recieve based on funding bps and pool weights
        uint expectedToFunding = expectedMint * fundingBps / MAX_BPS;

        uint totalPoolWeight = citadelMinter.totalFundingPoolWeight();
        assertTrue(totalPoolWeight == expectedTotalPoolWeight);

        uint expectedToWbtcFunding = expectedToFunding * wbtcFundingPoolWeight / totalPoolWeight;
        assertEq(comparator.diff("citadel.balanceOf(fundingWbtc)"), expectedToWbtcFunding);

        uint expectedToCvxFunding = expectedToFunding * cvxFundingPoolWeight / totalPoolWeight;
        assertEq(comparator.diff("citadel.balanceOf(fundingCvx)"), expectedToCvxFunding);

        // staking ppfs should increase based on staking bps
        uint expectedToStakers = expectedMint * stakingBps / MAX_BPS;

        emit log_named_uint("xCitadel ppfs before", comparator.prev("xCitadel.getPricePerFullShare()"));
        emit log_named_uint("xCitadel ppfs after", comparator.curr("xCitadel.getPricePerFullShare()"));
        emit log_named_uint("change in xCitadel ppfs", comparator.diff("xCitadel.getPricePerFullShare()"));

        emit log_named_uint("xCitadel total supply before", comparator.prev("xCitadel.totalSupply()"));
        emit log_named_uint("xCitadel total supply after", comparator.curr("xCitadel.totalSupply()"));
        emit log_named_uint("xCitadel change in supply", comparator.diff("xCitadel.totalSupply()"));

        // locking reward schedule should modulate based on locking bps
        uint expectedToLockers = expectedMint * stakingBps / MAX_BPS;

        vm.stopPrank();
    }
}
