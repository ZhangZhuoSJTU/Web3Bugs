// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Vm} from "./../utils/Vm.sol";
import {DSTest} from "./../utils/DSTest.sol";
import {getCore, getAddresses, FeiTestAddresses} from "./../utils/Fixtures.sol";
import {MockScalingPriceOracle} from "../../../mock/MockScalingPriceOracle.sol";
import {OraclePassThrough} from "../../../oracle/OraclePassThrough.sol";
import {ScalingPriceOracle} from "../../../oracle/ScalingPriceOracle.sol";
import {Decimal} from "./../../../external/Decimal.sol";

contract OraclePassThroughTest is DSTest {
    using Decimal for Decimal.D256;

    MockScalingPriceOracle private scalingPriceOracle;

    OraclePassThrough private oraclePassThrough;

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

        oraclePassThrough = new OraclePassThrough(
            ScalingPriceOracle(address(scalingPriceOracle))
        );
    }

    function testSetup() public {
        assertEq(
            address(oraclePassThrough.scalingPriceOracle()),
            address(scalingPriceOracle)
        );
        assertEq(oraclePassThrough.owner(), address(this));
    }

    function testDataPassThroughSync() public {
        assertEq(
            oraclePassThrough.getCurrentOraclePrice(),
            scalingPriceOracle.getCurrentOraclePrice()
        );

        (Decimal.D256 memory oPrice, bool oValid) = oraclePassThrough.read();
        assertEq(oPrice.value, scalingPriceOracle.getCurrentOraclePrice());
        assertTrue(oValid);
    }

    function testUpdateScalingPriceOracleFailureNotGovernor() public {
        vm.startPrank(address(0));
        vm.expectRevert(bytes("Ownable: caller is not the owner"));

        oraclePassThrough.updateScalingPriceOracle(
            ScalingPriceOracle(address(scalingPriceOracle))
        );
        vm.stopPrank();
    }

    function testUpdateScalingPriceOracleSuccess() public {
        ScalingPriceOracle newScalingPriceOracle = ScalingPriceOracle(
            address(
                new MockScalingPriceOracle(
                    oracle,
                    jobId,
                    fee,
                    currentMonth,
                    previousMonth
                )
            )
        );

        oraclePassThrough.updateScalingPriceOracle(newScalingPriceOracle);

        /// assert that scaling price oracle was updated to new contract
        assertEq(
            address(newScalingPriceOracle),
            address(oraclePassThrough.scalingPriceOracle())
        );
    }
}
