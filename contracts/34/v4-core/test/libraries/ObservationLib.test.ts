import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';

describe('ObservationLib', () => {
    let observationLib: Contract;

    beforeEach(async () => {
        const observationLibFactory: ContractFactory = await ethers.getContractFactory(
            'ObservationLibHarness',
        );

        observationLib = await observationLibFactory.deploy();
    });

    describe('binarySearch()', () => {
        const currentTime = 1000; // for overflow checks

        context('with two observations', () => {
            let newestIndex: number;
            let oldestIndex: number;
            let cardinality: number;

            beforeEach(async () => {
                await observationLib.setObservations([
                    { amount: 10, timestamp: 20 },
                    { amount: 20, timestamp: 30 },
                ]);
                newestIndex = 1;
                oldestIndex = 0;
                cardinality = 3; // if the buffer hasn't wrapped, its cardinality will be +1 for the # of items
            });

            /*
        timestamp must lie within range

        t = target
        [ = oldest timestamp
        ] = newest timestamp

        t[ ]
        [ t ]
        [ t]

      */

            it('should retrieve when timestamp matches first', async () => {
                const search = await observationLib.binarySearch(1, 0, 20, 3, currentTime);

                expect(search[0].timestamp).to.equal(20);
                expect(search[1].timestamp).to.equal(30);
            });

            it('should retrieve when timestamp is in middle', async () => {
                const search = await observationLib.binarySearch(1, 0, 25, 3, currentTime);

                expect(search[0].timestamp).to.equal(20);
                expect(search[1].timestamp).to.equal(30);
            });

            it('should retrieve when timestamp matches second', async () => {
                const search = await observationLib.binarySearch(1, 0, 30, 3, currentTime);

                expect(search[0].timestamp).to.equal(20);
                expect(search[1].timestamp).to.equal(30);
            });
        });

        context('with observations that have wrapped', async () => {
            let newestIndex: number;
            let oldestIndex: number;
            let cardinality: number;

            beforeEach(async () => {
                await observationLib.setObservations([
                    { amount: 10, timestamp: 60 },
                    { amount: 20, timestamp: 30 },
                    { amount: 10, timestamp: 40 },
                    { amount: 10, timestamp: 50 },
                ]);

                newestIndex = 0;
                oldestIndex = 1;
                cardinality = 4; // once the buffer wraps it's cardinality will be same as # of elements
            });

            it('should retrieve when timestamp matches first', async () => {
                const search = await observationLib.binarySearch(
                    newestIndex,
                    oldestIndex,
                    30,
                    cardinality,
                    currentTime,
                );

                expect(search[0].timestamp).to.equal(30);
                expect(search[1].timestamp).to.equal(40);
            });

            it('should retrieve when timestamp is in middle', async () => {
                const search = await observationLib.binarySearch(
                    newestIndex,
                    oldestIndex,
                    45,
                    cardinality,
                    currentTime,
                );

                expect(search[0].timestamp).to.equal(40);
                expect(search[1].timestamp).to.equal(50);
            });

            it('should retrieve when timestamp matches second', async () => {
                const search = await observationLib.binarySearch(
                    newestIndex,
                    oldestIndex,
                    50,
                    cardinality,
                    currentTime,
                );

                expect(search[0].timestamp).to.equal(40);
                expect(search[1].timestamp).to.equal(50);
            });

            it('should retrieve when in second half of binary search', async () => {
                const search = await observationLib.binarySearch(
                    newestIndex,
                    oldestIndex,
                    55,
                    cardinality,
                    currentTime,
                );

                expect(search[0].timestamp).to.equal(50);
                expect(search[1].timestamp).to.equal(60);
            });
        });
    });
});
