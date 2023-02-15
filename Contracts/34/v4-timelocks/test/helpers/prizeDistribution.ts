import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";

type PrizeDistribution = {
    matchCardinality: BigNumber;
    numberOfPicks: BigNumber;
    tiers: BigNumber[];
    bitRangeSize: BigNumber;
    prize: BigNumber;
    startTimestampOffset: BigNumber;
    endTimestampOffset: BigNumber;
    maxPicksPerUser: BigNumber;
};

const ZERO_DISTRIBUTIONS = new Array(16).fill(0);

const prizeDistribution: PrizeDistribution = {
    matchCardinality: BigNumber.from(5),
    numberOfPicks: ethers.utils.parseEther("1"),
    tiers: ZERO_DISTRIBUTIONS,
    bitRangeSize: BigNumber.from(3),
    prize: ethers.utils.parseEther("100"),
    startTimestampOffset: BigNumber.from(0),
    endTimestampOffset: BigNumber.from(3600),
    maxPicksPerUser: BigNumber.from(10),
};

export const newPrizeDistribution = (cardinality: number = 5): any => {
    const distributions = [...ZERO_DISTRIBUTIONS];
    distributions[0] = ethers.utils.parseUnits("0.5", 9);

    return {
        ...prizeDistribution,
        distributions,
        matchCardinality: BigNumber.from(cardinality),
    };
};
