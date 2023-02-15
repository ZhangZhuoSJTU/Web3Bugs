// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.6;

interface ICurvePool {
    function get_virtual_price() external view returns (uint256 price);
}