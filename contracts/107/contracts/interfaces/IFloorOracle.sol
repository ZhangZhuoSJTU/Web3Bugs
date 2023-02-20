// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IFloorOracle {
    function update() external returns (bool);

    function floor_eth_18() external view returns (uint256);

    function last_update_time() external view returns (uint256);

    function last_update_remote() external view returns (bool);
}
