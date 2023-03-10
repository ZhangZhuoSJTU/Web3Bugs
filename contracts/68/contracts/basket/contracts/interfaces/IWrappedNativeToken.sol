// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

interface IWrappedNativeToken {
    function withdraw(uint256 wad) external;
}
