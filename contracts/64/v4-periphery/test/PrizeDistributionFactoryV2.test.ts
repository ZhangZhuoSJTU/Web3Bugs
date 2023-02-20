import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { ethers, artifacts } from 'hardhat';

import { IPrizeTierHistoryV2 } from '../types/contracts/interfaces/IPrizeTierHistoryV2';

const { constants, getContractFactory, getSigners, utils } = ethers;
const { AddressZero, Zero } = constants;
const { parseEther: toWei, parseUnits } = utils;

describe('PrizeDistributionFactoryV2', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;

    let prizeDistributionFactory: Contract;

    let prizeTierHistory: MockContract;
    let drawBuffer: MockContract;
    let prizeDistributionBuffer: MockContract;
    let ticket: MockContract;

    let isConstructorTest = false;

    const deployPrizeDistributionFactory = async (
        owner = wallet1.address,
        prizeTierHistoryAddress = prizeTierHistory.address,
        drawBufferAddress = drawBuffer.address,
        prizeDistributionBufferAddress = prizeDistributionBuffer.address,
        ticketAddress = ticket.address,
        minPickCost = toWei('1'),
    ) => {
        const PrizeDistributionFactory = await getContractFactory('PrizeDistributionFactoryV2');

        return await PrizeDistributionFactory.deploy(
            owner,
            prizeTierHistoryAddress,
            drawBufferAddress,
            prizeDistributionBufferAddress,
            ticketAddress,
            minPickCost,
        );
    };

    beforeEach(async () => {
        [wallet1, wallet2] = await getSigners();

        const IPrizeTierHistoryV2 = await artifacts.readArtifact('IPrizeTierHistoryV2');
        const IDrawBuffer = await artifacts.readArtifact('IDrawBuffer');
        const IPrizeDistributionBuffer = await artifacts.readArtifact('IPrizeDistributionBuffer');
        const ITicket = await artifacts.readArtifact('ITicket');

        prizeTierHistory = await deployMockContract(wallet1, IPrizeTierHistoryV2.abi);

        drawBuffer = await deployMockContract(wallet1, IDrawBuffer.abi);
        prizeDistributionBuffer = await deployMockContract(wallet1, IPrizeDistributionBuffer.abi);

        ticket = await deployMockContract(wallet1, ITicket.abi);

        if (!isConstructorTest) {
            prizeDistributionFactory = await deployPrizeDistributionFactory();
        }
    });

    const drawDefault = {
        winningRandomNumber: '0x1111111111111111111111111111111111111111111111111111111111111111',
        drawId: 1,
        timestamp: 1000,
        beaconPeriodStartedAt: 0,
        beaconPeriodSeconds: 100,
    };

    const dprDefault = '0.1'; // 10%
    const dpr = parseUnits(dprDefault, '9');
    const prizeDefault = '10';
    const prize = toWei(prizeDefault);
    const totalSupplyDefault = '1000';

    const prizeTierDefault: IPrizeTierHistoryV2.PrizeTierV2Struct = {
        bitRangeSize: 2,
        drawId: 1,
        maxPicksPerUser: 2,
        expiryDuration: 3600,
        endTimestampOffset: 300,
        dpr,
        prize,
        tiers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };

    const calculateNumberOfPicks = (
        bitRangeSize: number,
        cardinality: number,
        prize: number,
        dpr: number,
        totalSupply: number,
    ) => {
        const odds = BigNumber.from((dpr * totalSupply) / prize);
        const totalPicks = BigNumber.from((2 ** bitRangeSize) ** cardinality);

        return totalPicks.mul(odds);
    };

    function createPrizeDistribution(
        prizeDistributionOptions: any = {},
        totalSupply = totalSupplyDefault,
        dpr = dprDefault,
        prize = prizeDefault,
    ) {
        const prizeDistribution = {
            bitRangeSize: 2,
            matchCardinality: 6,
            startTimestampOffset: drawDefault.beaconPeriodSeconds,
            endTimestampOffset: prizeTierDefault.endTimestampOffset,
            maxPicksPerUser: prizeTierDefault.maxPicksPerUser,
            expiryDuration: prizeTierDefault.expiryDuration,
            numberOfPicks: BigNumber.from((2 ** 2) ** 6),
            tiers: prizeTierDefault.tiers,
            prize: prizeTierDefault.prize,
            ...prizeDistributionOptions,
        };

        if (!prizeDistributionOptions.numberOfPicks) {
            prizeDistribution.numberOfPicks = calculateNumberOfPicks(
                prizeDistribution.bitRangeSize,
                prizeDistribution.matchCardinality,
                Number(prize),
                Number(dpr),
                Number(totalSupply),
            );
        }

        return prizeDistribution;
    }

    function toObject(prizeDistributionResult: any) {
        const {
            bitRangeSize,
            matchCardinality,
            startTimestampOffset,
            endTimestampOffset,
            maxPicksPerUser,
            expiryDuration,
            numberOfPicks,
            tiers,
            prize,
        } = prizeDistributionResult;
        return {
            bitRangeSize,
            matchCardinality,
            startTimestampOffset,
            endTimestampOffset,
            maxPicksPerUser,
            expiryDuration,
            numberOfPicks,
            tiers,
            prize,
        };
    }

    async function setupMocks(
        drawOptions = {},
        prizeTierOptions = {},
        totalSupply = toWei(totalSupplyDefault),
    ) {
        const draw = {
            ...drawDefault,
            ...drawOptions,
        };

        await drawBuffer.mock.getDraw.withArgs(draw.drawId).returns(draw);

        const prizeTier = {
            ...prizeTierDefault,
            ...prizeTierOptions,
        };

        await prizeTierHistory.mock.getPrizeTier.withArgs(draw.drawId).returns(prizeTier);

        await ticket.mock.getAverageTotalSuppliesBetween
            .withArgs(
                [draw.timestamp - draw.beaconPeriodSeconds],
                [draw.timestamp - Number(prizeTier.endTimestampOffset)],
            )
            .returns([totalSupply]);
    }

    describe('constructor()', () => {
        before(() => (isConstructorTest = true));

        before(() => (isConstructorTest = false));

        it('requires owner != 0x0', async () => {
            await expect(deployPrizeDistributionFactory(AddressZero)).to.be.revertedWith(
                'PDC/owner-zero',
            );
        });

        it('requires tier history != 0x0', async () => {
            await expect(
                deployPrizeDistributionFactory(wallet1.address, AddressZero),
            ).to.be.revertedWith('PDC/pth-zero');
        });

        it('requires draw buffer != 0x0', async () => {
            await expect(
                deployPrizeDistributionFactory(
                    wallet1.address,
                    prizeTierHistory.address,
                    AddressZero,
                ),
            ).to.be.revertedWith('PDC/db-zero');
        });

        it('requires prize dist buffer != 0x0', async () => {
            await expect(
                deployPrizeDistributionFactory(
                    wallet1.address,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    AddressZero,
                ),
            ).to.be.revertedWith('PDC/pdb-zero');
        });

        it('requires ticket != 0x0', async () => {
            await expect(
                deployPrizeDistributionFactory(
                    wallet1.address,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                    AddressZero,
                ),
            ).to.be.revertedWith('PDC/ticket-zero');
        });

        it('requires a minPickCost > 0', async () => {
            await expect(
                deployPrizeDistributionFactory(
                    wallet1.address,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                    ticket.address,
                    Zero,
                ),
            ).to.be.revertedWith('PDC/pick-cost-gt-zero');
        });
    });

    describe('calculatePrizeDistribution()', () => {
        it('should copy in all of the prize tier values', async () => {
            await setupMocks();

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({ matchCardinality: 3 });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('ensure minimum cardinality is 1', async () => {
            await setupMocks({}, {}, toWei('0'));

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 1,
                numberOfPicks: toWei('0'),
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle when ticket supply equals prize', async () => {
            const prize = toWei(totalSupplyDefault);
            await setupMocks({}, { prize });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 6,
                numberOfPicks: BigNumber.from(409),
                prize,
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle when prize is greater than ticket supply', async () => {
            const prize = parseUnits(totalSupplyDefault, 26);
            await setupMocks({}, { prize });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 19,
                numberOfPicks: BigNumber.from(274),
                prize,
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should not allocate any picks if prize is way greater than ticket supply', async () => {
            // If prize is 1e9+ greater than dpr * totalSupply, odds will truncate down and return 0
            const prize = parseUnits(totalSupplyDefault, 27);
            await setupMocks({}, { prize });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 1,
                numberOfPicks: BigNumber.from(0),
                prize,
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle when ticket supply is way greater than prize', async () => {
            const totalSupply = parseUnits(totalSupplyDefault, 46);
            await setupMocks({}, {}, totalSupply);

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 3,
                numberOfPicks: parseUnits('64', 29),
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should revert if numberOfPicks does not fit in 104 bits', async () => {
            const totalSupply = parseUnits(totalSupplyDefault, 47);
            await setupMocks({}, {}, totalSupply);

            await expect(prizeDistributionFactory.calculatePrizeDistribution(1)).to.be.revertedWith(
                "SafeCast: value doesn't fit in 104 bits",
            );
        });

        it('should handle when the dpr is extremely low', async () => {
            await setupMocks({}, { dpr: parseUnits('0.000000001', '9') });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 16,
                numberOfPicks: BigNumber.from(429),
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle when the dpr is high', async () => {
            await setupMocks({}, { dpr: parseUnits('1', '9') });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 1,
                numberOfPicks: BigNumber.from(400),
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle a high cost per pick', async () => {
            await setupMocks({}, { dpr: parseUnits('0.00015259', '9') });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 7,
                numberOfPicks: BigNumber.from(250),
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle a low cost per pick', async () => {
            const prize = toWei('1');
            await setupMocks({}, { dpr: parseUnits('1', '9'), prize });

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 1,
                numberOfPicks: BigNumber.from(4000),
                prize,
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });
    });

    describe('pushPrizeDistribution()', () => {
        it('should push the prize distribution onto the buffer', async () => {
            await setupMocks();
            await prizeDistributionBuffer.mock.pushPrizeDistribution.returns(true);

            await expect(prizeDistributionFactory.pushPrizeDistribution(1))
                .to.emit(prizeDistributionFactory, 'PrizeDistributionPushed')
                .withArgs(1);
        });
    });

    describe('setPrizeDistribution()', () => {
        it('should set the prize distribution onto the buffer', async () => {
            await setupMocks();
            await prizeDistributionBuffer.mock.setPrizeDistribution.returns(1);
            await expect(prizeDistributionFactory.setPrizeDistribution(1))
                .to.emit(prizeDistributionFactory, 'PrizeDistributionSet')
                .withArgs(1);
        });

        it('should fail to set if not owner', async () => {
            await expect(
                prizeDistributionFactory.connect(wallet2).setPrizeDistribution(1),
            ).to.be.revertedWith('Ownable/caller-not-owner');
        });
    });
});
