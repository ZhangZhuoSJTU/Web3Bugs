// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMultiOracleGov {
    function setSource(bytes6, bytes6, address) external;
}
