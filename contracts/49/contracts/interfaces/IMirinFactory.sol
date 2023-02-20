// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IMirinFactory {
    function isPool(address) external view returns (bool);
}
