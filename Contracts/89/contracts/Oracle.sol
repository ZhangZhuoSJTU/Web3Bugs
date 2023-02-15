// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { Governable } from "./legos/Governable.sol";
import { AggregatorV3Interface } from "./Interfaces.sol";

contract Oracle is Governable {
    using SafeCast for uint256;
    using SafeCast for int256;

    mapping(address => address) public chainLinkAggregatorMap;
    mapping(address => int256) public stablePrice;

    uint256[50] private __gap;

    function initialize(address _governance) external initializer {
        _setGovernace(_governance);
    }

    function getUnderlyingPrice(address underlying)
        virtual
        external
        view
        returns(int256 answer)
    {
        if (stablePrice[underlying] != 0) {
            return stablePrice[underlying];
        }
        (,answer,,,) = AggregatorV3Interface(chainLinkAggregatorMap[underlying]).latestRoundData();
        answer /= 100;
    }

    function getUnderlyingTwapPrice(address underlying, uint256 intervalInSeconds)
        virtual
        public
        view
        returns (int256)
    {
        if (stablePrice[underlying] != 0) {
            return stablePrice[underlying];
        }
        AggregatorV3Interface aggregator = AggregatorV3Interface(chainLinkAggregatorMap[underlying]);
        requireNonEmptyAddress(address(aggregator));
        require(intervalInSeconds != 0, "interval can't be 0");

        // 3 different timestamps, `previous`, `current`, `target`
        // `base` = now - intervalInSeconds
        // `current` = current round timestamp from aggregator
        // `previous` = previous round timestamp form aggregator
        // now >= previous > current > = < base
        //
        //  while loop i = 0
        //  --+------+-----+-----+-----+-----+-----+
        //         base                 current  now(previous)
        //
        //  while loop i = 1
        //  --+------+-----+-----+-----+-----+-----+
        //         base           current previous now

        (uint80 round, uint256 latestPrice, uint256 latestTimestamp) = getLatestRoundData(aggregator);
        uint256 baseTimestamp = _blockTimestamp() - intervalInSeconds;
        // if latest updated timestamp is earlier than target timestamp, return the latest price.
        if (latestTimestamp < baseTimestamp || round == 0) {
            return formatPrice(latestPrice);
        }

        // rounds are like snapshots, latestRound means the latest price snapshot. follow chainlink naming
        uint256 previousTimestamp = latestTimestamp;
        uint256 cumulativeTime = _blockTimestamp() - previousTimestamp;
        uint256 weightedPrice = latestPrice * cumulativeTime;
        while (true) {
            if (round == 0) {
                // if cumulative time is less than requested interval, return current twap price
                return formatPrice(weightedPrice / cumulativeTime);
            }

            round = round - 1; // check round sanity
            (, uint256 currentPrice, uint256 currentTimestamp) = getRoundData(aggregator, round);

            // check if current round timestamp is earlier than target timestamp
            if (currentTimestamp <= baseTimestamp) {
                // weighted time period will be (target timestamp - previous timestamp). For example,
                // now is 1000, intervalInSeconds is 100, then target timestamp is 900. If timestamp of current round is 970,
                // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
                // instead of (970 - 880)
                weightedPrice = weightedPrice + (currentPrice * (previousTimestamp - baseTimestamp));
                break;
            }

            uint256 timeFraction = previousTimestamp - currentTimestamp;
            weightedPrice = weightedPrice + (currentPrice * timeFraction);
            cumulativeTime = cumulativeTime + timeFraction;
            previousTimestamp = currentTimestamp;
        }
        return formatPrice(weightedPrice / intervalInSeconds);
    }

    //
    // INTERNAL VIEW FUNCTIONS
    //

    function getLatestRoundData(AggregatorV3Interface _aggregator)
        internal
        view
        returns (
            uint80,
            uint256 finalPrice,
            uint256
        )
    {
        (uint80 round, int256 latestPrice, , uint256 latestTimestamp, ) = _aggregator.latestRoundData();
        finalPrice = uint256(latestPrice);
        if (latestPrice < 0) {
            requireEnoughHistory(round);
            (round, finalPrice, latestTimestamp) = getRoundData(_aggregator, round - 1);
        }
        return (round, finalPrice, latestTimestamp);
    }

    function getRoundData(AggregatorV3Interface _aggregator, uint80 _round)
        internal
        view
        returns (
            uint80,
            uint256,
            uint256
        )
    {
        (uint80 round, int256 latestPrice, , uint256 latestTimestamp, ) = _aggregator.getRoundData(_round);
        while (latestPrice < 0) {
            requireEnoughHistory(round);
            round = round - 1;
            (, latestPrice, , latestTimestamp, ) = _aggregator.getRoundData(round);
        }
        return (round, uint256(latestPrice), latestTimestamp);
    }

    function formatPrice(uint256 _price) internal pure returns (int256) {
        return (_price / 100).toInt256(); // 6 decimals
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    // Internal

    function requireEnoughHistory(uint80 _round) internal pure {
        require(_round > 0, "Not enough history");
    }

    function requireNonEmptyAddress(address _addr) internal pure {
        require(_addr != address(0), "empty address");
    }

    // Governance

    function setAggregator(address underlying, address aggregator) external onlyGovernance {
        requireNonEmptyAddress(underlying);
        requireNonEmptyAddress(aggregator);
        chainLinkAggregatorMap[underlying] = aggregator;
        // AggregatorV3Interface(chainLinkAggregatorMap[underlying]).latestRoundData(); // sanity check
    }

    function setStablePrice(address underlying, int256 price) external onlyGovernance {
        requireNonEmptyAddress(underlying);
        stablePrice[underlying] = price;
    }
}
