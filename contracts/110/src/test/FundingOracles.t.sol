// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import {BaseFixture} from "./BaseFixture.sol";
import {SupplySchedule} from "../SupplySchedule.sol";
import {GlobalAccessControl} from "../GlobalAccessControl.sol";

contract SetupAndKnightingRoundTest is BaseFixture {
    function setUp() public override {
        BaseFixture.setUp();
    }

    function testFundingOraclesFlow() public {
        /*
            - update CTDL/USD
            - update ASSET/USD
            - update xCTDL/CTDL
            - permissions
            - swap oracle addresses
        */
    }
}