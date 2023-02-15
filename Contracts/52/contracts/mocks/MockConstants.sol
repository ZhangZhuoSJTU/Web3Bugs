// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "../shared/ProtocolConstants.sol";

contract MockConstants is ProtocolConstants {
    // Max VADER supply
    uint256 public constant INITIAL_VADER_SUPPLY = _INITIAL_VADER_SUPPLY;

    // Allocation for VETH holders
    uint256 public constant VETH_ALLOCATION = _VETH_ALLOCATION;

    // Vader -> Vether Conversion Rate (1000:1)
    uint256 public constant VADER_VETHER_CONVERSION_RATE =
        _VADER_VETHER_CONVERSION_RATE;

    // Team allocation vested over {VESTING_DURATION} years
    uint256 public constant TEAM_ALLOCATION = _TEAM_ALLOCATION;

    // Ecosystem growth fund unlocked for partnerships & USDV provision
    uint256 public constant ECOSYSTEM_GROWTH = _ECOSYSTEM_GROWTH;

    // Emission Era
    uint256 public constant EMISSION_ERA = _EMISSION_ERA;

    // One year, utility
    uint256 public constant ONE_YEAR = _ONE_YEAR;

    // Initial Emission Curve, 5
    uint256 public constant INITIAL_EMISSION_CURVE = _INITIAL_EMISSION_CURVE;

    // Vesting Duration
    uint256 public constant VESTING_DURATION = _VESTING_DURATION;

    // Basis Points
    uint256 public constant MAX_BASIS_POINTS = _MAX_BASIS_POINTS;

    // Fee Basis Points
    uint256 public constant MAX_FEE_BASIS_POINTS = _MAX_FEE_BASIS_POINTS;

    // Burn Address
    address public constant BURN = _BURN;
}
