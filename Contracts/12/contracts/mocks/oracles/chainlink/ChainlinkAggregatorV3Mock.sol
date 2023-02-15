// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "../ISourceMock.sol";


contract ChainlinkAggregatorV3Mock is ISourceMock {
    int public price;   // Prices in Chainlink can be negative (!)
    uint public timestamp;
    uint8 public decimals;  // Decimals provided in the oracle prices

    constructor (uint8 decimals_) {
        decimals = decimals_;
    }

    function set(uint price_) external override {// We provide prices with 18 decimals, which will be scaled Chainlink's decimals
        if (decimals <= 18) price = int(price_ / 10**(18 - decimals));
        else price = int(price_ * 10**(decimals - 18));          
        
        timestamp = block.timestamp;
    }

    function latestRoundData() public view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, price, 0, timestamp, 0);
    }
}
