// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IAggregator {
    function latestAnswer() external view returns (int256);
}
