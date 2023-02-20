// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IJoin.sol";

interface ILadle {
    function joins(bytes6 assetId) external view returns(IJoin);
}