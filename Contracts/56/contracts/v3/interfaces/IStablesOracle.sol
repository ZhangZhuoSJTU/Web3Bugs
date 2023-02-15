// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

interface IStablesOracle {
    function getEthereumPrice() external view returns (uint256);
    function getPrices() external view returns (uint256, uint256);
    function getSafeAnswer(address) external view returns (uint256);
}
