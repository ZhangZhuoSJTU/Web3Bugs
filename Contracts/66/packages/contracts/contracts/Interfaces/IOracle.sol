// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

interface IOracle {
    function getPrice() external returns (uint256);

    // returns value 10 ** 18 times USD, of amount of the token
    // for which this oracle is for
    // amount is in the base units of the token
    function getValue(uint amount) external returns (uint256);
}
