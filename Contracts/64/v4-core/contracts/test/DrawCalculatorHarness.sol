// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../DrawCalculator.sol";

contract DrawCalculatorHarness is DrawCalculator {
    constructor(
        ITicket _ticket,
        IDrawBuffer _drawBuffer,
        PrizeDistributionBuffer _prizeDistributionBuffer
    ) DrawCalculator(_ticket, _drawBuffer, _prizeDistributionBuffer) {}

    function calculateTierIndex(
        uint256 _randomNumberThisPick,
        uint256 _winningRandomNumber,
        uint256[] memory _masks
    ) public pure returns (uint256) {
        return _calculateTierIndex(_randomNumberThisPick, _winningRandomNumber, _masks);
    }

    function createBitMasks(IPrizeDistributionBuffer.PrizeDistribution calldata _prizeDistribution)
        public
        pure
        returns (uint256[] memory)
    {
        return _createBitMasks(_prizeDistribution);
    }

    ///@notice Calculates the expected prize fraction per prizeDistribution and prizeTierIndex
    ///@param _prizeDistribution prizeDistribution struct for Draw
    ///@param _prizeTierIndex Index of the prize tiers array to calculate
    ///@return returns the fraction of the total prize
    function calculatePrizeTierFraction(
        IPrizeDistributionBuffer.PrizeDistribution calldata _prizeDistribution,
        uint256 _prizeTierIndex
    ) external pure returns (uint256) {
        return _calculatePrizeTierFraction(_prizeDistribution, _prizeTierIndex);
    }

    function numberOfPrizesForIndex(uint8 _bitRangeSize, uint256 _prizeTierIndex)
        external
        pure
        returns (uint256)
    {
        return _numberOfPrizesForIndex(_bitRangeSize, _prizeTierIndex);
    }

    function calculateNumberOfUserPicks(
        IPrizeDistributionBuffer.PrizeDistribution memory _prizeDistribution,
        uint256 _normalizedUserBalance
    ) external pure returns (uint64) {
        return _calculateNumberOfUserPicks(_prizeDistribution, _normalizedUserBalance);
    }
}
