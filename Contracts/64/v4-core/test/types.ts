import { BigNumber } from 'ethers'

export type PrizeDistribution = {
    matchCardinality: BigNumber;
    numberOfPicks: BigNumber;
    tiers: BigNumber[];
    bitRangeSize: BigNumber;
    prize: BigNumber;
    startTimestampOffset: BigNumber;
    endTimestampOffset: BigNumber;
    maxPicksPerUser: BigNumber;
    expiryDuration: BigNumber;
};

export type Draw = { drawId: BigNumber, winningRandomNumber: BigNumber, timestamp: BigNumber }
