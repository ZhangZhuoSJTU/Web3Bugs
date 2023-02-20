// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Vm} from "./../utils/Vm.sol";
import {DSTest} from "./../utils/DSTest.sol";
import {getCore, getAddresses, FeiTestAddresses} from "./../utils/Fixtures.sol";
import {MockScalingPriceOracle} from "../../../mock/MockScalingPriceOracle.sol";
import {Decimal} from "./../../../external/Decimal.sol";

contract ScalingPriceOracleTest is DSTest {
    using Decimal for Decimal.D256;

    MockScalingPriceOracle private scalingPriceOracle;

    /// @notice increase price by 3.09% per month
    int256 public constant monthlyChangeRateBasisPoints = 309;

    /// @notice the current month's CPI data
    uint128 public constant currentMonth = 270000;

    /// @notice the previous month's CPI data
    uint128 public constant previousMonth = 261900;

    /// @notice address of chainlink oracle to send request
    address public immutable oracle = address(0);

    /// @notice job id that retrieves the latest CPI data
    bytes32 public immutable jobId =
        keccak256(abi.encodePacked("Chainlink CPI-U job"));

    /// @notice fee of 10 link
    uint256 public immutable fee = 1e19;

    Vm public constant vm = Vm(HEVM_ADDRESS);
    FeiTestAddresses public addresses = getAddresses();

    function setUp() public {
        /// warp to 1 to set isTimeStarted to true
        vm.warp(1);

        scalingPriceOracle = new MockScalingPriceOracle(
            oracle,
            jobId,
            fee,
            currentMonth,
            previousMonth
        );
    }

    function testSetup() public {
        assertEq(scalingPriceOracle.oracle(), oracle);
        assertEq(scalingPriceOracle.jobId(), jobId);
        assertEq(scalingPriceOracle.fee(), fee);
        assertEq(scalingPriceOracle.currentMonth(), currentMonth);
        assertEq(scalingPriceOracle.previousMonth(), previousMonth);
        assertEq(
            scalingPriceOracle.getMonthlyAPR(),
            monthlyChangeRateBasisPoints
        );
    }

    /// positive price action from oracle -- inflation case
    function testReadGetCurrentOraclePriceAfterInterpolation() public {
        vm.warp(block.timestamp + 28 days);
        assertEq(10309e14, scalingPriceOracle.getCurrentOraclePrice());
    }

    /// negative price action from oracle -- deflation case
    function testPriceDecreaseAfterInterpolation() public {
        scalingPriceOracle = new MockScalingPriceOracle(
            oracle,
            jobId,
            fee,
            previousMonth, /// flip current and previous months so that rate is -3%
            currentMonth
        );

        vm.warp(block.timestamp + 28 days);
        assertEq(97e16, scalingPriceOracle.getCurrentOraclePrice());
    }

    function testFulfillFailureTimed() public {
        assertTrue(!scalingPriceOracle.isTimeEnded());

        vm.expectRevert(bytes("Timed: time not ended, init"));

        scalingPriceOracle.requestCPIData();
    }

    function testFulfillMaxDeviationExceededFailureUp() public {
        vm.expectRevert(
            bytes(
                "ScalingPriceOracle: Chainlink data outside of deviation threshold"
            )
        );

        /// this will fail as it is 21% inflation and max allowable is 20%
        scalingPriceOracle.fulfill((currentMonth * 121) / 100);
    }

    function testFulfillMaxDeviationExceededFailureDown() public {
        vm.expectRevert(
            bytes(
                "ScalingPriceOracle: Chainlink data outside of deviation threshold"
            )
        );

        /// this will fail as it is 21% inflation and max allowable is 20%
        scalingPriceOracle.fulfill((currentMonth * 79) / 100);
    }

    function testFulfillSucceedsTwentyPercent() public {
        uint256 storedCurrentMonth = scalingPriceOracle.currentMonth();
        uint256 newCurrentMonth = (currentMonth * 120) / 100;

        /// this will succeed as max allowable is 20%
        scalingPriceOracle.fulfill(newCurrentMonth);

        assertEq(scalingPriceOracle.monthlyChangeRateBasisPoints(), 2_000);
        /// assert that all state transitions were done correctly with current and previous month
        assertEq(scalingPriceOracle.previousMonth(), storedCurrentMonth);
        assertEq(scalingPriceOracle.currentMonth(), newCurrentMonth);
    }

    function testFulfillFailureCalendar() public {
        vm.warp(block.timestamp + 1647240109);

        vm.expectRevert(
            bytes("ScalingPriceOracle: cannot request data before the 15th")
        );

        scalingPriceOracle.requestCPIData();
    }
}
