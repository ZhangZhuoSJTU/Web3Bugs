// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPrice {
    function latestAnswer() external view returns (int256);
    function decimals() external view returns (uint256);
}

contract MockChainlinkFeed is IPrice {

    int256 private price;

    function latestAnswer() external view returns (int256) {
        return price;
    }

    function decimals() external pure returns (uint256) {
        return 10;
    }

    function setPrice(int256 _price) external {
        price = _price;
    }
}