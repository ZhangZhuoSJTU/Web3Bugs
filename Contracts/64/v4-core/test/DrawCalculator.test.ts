import { expect } from 'chai';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { utils, Contract, BigNumber } from 'ethers';
import { ethers, artifacts } from 'hardhat';
import { Draw, PrizeDistribution } from './types';
import { fillPrizeTiersWithZeros } from './helpers/fillPrizeTiersWithZeros';

const { getSigners } = ethers;

const newDebug = require('debug');

function newDraw(overrides: any): Draw {
    return {
        drawId: 1,
        timestamp: 0,
        winningRandomNumber: 2,
        beaconPeriodStartedAt: 0,
        beaconPeriodSeconds: 1,
        ...overrides,
    };
}

function assertEmptyArrayOfBigNumbers(array: BigNumber[]) {
    array.forEach((element: BigNumber) => {
        expect(element).to.equal(BigNumber.from(0));
    });
}

export async function deployDrawCalculator(
    signer: any,
    ticketAddress: string,
    drawBufferAddress: string,
    prizeDistributionsHistoryAddress: string,
): Promise<Contract> {
    const drawCalculatorFactory = await ethers.getContractFactory('DrawCalculatorHarness', signer);
    const drawCalculator: Contract = await drawCalculatorFactory.deploy(
        ticketAddress,
        drawBufferAddress,
        prizeDistributionsHistoryAddress,
    );

    return drawCalculator;
}

function calculateNumberOfWinnersAtIndex(bitRangeSize: number, tierIndex: number): BigNumber {
    // Prize Count = (2**bitRange)**(cardinality-numberOfMatches)
    // if not grand prize: - (2^bitRange)**(cardinality-numberOfMatches-1) - ... (2^bitRange)**(0)
    if (tierIndex > 0) {
        return BigNumber.from(
            (1 << (bitRangeSize * tierIndex)) - (1 << (bitRangeSize * (tierIndex - 1))),
        );
    } else {
        return BigNumber.from(1);
    }
}

function modifyTimestampsWithOffset(timestamps: number[], offset: number): number[] {
    return timestamps.map((timestamp: number) => timestamp - offset);
}

describe('DrawCalculator', () => {
    let drawCalculator: Contract;
    let ticket: MockContract;
    let drawBuffer: MockContract;
    let prizeDistributionBuffer: MockContract;
    let wallet1: any;
    let wallet2: any;
    let wallet3: any;

    const encoder = ethers.utils.defaultAbiCoder;

    beforeEach(async () => {
        [wallet1, wallet2, wallet3] = await getSigners();

        let ticketArtifact = await artifacts.readArtifact('Ticket');
        ticket = await deployMockContract(wallet1, ticketArtifact.abi);

        let drawBufferArtifact = await artifacts.readArtifact('DrawBuffer');
        drawBuffer = await deployMockContract(wallet1, drawBufferArtifact.abi);

        let prizeDistributionBufferArtifact = await artifacts.readArtifact(
            'PrizeDistributionBuffer',
        );

        prizeDistributionBuffer = await deployMockContract(
            wallet1,
            prizeDistributionBufferArtifact.abi,
        );

        drawCalculator = await deployDrawCalculator(
            wallet1,
            ticket.address,
            drawBuffer.address,
            prizeDistributionBuffer.address,
        );
    });

    describe('constructor()', () => {
        it('should require non-zero ticket', async () => {
            await expect(
                deployDrawCalculator(
                    wallet1,
                    ethers.constants.AddressZero,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                ),
            ).to.be.revertedWith('DrawCalc/ticket-not-zero');
        });

        it('should require non-zero settings history', async () => {
            await expect(
                deployDrawCalculator(
                    wallet1,
                    ticket.address,
                    drawBuffer.address,
                    ethers.constants.AddressZero,
                ),
            ).to.be.revertedWith('DrawCalc/pdb-not-zero');
        });

        it('should require a non-zero history', async () => {
            await expect(
                deployDrawCalculator(
                    wallet1,
                    ticket.address,
                    ethers.constants.AddressZero,
                    prizeDistributionBuffer.address,
                ),
            ).to.be.revertedWith('DrawCalc/dh-not-zero');
        });
    });

    describe('getDrawBuffer()', () => {
        it('should succesfully read draw buffer', async () => {
            expect(await drawCalculator.getDrawBuffer()).to.equal(drawBuffer.address);
        });
    });

    describe('getPrizeDistributionBuffer()', () => {
        it('should succesfully read draw buffer', async () => {
            expect(await drawCalculator.getPrizeDistributionBuffer()).to.equal(
                prizeDistributionBuffer.address,
            );
        });
    });

    describe('calculateTierIndex()', () => {
        let prizeDistribution: PrizeDistribution;

        beforeEach(async () => {
            prizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            await prizeDistributionBuffer.mock.getPrizeDistributions.returns([prizeDistribution]);
        });

        it('grand prize gets the full fraction at index 0', async () => {
            const amount = await drawCalculator.calculatePrizeTierFraction(
                prizeDistribution,
                BigNumber.from(0),
            );

            expect(amount).to.equal(prizeDistribution.tiers[0]);
        });

        it('runner up gets part of the fraction at index 1', async () => {
            const amount = await drawCalculator.calculatePrizeTierFraction(
                prizeDistribution,
                BigNumber.from(1),
            );

            const prizeCount = calculateNumberOfWinnersAtIndex(
                prizeDistribution.bitRangeSize.toNumber(),
                1,
            );

            const expectedPrizeFraction = prizeDistribution.tiers[1].div(prizeCount);

            expect(amount).to.equal(expectedPrizeFraction);
        });

        it('all prize tier indexes', async () => {
            for (
                let numberOfMatches = 0;
                numberOfMatches < prizeDistribution.tiers.length;
                numberOfMatches++
            ) {
                const tierIndex = BigNumber.from(
                    prizeDistribution.tiers.length - numberOfMatches - 1,
                ); // minus one because we start at 0

                const fraction = await drawCalculator.calculatePrizeTierFraction(
                    prizeDistribution,
                    tierIndex,
                );

                let prizeCount: BigNumber = calculateNumberOfWinnersAtIndex(
                    prizeDistribution.bitRangeSize.toNumber(),
                    tierIndex.toNumber(),
                );

                const expectedPrizeFraction =
                    prizeDistribution.tiers[tierIndex.toNumber()].div(prizeCount);

                expect(fraction).to.equal(expectedPrizeFraction);
            }
        });
    });

    describe('numberOfPrizesForIndex()', () => {
        it('calculates the number of prizes at tiers index 0', async () => {
            const bitRangeSize = 2;

            const result = await drawCalculator.numberOfPrizesForIndex(
                bitRangeSize,
                BigNumber.from(0),
            );

            expect(result).to.equal(1); // grand prize
        });

        it('calculates the number of prizes at tiers index 1', async () => {
            const bitRangeSize = 3;

            const result = await drawCalculator.numberOfPrizesForIndex(
                bitRangeSize,
                BigNumber.from(1),
            );

            // Number that match exactly four: 8^1 - 8^0 = 7
            expect(result).to.equal(7);
        });

        it('calculates the number of prizes at tiers index 3', async () => {
            const bitRangeSize = 3;
            // numberOfPrizesForIndex(uint8 _bitRangeSize, uint256 _prizetierIndex)
            // prizetierIndex = matchCardinality - numberOfMatches
            // matchCardinality = 5, numberOfMatches = 2

            const result = await drawCalculator.numberOfPrizesForIndex(
                bitRangeSize,
                BigNumber.from(3),
            );

            // Number that match exactly two: 8^3 - 8^2
            expect(result).to.equal(448);
        });

        it('calculates the number of prizes at all tiers indices', async () => {
            let prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.5', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            for (let tierIndex = 0; tierIndex < prizeDistribution.tiers.length; tierIndex++) {
                const result = await drawCalculator.numberOfPrizesForIndex(
                    prizeDistribution.bitRangeSize,
                    tierIndex,
                );

                const expectedNumberOfWinners = calculateNumberOfWinnersAtIndex(
                    prizeDistribution.bitRangeSize.toNumber(),
                    tierIndex,
                );

                expect(result).to.equal(expectedNumberOfWinners);
            }
        });
    });

    describe('calculatePrizeTiersFraction()', () => {
        it('calculates tiers index 0', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const bitMasks = await drawCalculator.createBitMasks(prizeDistribution);

            const winningRandomNumber =
                '0x369ddb959b07c1d22a9bada1f3420961d0e0252f73c0f5b2173d7f7c6fe12b70';

            const userRandomNumber =
                '0x369ddb959b07c1d22a9bada1f3420961d0e0252f73c0f5b2173d7f7c6fe12b70'; // intentionally same as winning random number

            const prizetierIndex: BigNumber = await drawCalculator.calculateTierIndex(
                userRandomNumber,
                winningRandomNumber,
                bitMasks,
            );

            // all numbers match so grand prize!
            expect(prizetierIndex).to.eq(BigNumber.from(0));
        });

        it('calculates tiers index 1', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(2),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            // 252: 1111 1100
            // 255  1111 1111

            const bitMasks = await drawCalculator.createBitMasks(prizeDistribution);

            expect(bitMasks.length).to.eq(2); // same as length of matchCardinality
            expect(bitMasks[0]).to.eq(BigNumber.from(15));

            const prizetierIndex: BigNumber = await drawCalculator.calculateTierIndex(
                252,
                255,
                bitMasks,
            );

            // since the first 4 bits do not match the tiers index will be: (matchCardinality - numberOfMatches )= 2-0 = 2
            expect(prizetierIndex).to.eq(prizeDistribution.matchCardinality);
        });

        it('calculates tiers index 1', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(3),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            // 527: 0010 0000 1111
            // 271  0001 0000 1111

            const bitMasks = await drawCalculator.createBitMasks(prizeDistribution);

            expect(bitMasks.length).to.eq(3); // same as length of matchCardinality
            expect(bitMasks[0]).to.eq(BigNumber.from(15));

            const prizetierIndex: BigNumber = await drawCalculator.calculateTierIndex(
                527,
                271,
                bitMasks,
            );

            // since the first 4 bits do not match the tiers index will be: (matchCardinality - numberOfMatches )= 3-2 = 1
            expect(prizetierIndex).to.eq(BigNumber.from(1));
        });
    });

    describe('createBitMasks()', () => {
        it('creates correct 6 bit masks', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(2),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(6),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const bitMasks = await drawCalculator.createBitMasks(prizeDistribution);

            expect(bitMasks[0]).to.eq(BigNumber.from(63)); // 111111
            expect(bitMasks[1]).to.eq(BigNumber.from(4032)); // 11111100000
        });

        it('creates correct 4 bit masks', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(2),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from(utils.parseEther('1')),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const bitMasks = await drawCalculator.createBitMasks(prizeDistribution);

            expect(bitMasks[0]).to.eq(BigNumber.from(15)); // 1111
            expect(bitMasks[1]).to.eq(BigNumber.from(240)); // 11110000
        });
    });

    describe('calculateNumberOfUserPicks()', () => {
        it('calculates the correct number of user picks', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from('100'),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const normalizedUsersBalance = utils.parseEther('0.05'); // has 5% of the total supply
            const userPicks = await drawCalculator.calculateNumberOfUserPicks(
                prizeDistribution,
                normalizedUsersBalance,
            );

            expect(userPicks).to.eq(BigNumber.from(5));
        });
        it('calculates the correct number of user picks', async () => {
            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from('100000'),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);
            const normalizedUsersBalance = utils.parseEther('0.1'); // has 10% of the total supply
            const userPicks = await drawCalculator.calculateNumberOfUserPicks(
                prizeDistribution,
                normalizedUsersBalance,
            );

            expect(userPicks).to.eq(BigNumber.from(10000)); // 10% of numberOfPicks
        });
    });

    describe('getNormalizedBalancesAt()', () => {
        it('calculates the correct normalized balance', async () => {
            const timestamps = [42, 77];

            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from('100000'),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const offsetStartTimestamps = modifyTimestampsWithOffset(
                timestamps,
                prizeDistribution.startTimestampOffset.toNumber(),
            );

            const offsetEndTimestamps = modifyTimestampsWithOffset(
                timestamps,
                prizeDistribution.endTimestampOffset.toNumber(),
            );

            const draw1: Draw = newDraw({
                drawId: BigNumber.from(1),
                winningRandomNumber: BigNumber.from('1000'),
                timestamp: BigNumber.from(timestamps[0]),
            });

            const draw2: Draw = newDraw({
                drawId: BigNumber.from(2),
                winningRandomNumber: BigNumber.from('1000'),
                timestamp: BigNumber.from(timestamps[1]),
            });

            await drawBuffer.mock.getDraws.returns([draw1, draw2]);
            await prizeDistributionBuffer.mock.getPrizeDistributions.returns([
                prizeDistribution,
                prizeDistribution,
            ]);

            await ticket.mock.getAverageBalancesBetween
                .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                .returns([utils.parseEther('20'), utils.parseEther('30')]); // (user, timestamp): [balance]

            await ticket.mock.getAverageTotalSuppliesBetween
                .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                .returns([utils.parseEther('100'), utils.parseEther('600')]);

            const userNormalizedBalances = await drawCalculator.getNormalizedBalancesForDrawIds(
                wallet1.address,
                [1, 2],
            );

            expect(userNormalizedBalances[0]).to.eq(utils.parseEther('0.2'));
            expect(userNormalizedBalances[1]).to.eq(utils.parseEther('0.05'));
        });

        it('returns 0 when totalSupply is zero', async () => {
            const timestamps = [42, 77];

            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [
                    ethers.utils.parseUnits('0.6', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                    ethers.utils.parseUnits('0.1', 9),
                ],
                numberOfPicks: BigNumber.from('100000'),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const offsetStartTimestamps = modifyTimestampsWithOffset(
                timestamps,
                prizeDistribution.startTimestampOffset.toNumber(),
            );

            const offsetEndTimestamps = modifyTimestampsWithOffset(
                timestamps,
                prizeDistribution.endTimestampOffset.toNumber(),
            );

            const draw1: Draw = newDraw({
                drawId: BigNumber.from(1),
                winningRandomNumber: BigNumber.from('1000'),
                timestamp: BigNumber.from(timestamps[0]),
            });

            const draw2: Draw = newDraw({
                drawId: BigNumber.from(2),
                winningRandomNumber: BigNumber.from('1000'),
                timestamp: BigNumber.from(timestamps[1]),
            });

            await drawBuffer.mock.getDraws.returns([draw1, draw2]);
            await prizeDistributionBuffer.mock.getPrizeDistributions.returns([
                prizeDistribution,
                prizeDistribution,
            ]);

            await ticket.mock.getAverageBalancesBetween
                .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                .returns([utils.parseEther('10'), utils.parseEther('30')]); // (user, timestamp): [balance]

            await ticket.mock.getAverageTotalSuppliesBetween
                .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                .returns([utils.parseEther('0'), utils.parseEther('600')]);

            const balancesResult = await drawCalculator.getNormalizedBalancesForDrawIds(
                wallet1.address,
                [1, 2],
            );
            expect(balancesResult[0]).to.equal(0);
        });

        it('returns zero when the balance is very small', async () => {
            const timestamps = [42];

            const prizeDistribution: PrizeDistribution = {
                matchCardinality: BigNumber.from(5),
                tiers: [ethers.utils.parseUnits('0.6', 9)],
                numberOfPicks: BigNumber.from('100000'),
                bitRangeSize: BigNumber.from(4),
                prize: ethers.utils.parseEther('1'),
                startTimestampOffset: BigNumber.from(1),
                endTimestampOffset: BigNumber.from(1),
                maxPicksPerUser: BigNumber.from(1001),
                expiryDuration: BigNumber.from(1000),
            };

            prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

            const draw1: Draw = newDraw({
                drawId: BigNumber.from(1),
                winningRandomNumber: BigNumber.from('1000'),
                timestamp: BigNumber.from(timestamps[0]),
            });

            await drawBuffer.mock.getDraws.returns([draw1]);
            await prizeDistributionBuffer.mock.getPrizeDistributions.returns([prizeDistribution]);

            const offsetStartTimestamps = modifyTimestampsWithOffset(
                timestamps,
                prizeDistribution.startTimestampOffset.toNumber(),
            );

            const offsetEndTimestamps = modifyTimestampsWithOffset(
                timestamps,
                prizeDistribution.startTimestampOffset.toNumber(),
            );

            await ticket.mock.getAverageBalancesBetween
                .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                .returns([utils.parseEther('0.000000000000000001')]); // (user, timestamp): [balance]

            await ticket.mock.getAverageTotalSuppliesBetween
                .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                .returns([utils.parseEther('1000')]);

            const result = await drawCalculator.getNormalizedBalancesForDrawIds(wallet1.address, [
                1,
            ]);

            expect(result[0]).to.eq(BigNumber.from(0));
        });
    });

    describe('calculate()', () => {
        const debug = newDebug('pt:DrawCalculator.test.ts:calculate()');

        context('with draw 1 set', () => {
            let prizeDistribution: PrizeDistribution;

            beforeEach(async () => {
                prizeDistribution = {
                    tiers: [ethers.utils.parseUnits('0.8', 9), ethers.utils.parseUnits('0.2', 9)],
                    numberOfPicks: BigNumber.from('10000'),
                    matchCardinality: BigNumber.from(5),
                    bitRangeSize: BigNumber.from(4),
                    prize: ethers.utils.parseEther('100'),
                    startTimestampOffset: BigNumber.from(1),
                    endTimestampOffset: BigNumber.from(1),
                    maxPicksPerUser: BigNumber.from(1001),
                    expiryDuration: BigNumber.from(1000),
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1])
                    .returns([prizeDistribution]);
            });

            it('should calculate and win grand prize', async () => {
                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const pickIndices = encoder.encode(['uint256[][]'], [[['1']]]);
                const ticketBalance = utils.parseEther('10');
                const totalSupply = utils.parseEther('100');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                const result = await drawCalculator.calculate(
                    wallet1.address,
                    [draw.drawId],
                    pickIndices,
                );

                expect(result[0][0]).to.equal(utils.parseEther('80'));
                const prizeCounts = encoder.decode(['uint256[][]'], result[1]);
                expect(prizeCounts[0][0][0]).to.equal(BigNumber.from(1)); // has a prizeCount = 1 at grand winner index
                assertEmptyArrayOfBigNumbers(prizeCounts[0][0].slice(1));

                debug(
                    'GasUsed for calculate(): ',
                    (
                        await drawCalculator.estimateGas.calculate(
                            wallet1.address,
                            [draw.drawId],
                            pickIndices,
                        )
                    ).toString(),
                );
            });

            it('should revert with expired draw', async () => {
                // set draw timestamp as now
                // set expiryDuration as 1 second

                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const pickIndices = encoder.encode(['uint256[][]'], [[['1']]]);
                const ticketBalance = utils.parseEther('10');
                const totalSupply = utils.parseEther('100');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                prizeDistribution = {
                    tiers: [ethers.utils.parseUnits('0.8', 9), ethers.utils.parseUnits('0.2', 9)],
                    numberOfPicks: BigNumber.from('10000'),
                    matchCardinality: BigNumber.from(5),
                    bitRangeSize: BigNumber.from(4),
                    prize: ethers.utils.parseEther('100'),
                    startTimestampOffset: BigNumber.from(1),
                    endTimestampOffset: BigNumber.from(1),
                    maxPicksPerUser: BigNumber.from(1001),
                    expiryDuration: BigNumber.from(1),
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1])
                    .returns([prizeDistribution]);

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                await expect(
                    drawCalculator.calculate(wallet1.address, [draw.drawId], pickIndices),
                ).to.revertedWith('DrawCalc/draw-expired');
            });

            it('should revert with repeated pick indices', async () => {
                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const pickIndices = encoder.encode(['uint256[][]'], [[['1', '1']]]); // this isn't valid
                const ticketBalance = utils.parseEther('10');
                const totalSupply = utils.parseEther('100');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                await expect(
                    drawCalculator.calculate(wallet1.address, [draw.drawId], pickIndices),
                ).to.revertedWith('DrawCalc/picks-ascending');
            });

            it('can calculate 1000 picks', async () => {
                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];

                const pickIndices = encoder.encode(
                    ['uint256[][]'],
                    [[[...new Array<number>(1000).keys()]]],
                );

                const totalSupply = utils.parseEther('10000');
                const ticketBalance = utils.parseEther('1000'); // 10 percent of total supply
                // prizeDistributions.numberOfPicks = 10000 so user has 1000 picks

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.endTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): balance

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                debug(
                    'GasUsed for calculate 1000 picks(): ',
                    (
                        await drawCalculator.estimateGas.calculate(
                            wallet1.address,
                            [draw.drawId],
                            pickIndices,
                        )
                    ).toString(),
                );
            });

            it('should match all numbers but prize tiers is 0 at index 0', async () => {
                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                prizeDistribution = {
                    ...prizeDistribution,
                    tiers: [
                        ethers.utils.parseUnits('0', 9), // NOTE ZERO here
                        ethers.utils.parseUnits('0.2', 9),
                    ],
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1])
                    .returns([prizeDistribution]);

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const pickIndices = encoder.encode(['uint256[][]'], [[['1']]]);
                const ticketBalance = utils.parseEther('10');
                const totalSupply = utils.parseEther('100');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                const prizesAwardable = await drawCalculator.calculate(
                    wallet1.address,
                    [draw.drawId],
                    pickIndices,
                );

                expect(prizesAwardable[0][0]).to.equal(utils.parseEther('0'));
            });

            it('should match all numbers but prize tiers is 0 at index 1', async () => {
                prizeDistribution = {
                    ...prizeDistribution,
                    bitRangeSize: BigNumber.from(2),
                    matchCardinality: BigNumber.from(3),
                    tiers: [
                        ethers.utils.parseUnits('0.1', 9), // NOTE ZERO here
                        ethers.utils.parseUnits('0', 9),
                        ethers.utils.parseUnits('0.2', 9),
                    ],
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1])
                    .returns([prizeDistribution]);

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const pickIndices = encoder.encode(['uint256[][]'], [[['1']]]);
                const ticketBalance = utils.parseEther('10');
                const totalSupply = utils.parseEther('100');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(
                        '25671298157762322557963155952891969742538148226988266342908289227085909174336',
                    ),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                const prizesAwardable = await drawCalculator.calculate(
                    wallet1.address,
                    [draw.drawId],
                    pickIndices,
                );

                expect(prizesAwardable[0][0]).to.equal(utils.parseEther('0'));
                const prizeCounts = encoder.decode(['uint256[][]'], prizesAwardable[1]);
                expect(prizeCounts[0][0][1]).to.equal(BigNumber.from(1)); // has a prizeCount = 1 at runner up index
                assertEmptyArrayOfBigNumbers(prizeCounts[0][0].slice(2));
            });

            it('runner up matches but tier is 0 at index 1', async () => {
                // cardinality 3
                // matches = 2
                // non zero tiers = 4
                prizeDistribution = {
                    ...prizeDistribution,
                    bitRangeSize: BigNumber.from(2),
                    matchCardinality: BigNumber.from(3),
                    tiers: [
                        ethers.utils.parseUnits('0.1', 9), 
                        ethers.utils.parseUnits('0', 9), // NOTE ZERO here
                        ethers.utils.parseUnits('0.1', 9),
                        ethers.utils.parseUnits('0.1', 9)
                    ],
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1])
                    .returns([prizeDistribution]);

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const pickIndices = encoder.encode(['uint256[][]'], [[['1']]]);
                const ticketBalance = utils.parseEther('10');
                const totalSupply = utils.parseEther('100');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): [balance]

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(
                        '25671298157762322557963155952891969742538148226988266342908289227085909174336',
                    ),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw]);

                const prizesAwardable = await drawCalculator.calculate(
                    wallet1.address,
                    [draw.drawId],
                    pickIndices,
                );
            
                expect(prizesAwardable[0][0]).to.equal(utils.parseEther('0'));
                const prizeCounts = encoder.decode(['uint256[][]'], prizesAwardable[1]);
                expect(prizeCounts[0][0][1]).to.equal(BigNumber.from(1)); // has a prizeCount = 1 at runner up index
                assertEmptyArrayOfBigNumbers(prizeCounts[0][0].slice(2));
            });

            it('should calculate for multiple picks, first pick grand prize winner, second pick no winnings', async () => {
                //function calculate(address user, uint256[] calldata randomNumbers, uint256[] calldata timestamps, uint256[] calldata prizes, bytes calldata data) external override view returns (uint256){

                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [
                    (await ethers.provider.getBlock('latest')).timestamp - 10,
                    (await ethers.provider.getBlock('latest')).timestamp - 5,
                ];

                const pickIndices = encoder.encode(['uint256[][]'], [[['1'], ['2']]]);
                const ticketBalance = utils.parseEther('10');
                const ticketBalance2 = utils.parseEther('10');
                const totalSupply1 = utils.parseEther('100');
                const totalSupply2 = utils.parseEther('100');

                const draw1: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                const draw2: Draw = newDraw({
                    drawId: BigNumber.from(2),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[1]),
                });

                await drawBuffer.mock.getDraws.returns([draw1, draw2]);

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.endTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance, ticketBalance2]); // (user, timestamp): balance

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply1, totalSupply2]);

                const prizeDistribution2: PrizeDistribution = {
                    tiers: [ethers.utils.parseUnits('0.8', 9), ethers.utils.parseUnits('0.2', 9)],
                    numberOfPicks: BigNumber.from(utils.parseEther('1')),
                    matchCardinality: BigNumber.from(5),
                    bitRangeSize: BigNumber.from(4),
                    prize: ethers.utils.parseEther('20'),
                    startTimestampOffset: BigNumber.from(1),
                    endTimestampOffset: BigNumber.from(1),
                    maxPicksPerUser: BigNumber.from(1001),
                    expiryDuration: BigNumber.from(1000),
                };

                prizeDistribution2.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                debug(`pushing settings for draw 2...`);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1, 2])
                    .returns([prizeDistribution, prizeDistribution2]);

                const result = await drawCalculator.calculate(
                    wallet1.address,
                    [draw1.drawId, draw2.drawId],
                    pickIndices,
                );

                expect(result[0][0]).to.equal(utils.parseEther('80'));
                expect(result[0][1]).to.equal(utils.parseEther('0'));

                const prizeCounts = encoder.decode(['uint256[][]'], result[1]);
                expect(prizeCounts[0][0][0]).to.equal(BigNumber.from(1)); // has a prizeCount = 1 at grand winner index for first draw
                expect(prizeCounts[0][1][0]).to.equal(BigNumber.from(0)); // has a prizeCount = 1 at grand winner index for second draw

                debug(
                    'GasUsed for 2 calculate() calls: ',
                    (
                        await drawCalculator.estimateGas.calculate(
                            wallet1.address,
                            [draw1.drawId, draw2.drawId],
                            pickIndices,
                        )
                    ).toString(),
                );
            });

            it('should not have enough funds for a second pick and revert', async () => {
                // the first draw the user has > 1 pick and the second draw has 0 picks (0.3/100 < 0.5 so rounds down to 0)
                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [
                    (await ethers.provider.getBlock('latest')).timestamp - 9,
                    (await ethers.provider.getBlock('latest')).timestamp - 5,
                ];
                const totalSupply1 = utils.parseEther('100');
                const totalSupply2 = utils.parseEther('100');

                const pickIndices = encoder.encode(['uint256[][]'], [[['1'], ['2']]]);
                const ticketBalance = ethers.utils.parseEther('6'); // they had 6pc of all tickets

                const prizeDistribution: PrizeDistribution = {
                    tiers: [ethers.utils.parseUnits('0.8', 9), ethers.utils.parseUnits('0.2', 9)],
                    numberOfPicks: BigNumber.from(1),
                    matchCardinality: BigNumber.from(5),
                    bitRangeSize: BigNumber.from(4),
                    prize: ethers.utils.parseEther('100'),
                    startTimestampOffset: BigNumber.from(1),
                    endTimestampOffset: BigNumber.from(1),
                    maxPicksPerUser: BigNumber.from(1001),
                    expiryDuration: BigNumber.from(1000),
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.endTimestampOffset.toNumber(),
                );

                const ticketBalance2 = ethers.utils.parseEther('0.3'); // they had 0.03pc of all tickets
                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance, ticketBalance2]); // (user, timestamp): balance

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply1, totalSupply2]);

                const draw1: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                const draw2: Draw = newDraw({
                    drawId: BigNumber.from(2),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[1]),
                });

                await drawBuffer.mock.getDraws.returns([draw1, draw2]);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([1, 2])
                    .returns([prizeDistribution, prizeDistribution]);

                await expect(
                    drawCalculator.calculate(
                        wallet1.address,
                        [draw1.drawId, draw2.drawId],
                        pickIndices,
                    ),
                ).to.revertedWith('DrawCalc/insufficient-user-picks');
            });

            it('should revert exceeding max user picks', async () => {
                // maxPicksPerUser is set to 2, user tries to claim with 3 picks
                const winningNumber = utils.solidityKeccak256(['address'], [wallet1.address]);
                const winningRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 1],
                );

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const totalSupply1 = utils.parseEther('100');
                const pickIndices = encoder.encode(['uint256[][]'], [[['1', '2', '3']]]);
                const ticketBalance = ethers.utils.parseEther('6');

                const prizeDistribution: PrizeDistribution = {
                    tiers: [ethers.utils.parseUnits('0.8', 9), ethers.utils.parseUnits('0.2', 9)],
                    numberOfPicks: BigNumber.from(1),
                    matchCardinality: BigNumber.from(5),
                    bitRangeSize: BigNumber.from(4),
                    prize: ethers.utils.parseEther('100'),
                    startTimestampOffset: BigNumber.from(1),
                    endTimestampOffset: BigNumber.from(1),
                    maxPicksPerUser: BigNumber.from(2),
                    expiryDuration: BigNumber.from(1000),
                };

                prizeDistribution.tiers = fillPrizeTiersWithZeros(prizeDistribution.tiers);

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.endTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): balance

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply1]);

                const draw1: Draw = newDraw({
                    drawId: BigNumber.from(2),
                    winningRandomNumber: BigNumber.from(winningRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw1]);

                await prizeDistributionBuffer.mock.getPrizeDistributions
                    .withArgs([2])
                    .returns([prizeDistribution]);

                await expect(
                    drawCalculator.calculate(wallet1.address, [draw1.drawId], pickIndices),
                ).to.revertedWith('DrawCalc/exceeds-max-user-picks');
            });

            it('should calculate and win nothing', async () => {
                const winningNumber = utils.solidityKeccak256(['address'], [wallet2.address]);
                const userRandomNumber = utils.solidityKeccak256(
                    ['bytes32', 'uint256'],
                    [winningNumber, 112312312],
                );

                const timestamps = [(await ethers.provider.getBlock('latest')).timestamp];
                const totalSupply = utils.parseEther('100');

                const pickIndices = encoder.encode(['uint256[][]'], [[['1']]]);
                const ticketBalance = utils.parseEther('10');

                const offsetStartTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.startTimestampOffset.toNumber(),
                );

                const offsetEndTimestamps = modifyTimestampsWithOffset(
                    timestamps,
                    prizeDistribution.endTimestampOffset.toNumber(),
                );

                await ticket.mock.getAverageBalancesBetween
                    .withArgs(wallet1.address, offsetStartTimestamps, offsetEndTimestamps)
                    .returns([ticketBalance]); // (user, timestamp): balance

                await ticket.mock.getAverageTotalSuppliesBetween
                    .withArgs(offsetStartTimestamps, offsetEndTimestamps)
                    .returns([totalSupply]);

                const draw1: Draw = newDraw({
                    drawId: BigNumber.from(1),
                    winningRandomNumber: BigNumber.from(userRandomNumber),
                    timestamp: BigNumber.from(timestamps[0]),
                });

                await drawBuffer.mock.getDraws.returns([draw1]);

                const prizesAwardable = await drawCalculator.calculate(
                    wallet1.address,
                    [draw1.drawId],
                    pickIndices,
                );

                expect(prizesAwardable[0][0]).to.equal(utils.parseEther('0'));
                const prizeCounts = encoder.decode(['uint256[][]'], prizesAwardable[1]);
                // there will always be a prizeCount at matchCardinality index
                assertEmptyArrayOfBigNumbers(
                    prizeCounts[0][0].slice(prizeDistribution.matchCardinality.toNumber() + 1),
                );
            });
        });
    });
});
