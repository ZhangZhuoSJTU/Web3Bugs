// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IJoin.sol";

interface ILadleGov {
    function joins(bytes6) external view returns (IJoin);
    function addJoin(bytes6, address) external;
    function addPool(bytes6, address) external;
}