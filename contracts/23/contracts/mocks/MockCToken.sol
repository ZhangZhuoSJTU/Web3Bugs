// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;

contract MockCToken {
    uint private _answer;
    uint private _supplyRate;
    uint8 public decimals;
    address public underlying;
    string public symbol = "cMock";
    event AccrueInterest(uint cashPrior, uint interestAccumulated, uint borrowIndex, uint totalBorrows);

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function setUnderlying(address underlying_) external {
        underlying = underlying_;
    }

    function setAnswer(uint a) external {
        _answer = a;
    }

    function setSupplyRate(uint a) external {
        _supplyRate = a;
    }

    function exchangeRateCurrent() external returns (uint) {
        // This is here to test if we've called the right function
        emit AccrueInterest(0, 0, 0, 0);
        return _answer;
    }

    function exchangeRateStored() external view returns (uint) {
        return _answer;
    }

    function supplyRatePerBlock() external view returns (uint) {
        return _supplyRate;
    }
}


