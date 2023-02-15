import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { fillPrizeTiersWithZeros } from './utils/fillPrizeTiersWithZeros';

const { constants, getSigners } = ethers;
const { AddressZero, Zero } = constants;

type PrizeDistribution = {
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

describe('PrizeDistributionSplitter', () => {
    let owner: SignerWithAddress;

    let prizeDistributionSourceBefore: Contract;
    let prizeDistributionSourceAtOrAfter: Contract;
    let prizeDistributionSplitter: Contract;

    let constructorTest = false;

    const deployPrizeDistributionSplitter = async (
        drawId = BigNumber.from(5),
        prizeDistributionSourceBeforeAddress = prizeDistributionSourceBefore.address,
        prizeDistributionSourceAtOrAfterAddress = prizeDistributionSourceAtOrAfter.address,
    ) => {
        const prizeDistributionSourceFactory: ContractFactory = await ethers.getContractFactory(
            'PrizeDistributionSplitter',
        );

        return await prizeDistributionSourceFactory.deploy(
            drawId,
            prizeDistributionSourceBeforeAddress,
            prizeDistributionSourceAtOrAfterAddress,
        );
    };

    const prizeDistribution: PrizeDistribution = {
        matchCardinality: BigNumber.from(5),
        numberOfPicks: ethers.utils.parseEther('1'),
        tiers: [ethers.utils.parseUnits('0.5', 9)],
        bitRangeSize: BigNumber.from(3),
        prize: ethers.utils.parseEther('100'),
        startTimestampOffset: BigNumber.from(0),
        endTimestampOffset: BigNumber.from(3600),
        maxPicksPerUser: BigNumber.from(10),
        expiryDuration: BigNumber.from(100),
    };

    prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

    function newPrizeDistribution(cardinality: number): any {
        return {
            ...prizeDistribution,
            matchCardinality: BigNumber.from(cardinality),
        };
    }

    beforeEach(async () => {
        [owner] = await getSigners();

        const prizeDistributionBufferFactory: ContractFactory = await ethers.getContractFactory(
            'PrizeDistributionBuffer',
        );

        prizeDistributionSourceBefore = await prizeDistributionBufferFactory.deploy(
            owner.address,
            4,
        );
        prizeDistributionSourceAtOrAfter = await prizeDistributionBufferFactory.deploy(
            owner.address,
            6,
        );

        await prizeDistributionSourceBefore.setManager(owner.address);
        await prizeDistributionSourceAtOrAfter.setManager(owner.address);

        if (!constructorTest) {
            prizeDistributionSplitter = await deployPrizeDistributionSplitter();
        }
    });

    describe('constructor()', () => {
        beforeEach(() => {
            constructorTest = true;
        });

        afterEach(() => {
            constructorTest = false;
        });

        it('should deploy and set drawId, prizeDistributionSourceBefore and prizeDistributionSourceAtOrAfter', async () => {
            const prizeDistributionSplitter = await deployPrizeDistributionSplitter();
            const drawId = BigNumber.from(5);

            await expect(prizeDistributionSplitter.deployTransaction)
                .to.emit(prizeDistributionSplitter, 'DrawIdSet')
                .withArgs(drawId);

            await expect(prizeDistributionSplitter.deployTransaction)
                .to.emit(prizeDistributionSplitter, 'PrizeDistributionSourcesSet')
                .withArgs(
                    prizeDistributionSourceBefore.address,
                    prizeDistributionSourceAtOrAfter.address,
                );

            expect(await prizeDistributionSplitter.drawId()).to.equal(drawId);
            expect(await prizeDistributionSplitter.prizeDistributionSourceBefore()).to.equal(
                prizeDistributionSourceBefore.address,
            );

            expect(await prizeDistributionSplitter.prizeDistributionSourceAtOrAfter()).to.equal(
                prizeDistributionSourceAtOrAfter.address,
            );
        });

        it('should fail to deploy if drawId is not greater than zero', async () => {
            await expect(deployPrizeDistributionSplitter(Zero)).to.be.revertedWith(
                'PrizeDistSplitter/drawId-gt-zero',
            );
        });

        it('should fail to deploy if prizeDistributionSourceBefore is address zero', async () => {
            await expect(
                deployPrizeDistributionSplitter(BigNumber.from(10), AddressZero),
            ).to.be.revertedWith('PrizeDistSplitter/not-zero-addr');
        });

        it('should fail to deploy if prizeDistributionSourceAtOrAfter is address zero', async () => {
            await expect(
                deployPrizeDistributionSplitter(
                    BigNumber.from(10),
                    prizeDistributionSourceBefore.address,
                    AddressZero,
                ),
            ).to.be.revertedWith('PrizeDistSplitter/not-zero-addr');
        });
    });

    describe('getPrizeDistributions()', () => {
        beforeEach(async () => {
            await prizeDistributionSourceBefore.pushPrizeDistribution(1, newPrizeDistribution(1));
            await prizeDistributionSourceBefore.pushPrizeDistribution(2, newPrizeDistribution(2));
            await prizeDistributionSourceBefore.pushPrizeDistribution(3, newPrizeDistribution(3));
            await prizeDistributionSourceBefore.pushPrizeDistribution(4, newPrizeDistribution(4));
            await prizeDistributionSourceAtOrAfter.pushPrizeDistribution(
                5,
                newPrizeDistribution(5),
            );
            await prizeDistributionSourceAtOrAfter.pushPrizeDistribution(
                6,
                newPrizeDistribution(6),
            );
            await prizeDistributionSourceAtOrAfter.pushPrizeDistribution(
                7,
                newPrizeDistribution(7),
            );
            await prizeDistributionSourceAtOrAfter.pushPrizeDistribution(
                8,
                newPrizeDistribution(8),
            );
            await prizeDistributionSourceAtOrAfter.pushPrizeDistribution(
                9,
                newPrizeDistribution(9),
            );
            await prizeDistributionSourceAtOrAfter.pushPrizeDistribution(
                10,
                newPrizeDistribution(10),
            );
        });

        it('should return prize distributions from prizeDistributionSourceBefore if drawIds passed are lower than drawId', async () => {
            const draws = await prizeDistributionSplitter.getPrizeDistributions([1, 2, 3, 4]);
            const expectedDraws = await prizeDistributionSourceBefore.getPrizeDistributions([
                1, 2, 3, 4,
            ]);

            for (let index = 0; index < draws.length; index++) {
                expect(draws[index].matchCardinality).to.equal(
                    expectedDraws[index].matchCardinality,
                );
            }
        });

        it('should return prize distributions from prizeDistributionSourceAtOrAfter if drawIds passed are greater than or equal to drawId', async () => {
            const draws = await prizeDistributionSplitter.getPrizeDistributions([5, 6, 7]);
            const expectedDraws = await prizeDistributionSourceAtOrAfter.getPrizeDistributions([
                5, 6, 7,
            ]);

            for (let index = 0; index < draws.length; index++) {
                expect(draws[index].matchCardinality).to.equal(
                    expectedDraws[index].matchCardinality,
                );
            }
        });

        it('should return all prize distributions from both sources', async () => {
            const draws = await prizeDistributionSplitter.getPrizeDistributions([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            ]);

            const expectedDrawsBefore = await prizeDistributionSourceBefore.getPrizeDistributions([
                1, 2, 3, 4,
            ]);

            const expectedDrawsAtOrAfter =
                await prizeDistributionSourceAtOrAfter.getPrizeDistributions([5, 6, 7, 8, 9, 10]);

            for (let index = 0; index < draws.length; index++) {
                if (index < 4) {
                    expect(draws[index].matchCardinality).to.equal(
                        expectedDrawsBefore[index].matchCardinality,
                    );
                } else {
                    expect(draws[index].matchCardinality).to.equal(
                        expectedDrawsAtOrAfter[index - 4].matchCardinality,
                    );
                }
            }
        });

        it('should fail to getPrizeDistributions if drawIds are not ordered incrementally', async () => {
            await expect(
                prizeDistributionSplitter.getPrizeDistributions([2, 1, 3]),
            ).to.be.revertedWith('PrizeDistSplitter/drawId-asc');
        });
    });
});
