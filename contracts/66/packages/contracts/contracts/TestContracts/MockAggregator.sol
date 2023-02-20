// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Dependencies/AggregatorV3Interface.sol";
import "hardhat/console.sol";

contract MockAggregator is AggregatorV3Interface {
    
    // storage variables to hold the mock data
    uint8 private decimalsVal = 8;
    int private price;
    int private prevPrice;
    uint private updateTime;
    uint private prevUpdateTime;

    uint80 private latestRoundId;
    uint80 private prevRoundId;

    bool latestRevert;
    bool prevRevert;
    bool decimalsRevert;

    // --- Functions ---

    function setDecimals(uint8 _decimals) external {
        decimalsVal = _decimals;
    }

    function setPrice(int _price) external {
        price = _price;
    }

    function setPrevPrice(int _prevPrice) external {
        prevPrice = _prevPrice;
    }

    function setPrevUpdateTime(uint _prevUpdateTime) external {
        prevUpdateTime = _prevUpdateTime;
    }

    function setUpdateTime(uint _updateTime) external  {
        updateTime = _updateTime;
    }

    function setLatestRevert() external  {
        latestRevert = !latestRevert;
    }

    function setPrevRevert() external  {
        prevRevert = !prevRevert;
    }

    function setDecimalsRevert() external {
        decimalsRevert = !decimalsRevert;
    }

    function setLatestRoundId(uint80 _latestRoundId) external {
        latestRoundId = _latestRoundId;
    }

      function setPrevRoundId(uint80 _prevRoundId) external {
        prevRoundId = _prevRoundId;
    }
    

    // --- Getters that adhere to the AggregatorV3 interface ---

    function decimals() external override view returns (uint8) {
        if (decimalsRevert) {require(1== 0, "decimals reverted");}

        return decimalsVal;
    }

    function latestRoundData()
        external
        override
        view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) 
    {    
        if (latestRevert) { require(1== 0, "latestRoundData reverted");}

        return (latestRoundId, price, 0, updateTime, 0); 
    }

    function getRoundData(uint80)
    external
    override 
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
        if (prevRevert) {require( 1== 0, "getRoundData reverted");}

        return (prevRoundId, prevPrice, 0, updateTime, 0);
    }

    function description() external override view returns (string memory) {
        return "";
    }
    function version() external override view returns (uint256) {
        return 1;
    }
}
