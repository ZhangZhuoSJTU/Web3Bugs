// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface ICoreOracle {
    function pricePerShare() external view returns (uint256);
}
