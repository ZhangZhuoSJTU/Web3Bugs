import { expect } from 'chai';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { ethers, artifacts } from 'hardhat';
import { Artifact } from 'hardhat/types';
import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants, Contract, ContractFactory } from 'ethers';

const { getSigners } = ethers;
const debug = require('debug')('ptv4:PrizeSplitStrategy');
const toWei = (val: string | number) => ethers.utils.parseEther('' + val);

describe('PrizeSplitStrategy', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;
    let prizeSplitStrategy: Contract;
    let ticket: Contract;
    let PrizePool: Artifact;
    let prizePool: MockContract;
    let prizeSplitStrategyFactory: ContractFactory;
    let erc20MintableFactory: ContractFactory;

    before(async () => {
        [wallet1, wallet2, wallet3] = await getSigners();

        prizeSplitStrategyFactory = await ethers.getContractFactory('PrizeSplitStrategyHarness');

        erc20MintableFactory = await ethers.getContractFactory('ERC20Mintable');

        PrizePool = await artifacts.readArtifact('PrizePool');
    });

    beforeEach(async () => {
        debug('mocking ticket and prizePool...');
        ticket = await erc20MintableFactory.deploy('Ticket', 'TICK');
        prizePool = await deployMockContract(wallet1 as Signer, PrizePool.abi);

        await prizePool.mock.getTicket.returns(ticket.address);

        debug('deploy prizeSplitStrategy...');
        prizeSplitStrategy = await prizeSplitStrategyFactory.deploy(
            wallet1.address,
            prizePool.address,
        );
    });

    /*============================================ */
    // Core Functions ----------------------------
    /*============================================ */
    describe('constructor', () => {
        it('should fail to set invalid prizeStrategy', async () => {
            await expect(
                prizeSplitStrategyFactory.deploy(wallet1.address, constants.AddressZero),
            ).to.be.revertedWith('PrizeSplitStrategy/prize-pool-not-zero-address');
        });

        it('should succeed to deploy', async () => {
            prizeSplitStrategy = await prizeSplitStrategyFactory.deploy(
                wallet1.address,
                prizePool.address,
            );
            expect(await prizeSplitStrategy.getPrizePool()).to.equal(prizePool.address);
        });
    });

    describe('Core Functions', () => {
        describe('distribute()', () => {
            it('should stop executing if captured interest is 0', async () => {
                await prizePool.mock.captureAwardBalance.returns(toWei('0'));
                await prizePool.mock.award.withArgs(wallet2.address, toWei('0')).returns();
                const distribute = await prizeSplitStrategy.distribute();
                await expect(distribute)
                    .to.not.emit(prizeSplitStrategy, 'Distributed')
                    .withArgs(toWei('100'));
            });

            it('should award 100% of the captured balance to the PrizeReserve', async () => {
                await prizeSplitStrategy.setPrizeSplits([
                    {
                        target: wallet2.address,
                        percentage: 1000,
                    },
                ]);

                await prizePool.mock.captureAwardBalance.returns(toWei('100'));
                await prizePool.mock.award.withArgs(wallet2.address, toWei('100')).returns();

                const distribute = await prizeSplitStrategy.distribute();

                await expect(distribute)
                    .to.emit(prizeSplitStrategy, 'Distributed')
                    .withArgs(toWei('100'));

                await expect(distribute)
                    .to.emit(prizeSplitStrategy, 'PrizeSplitAwarded')
                    .withArgs(wallet2.address, toWei('100'), ticket.address);
            });
        });
    });

    /*============================================ */
    // Getter Functions --------------------------
    /*============================================ */
    describe('Getter Functions', () => {
        it('should getPrizePool()', async () => {
            expect(await prizeSplitStrategy.getPrizePool()).to.equal(prizePool.address);
        });
        it('should prizeSplit()', async () => {
            await prizeSplitStrategy.setPrizeSplits([
                { target: wallet3.address, percentage: 1000 },
            ]);

            const pS = await prizeSplitStrategy.getPrizeSplit(0);

            expect(pS.target).to.equal(wallet3.address);
            expect(pS.percentage).to.equal(1000);
        });

        it('should prizeSplits()', async () => {
            await prizeSplitStrategy.setPrizeSplits([
                { target: wallet3.address, percentage: 500 },
                { target: wallet3.address, percentage: 500 },
            ]);

            const pS = await prizeSplitStrategy.getPrizeSplits();

            for (let index = 0; index < pS.length; index++) {
                const element = pS[index];
                expect(element.target).to.equal(wallet3.address);
                expect(element.percentage).to.equal(500);
            }
        });
    });
    /*============================================ */
    // Setter Functions --------------------------
    /*============================================ */
    describe('Setter Functions', () => {
        it('should setPrizeSplits()', async () => {
            expect(
                await prizeSplitStrategy.setPrizeSplits([
                    { target: wallet3.address, percentage: 1000 },
                ]),
            )
                .to.emit(prizeSplitStrategy, 'PrizeSplitSet')
                .withArgs(wallet3.address, 1000, 0);
        });

        it('should unset prizeSplits with an empty array passed to setPrizeSplits()', async () => {
            await prizeSplitStrategy.setPrizeSplits([
                { target: wallet3.address, percentage: 1000 },
            ]);

            expect(await prizeSplitStrategy.setPrizeSplits([]))
                .to.emit(prizeSplitStrategy, 'PrizeSplitRemoved')
                .withArgs(0);
        });
    });

    /*============================================ */
    // Internal Functions ----------------------------
    /*============================================ */
    describe('Internal Functions', () => {
        it('should awardPrizeSplitAmount()', async () => {
            await prizePool.mock.getTicket.returns(ticket.address);
            await prizePool.mock.award.returns();

            expect(await prizeSplitStrategy.awardPrizeSplitAmount(wallet3.address, toWei('100')))
                .to.emit(prizeSplitStrategy, 'PrizeSplitAwarded')
                .withArgs(wallet3.address, toWei('100'), ticket.address);
        });
    });
});
