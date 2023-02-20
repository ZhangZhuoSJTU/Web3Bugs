// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Vm} from "./../utils/Vm.sol";
import "./../utils/DSTest.sol";
import {Constants} from "./../../../Constants.sol";
import {Deviation} from "./../../../utils/Deviation.sol";
import {getCore, getAddresses, FeiTestAddresses} from "./../utils/Fixtures.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract DeviationTest is DSTest {
    using SafeCast for *;
    using Deviation for *;

    uint256 maxDeviationThresholdBasisPoints = 10_000;

    Vm public constant vm = Vm(HEVM_ADDRESS);
    FeiTestAddresses public addresses = getAddresses();

    function testDeviation() public {
        int256 x = 275000;
        int256 y = 270000;

        int256 delta = x - y;
        uint256 absDeviation = delta.toUint256();

        uint256 basisPoints = (absDeviation *
            Constants.BASIS_POINTS_GRANULARITY) / x.toUint256();

        assertEq(
            basisPoints,
            Deviation.calculateDeviationThresholdBasisPoints(x, y)
        );
    }

    function testWithinDeviation() public {
        int256 x = 275000;
        int256 y = 270000;

        assertTrue(
            maxDeviationThresholdBasisPoints.isWithinDeviationThreshold(x, y)
        );
    }

    function testWithinDeviationFuzz(int128 x, int128 y) public view {
        maxDeviationThresholdBasisPoints.isWithinDeviationThreshold(x, y);
    }

    function testOutsideDeviation() public {
        int256 x = 275000;
        int256 y = 577500;

        assertTrue(
            !maxDeviationThresholdBasisPoints.isWithinDeviationThreshold(x, y)
        );
    }
}
