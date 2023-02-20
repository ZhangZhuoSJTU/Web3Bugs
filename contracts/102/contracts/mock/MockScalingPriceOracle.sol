// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {CoreRef} from "./../refs/CoreRef.sol";
import {ScalingPriceOracle} from "./../oracle/ScalingPriceOracle.sol";

/// @notice Testing contract that allows for updates without mocking chainlink calls
contract MockScalingPriceOracle is ScalingPriceOracle {
    constructor(
        address _oracle,
        bytes32 _jobid,
        uint256 _fee,
        uint128 _currentMonth,
        uint128 _previousMonth
    )
        ScalingPriceOracle(_oracle, _jobid, _fee, _currentMonth, _previousMonth)
    {}

    function fulfill(uint256 _cpiData) external {
        _updateCPIData(_cpiData);
    }
}
