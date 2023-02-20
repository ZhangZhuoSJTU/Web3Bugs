// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/IMirinOracle.sol";

contract MirinOracleMock is IMirinOracle {

    struct PricePoint {
        uint256 timestamp;
        uint256 price0Cumulative;
        uint256 price1Cumulative;
    }

    PricePoint[] public override pricePoints;

    constructor(
        uint256[] memory _timestamps,
        uint256[] memory _price0Cumulatives,
        uint256[] memory _price1Cumulatives
    ) {
        addPricePoints(_timestamps, _price0Cumulatives, _price1Cumulatives);
    }

    function token0() external override pure returns (address) {
        return address(0);
    }

    function token1() external override pure returns (address) {
        return address(0);
    }

    function addPricePoints(
        uint256[] memory _timestamps,
        uint256[] memory _price0Cumulatives,
        uint256[] memory _price1Cumulatives
    ) public {
        require(_timestamps.length == _price0Cumulatives.length && _price0Cumulatives.length == _price1Cumulatives.length, "price point arrays must have same length");
        for (uint256 i = 0; i < _timestamps.length; i++) {
            pricePoints.push(PricePoint(
                _timestamps[i],
                _price0Cumulatives[i],
                _price1Cumulatives[i]
            ));
        }
    }

    function pricePointsLength() external override view returns (uint256) {
        return pricePoints.length;
    }
}
