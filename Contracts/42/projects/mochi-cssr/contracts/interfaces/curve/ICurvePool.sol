// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICurvePool {
    function coins(uint256 _idx) external view returns (address);

    function get_virtual_price() external view returns (uint256);
}
