import { ethers, artifacts } from 'hardhat';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { expect } from 'chai';

const { getSigners, utils } = ethers;
const { parseEther: toWei } = utils;

describe('PrizeDistributionFactory', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;

    let prizeDistributionFactory: Contract;
    let maxPickCost: BigNumber;

    let prizeDistributionFactoryFactory: ContractFactory;

    let prizeTierHistory: MockContract;
    let drawBuffer: MockContract;
    let prizeDistributionBuffer: MockContract;
    let ticket: MockContract;

    before(async () => {
        [wallet1, wallet2] = await getSigners();
        prizeDistributionFactoryFactory = await ethers.getContractFactory(
            'PrizeDistributionFactory',
        );
    });

    beforeEach(async () => {
        const IPrizeTierHistory = await artifacts.readArtifact('IPrizeTierHistory');
        const IDrawBuffer = await artifacts.readArtifact('IDrawBuffer');
        const IPrizeDistributionBuffer = await artifacts.readArtifact('IPrizeDistributionBuffer');
        const ITicket = await artifacts.readArtifact('ITicket');

        prizeTierHistory = await deployMockContract(wallet1, IPrizeTierHistory.abi);
        drawBuffer = await deployMockContract(wallet1, IDrawBuffer.abi);
        prizeDistributionBuffer = await deployMockContract(wallet1, IPrizeDistributionBuffer.abi);
        ticket = await deployMockContract(wallet1, ITicket.abi);

        maxPickCost = toWei('1');

        prizeDistributionFactory = await prizeDistributionFactoryFactory.deploy(
            wallet1.address,
            prizeTierHistory.address,
            drawBuffer.address,
            prizeDistributionBuffer.address,
            ticket.address,
            maxPickCost,
        );
    });

    const drawDefault = {
        winningRandomNumber: '0x1111111111111111111111111111111111111111111111111111111111111111',
        drawId: 1,
        timestamp: 1000,
        beaconPeriodStartedAt: 0,
        beaconPeriodSeconds: 100,
    };

    const prizeTierDefault = {
        bitRangeSize: 2,
        drawId: 1,
        maxPicksPerUser: 2,
        expiryDuration: 3600,
        endTimestampOffset: 300,
        prize: toWei('10'),
        tiers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };

    function createPrizeDistribution(prizeDistributionOptions: any = {}) {
        const prizeDistribution = {
            bitRangeSize: 2,
            matchCardinality: 6,
            startTimestampOffset: drawDefault.beaconPeriodSeconds,
            endTimestampOffset: prizeTierDefault.endTimestampOffset,
            maxPicksPerUser: prizeTierDefault.maxPicksPerUser,
            expiryDuration: prizeTierDefault.expiryDuration,
            numberOfPicks: ethers.BigNumber.from((2 ** 2) ** 6),
            tiers: prizeTierDefault.tiers,
            prize: prizeTierDefault.prize,
            ...prizeDistributionOptions,
        };
        if (!prizeDistributionOptions.numberOfPicks) {
            prizeDistribution.numberOfPicks = ethers.BigNumber.from(
                (2 ** prizeDistribution.bitRangeSize) ** prizeDistribution.matchCardinality,
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
        totalSupply: BigNumber = toWei('1000'),
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
                [draw.timestamp - prizeTier.endTimestampOffset],
            )
            .returns([totalSupply]);
    }

    describe('constructor()', () => {
        it('requires a pick cost > 0', async () => {
            await expect(
                prizeDistributionFactoryFactory.deploy(
                    wallet1.address,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                    ticket.address,
                    0,
                ),
            ).to.be.revertedWith('PDC/pick-cost-gt-zero');
        });

        it('requires owner != 0x0', async () => {
            await expect(
                prizeDistributionFactoryFactory.deploy(
                    ethers.constants.AddressZero,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                    ticket.address,
                    maxPickCost,
                ),
            ).to.be.revertedWith('PDC/owner-zero');
        });

        it('requires tier history != 0x0', async () => {
            await expect(
                prizeDistributionFactoryFactory.deploy(
                    wallet1.address,
                    ethers.constants.AddressZero,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                    ticket.address,
                    maxPickCost,
                ),
            ).to.be.revertedWith('PDC/pth-zero');
        });

        it('requires draw buffer != 0x0', async () => {
            await expect(
                prizeDistributionFactoryFactory.deploy(
                    wallet1.address,
                    prizeTierHistory.address,
                    ethers.constants.AddressZero,
                    prizeDistributionBuffer.address,
                    ticket.address,
                    maxPickCost,
                ),
            ).to.be.revertedWith('PDC/db-zero');
        });

        it('requires prize dist buffer != 0x0', async () => {
            await expect(
                prizeDistributionFactoryFactory.deploy(
                    wallet1.address,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    ethers.constants.AddressZero,
                    ticket.address,
                    maxPickCost,
                ),
            ).to.be.revertedWith('PDC/pdb-zero');
        });

        it('requires ticket != 0x0', async () => {
            await expect(
                prizeDistributionFactoryFactory.deploy(
                    wallet1.address,
                    prizeTierHistory.address,
                    drawBuffer.address,
                    prizeDistributionBuffer.address,
                    ethers.constants.AddressZero,
                    maxPickCost,
                ),
            ).to.be.revertedWith('PDC/ticket-zero');
        });
    });

    describe('calculatePrizeDistribution()', () => {
        it('should require that the passed total supply is gte ticket total supply', async () => {
            await setupMocks({}, {}, toWei('100'));

            await expect(
                prizeDistributionFactory.calculatePrizeDistribution(1, toWei('10')),
            ).to.be.revertedWith('PDF/invalid-network-supply');
        });

        it('should copy in all of the prize tier values', async () => {
            await setupMocks();

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1, toWei('1000')),
            );

            const prizeDistribution = createPrizeDistribution({ matchCardinality: 4 });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('ensure minimum cardinality is 1', async () => {
            await setupMocks({}, {}, toWei('0'));

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1, toWei('0')),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 1,
                numberOfPicks: toWei('0'),
            });

            expect(JSON.stringify(prizeDistributionObject)).to.equal(
                JSON.stringify(prizeDistribution),
            );
        });

        it('should handle when tickets equal total supply', async () => {
            await setupMocks({}, {}, toWei('100'));

            const prizeDistributionObject = toObject(
                await prizeDistributionFactory.calculatePrizeDistribution(1, toWei('100')),
            );

            const prizeDistribution = createPrizeDistribution({
                matchCardinality: 3,
                numberOfPicks: BigNumber.from(64),
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
            await expect(prizeDistributionFactory.pushPrizeDistribution(1, toWei('1000')))
                .to.emit(prizeDistributionFactory, 'PrizeDistributionPushed')
                .withArgs(1, toWei('1000'));
        });

        it('requires the manager or owner', async () => {
            await expect(
                prizeDistributionFactory.connect(wallet2).pushPrizeDistribution(1, toWei('1000')),
            ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
        });
    });

    describe('setPrizeDistribution()', () => {
        it('should push the prize distribution onto the buffer', async () => {
            await setupMocks();
            await prizeDistributionBuffer.mock.setPrizeDistribution.returns(1);
            await expect(prizeDistributionFactory.setPrizeDistribution(1, toWei('1000')))
                .to.emit(prizeDistributionFactory, 'PrizeDistributionSet')
                .withArgs(1, toWei('1000'));
        });

        it('requires the owner', async () => {
            await expect(
                prizeDistributionFactory.connect(wallet2).setPrizeDistribution(1, toWei('1000')),
            ).to.be.revertedWith('Ownable/caller-not-owner');
        });
    });
});
