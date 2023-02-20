// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "../ISourceMock.sol";


contract CTokenChiMock is ISourceMock {
    uint public exchangeRateStored;

    function set(uint chi) external override {
        exchangeRateStored = chi;
    }

    function exchangeRateCurrent() public view returns (uint) {
        return exchangeRateStored;
    }
}
