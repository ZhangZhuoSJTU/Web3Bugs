// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

interface ICurveRegistry {
    function get_A(address curvePool_) external view returns (uint256);
}
