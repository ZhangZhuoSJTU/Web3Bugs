import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';

const { provider } = ethers;

describe('overflowSafeComparatorLib', () => {
    let overflowSafeComparatorLib: Contract;
    let currentTimestamp: number;

    beforeEach(async () => {
        currentTimestamp = (await provider.getBlock('latest')).timestamp;

        const overflowSafeComparatorLibFactory: ContractFactory = await ethers.getContractFactory(
            'OverflowSafeComparatorLibHarness',
        );
        overflowSafeComparatorLib = await overflowSafeComparatorLibFactory.deploy();
    });

    describe('lt()', () => {
        it('should compare timestamp a to timestamp b if no overflow', async () => {
            const timestampA = currentTimestamp - 1000;
            const timestampB = currentTimestamp - 100;

            expect(
                await overflowSafeComparatorLib.ltHarness(timestampA, timestampB, currentTimestamp),
            ).to.equal(true);
        });

        it('should return false if timestamp a is equal to timestamp b', async () => {
            const timestampA = currentTimestamp - 1000;
            const timestampB = timestampA;

            expect(
                await overflowSafeComparatorLib.ltHarness(timestampA, timestampB, currentTimestamp),
            ).to.equal(false);
        });

        it('should compare timestamp a to timestamp b if b has overflowed', async () => {
            const timestampA = currentTimestamp - 1000;
            const timestampB = currentTimestamp + 1000;

            expect(
                await overflowSafeComparatorLib.ltHarness(timestampA, timestampB, currentTimestamp),
            ).to.equal(false);
        });

        it('should compare timestamp a to timestamp b if a has overflowed', async () => {
            const timestampA = currentTimestamp + 1000;
            const timestampB = currentTimestamp - 1000;

            expect(
                await overflowSafeComparatorLib.ltHarness(timestampA, timestampB, currentTimestamp),
            ).to.equal(true);
        });

        it('should return false if timestamps have overflowed and timestamp a is equal to timestamp b', async () => {
            const timestampA = currentTimestamp + 1000;
            const timestampB = timestampA;

            expect(
                await overflowSafeComparatorLib.ltHarness(timestampA, timestampB, currentTimestamp),
            ).to.equal(false);
        });
    });

    describe('lte()', () => {
        it('should compare timestamp a to timestamp b if no overflow', async () => {
            const timestampA = currentTimestamp - 1000;
            const timestampB = currentTimestamp - 100;

            expect(
                await overflowSafeComparatorLib.lteHarness(
                    timestampA,
                    timestampB,
                    currentTimestamp,
                ),
            ).to.equal(true);
        });

        it('should return true if timestamp a is equal to timestamp b', async () => {
            const timestampA = currentTimestamp - 1000;
            const timestampB = timestampA;

            expect(
                await overflowSafeComparatorLib.lteHarness(
                    timestampA,
                    timestampB,
                    currentTimestamp,
                ),
            ).to.equal(true);
        });

        it('should compare timestamp a to timestamp b if b has overflowed', async () => {
            const timestampA = currentTimestamp - 1000;
            const timestampB = currentTimestamp + 1000;

            expect(
                await overflowSafeComparatorLib.lteHarness(
                    timestampA,
                    timestampB,
                    currentTimestamp,
                ),
            ).to.equal(false);
        });

        it('should compare timestamp a to timestamp b if a has overflowed', async () => {
            const timestampA = currentTimestamp + 1000;
            const timestampB = currentTimestamp - 1000;

            expect(
                await overflowSafeComparatorLib.lteHarness(
                    timestampA,
                    timestampB,
                    currentTimestamp,
                ),
            ).to.equal(true);
        });

        it('should return true if timestamps have overflowed and timestamp a is equal to timestamp b', async () => {
            const timestampA = currentTimestamp + 1000;
            const timestampB = timestampA;

            expect(
                await overflowSafeComparatorLib.lteHarness(
                    timestampA,
                    timestampB,
                    currentTimestamp,
                ),
            ).to.equal(true);
        });
    });

    describe('checkedSub()', () => {
        it('should calculate normally', async () => {
            expect(await overflowSafeComparatorLib.checkedSub(10, 4, 10)).to.equal(6);
        });

        it('should handle overflow of a', async () => {
            // put in actual times.
            const secondTimestamp = 2 ** 8;
            const firstTimestamp = 2 ** 32 + (secondTimestamp - 1); // just before the answer overflows

            expect(
                await overflowSafeComparatorLib.checkedSub(
                    firstTimestamp,
                    secondTimestamp,
                    firstTimestamp,
                ),
            ).to.equal(firstTimestamp - secondTimestamp);
        });

        it('should handle overflow of both', async () => {
            // put in actual times.
            const secondTimestamp = 2 ** 32 + 100;
            const firstTimestamp = 2 ** 32 + 200;

            expect(
                await overflowSafeComparatorLib.checkedSub(
                    firstTimestamp,
                    secondTimestamp,
                    firstTimestamp,
                ),
            ).to.equal(firstTimestamp - secondTimestamp);
        });
    });
});
