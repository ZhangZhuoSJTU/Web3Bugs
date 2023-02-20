// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IUniV3Factory {
    function isPool(address) external view returns (bool);
    function addObservationPoints (int56[][] calldata observations) external;
}
