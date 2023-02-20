const { PoolEnv } = require('./support/PoolEnv');
const ethers = require('ethers');
const { fillPrizeTiersWithZeros } = require('../helpers/fillPrizeTiersWithZeros');

const toWei = (val) => ethers.utils.parseEther('' + val);

describe('Oracle jobs', () => {
    let env;

    beforeEach(async () => {
        env = new PoolEnv();
        await env.ready();
    });

    it('should be able to trigger the beacon', async () => {
        await env.draw({ randomNumber: 1 });
        await env.expectDrawRandomNumber({ drawId: 1, randomNumber: 1 });
    });

    it('should be able to push new draw settings', async () => {
        await env.poolAccrues({ tickets: 10 });
        await env.draw({ randomNumber: 1 });
        bitRangeSize = 2;
        matchCardinality = 2;
        numberOfPicks = toWei(1);
        tiers = [ethers.utils.parseUnits('1', 9)];
        tiers = fillPrizeTiersWithZeros(tiers);
        prize = toWei(10);
        startTimestampOffset = 1;
        endTimestampOffset = 2;
        maxPicksPerUser = 1000;
        expiryDuration = 100;

        await env.pushPrizeDistribution({
            drawId: 1,
            bitRangeSize,
            matchCardinality,
            startTimestampOffset,
            endTimestampOffset,
            expiryDuration,
            numberOfPicks,
            tiers,
            prize,
            maxPicksPerUser,
        });
    });
});
