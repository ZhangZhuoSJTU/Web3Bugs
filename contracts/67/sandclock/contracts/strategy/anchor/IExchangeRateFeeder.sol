// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IExchangeRateFeeder {
    function exchangeRateOf(address _token, bool _simulate)
        external
        view
        returns (uint256);
}
