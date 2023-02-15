const { PoolEnv } = require('./support/PoolEnv');
const ethers = require('ethers');

const toWei = (val) => ethers.utils.parseEther('' + val);

describe('Tickets', () => {
    let env;

    beforeEach(async () => {
        env = new PoolEnv();
        await env.ready();
    });

    it('should be possible to purchase tickets', async () => {
        await env.buyTickets({ user: 1, tickets: 100 });
        await env.buyTickets({ user: 2, tickets: 50 });
        await env.expectUserToHaveTickets({ user: 1, tickets: 100 });
        await env.expectUserToHaveTickets({ user: 2, tickets: 50 });
    });

    it('should be possible to withdraw tickets', async () => {
        await env.buyTickets({ user: 1, tickets: 100 });

        // they deposited all of their tokens
        await env.expectUserToHaveTokens({ user: 1, tokens: 0 });
        await env.withdraw({ user: 1, tickets: 100 });
        await env.expectUserToHaveTokens({ user: 1, tokens: 100 });
    });

    // NOT a COMPLETE test. Needs to be fixed - out of scope for this PR.
    it.skip('should allow a user to pull their prizes', async () => {
        await env.buyTickets({ user: 1, tickets: 100 });
        await env.buyTicketsForPrizeDistributor({
            user: 1,
            tickets: 100,
            prizeDistributor: (await env.prizeDistributor()).address,
        });

        const wallet = await env.wallet(1);

        const winningNumber = ethers.utils.solidityKeccak256(['address'], [wallet.address]);
        const winningRandomNumber = ethers.utils.solidityKeccak256(
            ['bytes32', 'uint256'],
            [winningNumber, 1],
        );

        await env.poolAccrues({ tickets: 10 });
        await env.draw({ randomNumber: winningRandomNumber });

        await env.pushPrizeDistribution({
            drawId: 1,
            bitRangeSize: ethers.BigNumber.from(4),
            matchCardinality: ethers.BigNumber.from(5),
            numberOfPicks: toWei('1'),
            tiers: [ethers.utils.parseUnits('0.8', 9), ethers.utils.parseUnits('0.2', 9)],
            prize: toWei('10'),
            startTimestampOffset: 5,
            endTimestampOffset: 10,
            maxPicksPerUser: 1000,
        });

        await env.claim({ user: 1, drawId: 1, picks: [1], prize: 100 });
    });
});
