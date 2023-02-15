import { expect } from 'chai';
import { ethers, artifacts } from 'hardhat';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';

const { constants, getSigners, utils } = ethers;
const { AddressZero } = constants;
const { parseEther: toWei } = utils;

describe('PrizeFlush', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;

    let prizeFlush: Contract;
    let reserve: Contract;
    let ticket: Contract;
    let strategy: MockContract;
    let prizeFlushFactory: ContractFactory;
    let reserveFactory: ContractFactory;
    let erc20MintableFactory: ContractFactory;
    let prizeSplitStrategyFactory: ContractFactory;

    let destination: string;

    before(async () => {
        [wallet1, wallet2, wallet3] = await getSigners();

        destination = wallet3.address;
        erc20MintableFactory = await ethers.getContractFactory('ERC20Mintable');
        prizeFlushFactory = await ethers.getContractFactory('PrizeFlush');
        reserveFactory = await ethers.getContractFactory('ReserveHarness');
        prizeSplitStrategyFactory = await ethers.getContractFactory('PrizeSplitStrategy');

        let PrizeSplitStrategy = await artifacts.readArtifact('PrizeSplitStrategy');
        strategy = await deployMockContract(wallet1, PrizeSplitStrategy.abi);
    });

    beforeEach(async () => {
        ticket = await erc20MintableFactory.deploy('Ticket', 'TICK');
        reserve = await reserveFactory.deploy(wallet1.address, ticket.address);
        prizeFlush = await prizeFlushFactory.deploy(
            wallet1.address,
            destination,
            strategy.address,
            reserve.address,
        );
        await reserve.setManager(prizeFlush.address);
    });

    describe('Getters', () => {
        it('should get the destination address', async () => {
            expect(await prizeFlush.getDestination()).to.equal(destination);
        });
        it('should get the strategy address', async () => {
            expect(await prizeFlush.getStrategy()).to.equal(strategy.address);
        });
        it('should get the reserve address', async () => {
            expect(await prizeFlush.getReserve()).to.equal(reserve.address);
        });
    });

    describe('Setters', () => {
        it('should fail to set the destination address if not called by owner', async () => {
            await expect(
                prizeFlush.connect(wallet3 as unknown as Signer).setDestination(wallet3.address),
            ).to.revertedWith('Ownable/caller-not-owner');
        });

        it('should fail to set the destination address if address zero is passed', async () => {
            await expect(prizeFlush.setDestination(AddressZero)).to.revertedWith(
                'Flush/destination-not-zero-address',
            );
        });

        it('should set the destination address', async () => {
            await expect(prizeFlush.setDestination(wallet3.address)).to.emit(
                prizeFlush,
                'DestinationSet',
            );
        });

        it('should fail to set the strategy address', async () => {
            await expect(
                prizeFlush.connect(wallet3 as unknown as Signer).setStrategy(wallet3.address),
            ).to.revertedWith('Ownable/caller-not-owner');
        });

        it('should fail to set the strategy address if address zero is passed', async () => {
            await expect(prizeFlush.setStrategy(AddressZero)).to.revertedWith(
                'Flush/strategy-not-zero-address',
            );
        });

        it('should set the strategy address', async () => {
            await expect(prizeFlush.setStrategy(wallet3.address)).to.emit(
                prizeFlush,
                'StrategySet',
            );
        });

        it('should fail to set the reserve address', async () => {
            await expect(
                prizeFlush.connect(wallet3 as unknown as Signer).setReserve(wallet3.address),
            ).to.revertedWith('Ownable/caller-not-owner');
        });

        it('should fail to set the reserve address if address zero is passed', async () => {
            await expect(prizeFlush.setReserve(AddressZero)).to.revertedWith(
                'Flush/reserve-not-zero-address',
            );
        });

        it('should set the reserve address', async () => {
            await strategy.mock.distribute.returns(toWei('0'));
            await expect(prizeFlush.setReserve(wallet3.address)).to.emit(prizeFlush, 'ReserveSet');
        });
    });

    describe('Core', () => {
        describe('flush()', () => {
            it('should succeed to flush prizes if positive balance on reserve.', async () => {
                await strategy.mock.distribute.returns(toWei('100'));
                await ticket.mint(reserve.address, toWei('100'));
                await expect(prizeFlush.flush())
                    .to.emit(prizeFlush, 'Flushed')
                    .and.to.emit(reserve, 'Withdrawn');
            });

            it('should succeed to flush if manager', async () => {
                await strategy.mock.distribute.returns(toWei('100'));
                await ticket.mint(reserve.address, toWei('100'));

                await prizeFlush.setManager(wallet2.address);

                await expect(prizeFlush.connect(wallet2).flush())
                    .to.emit(prizeFlush, 'Flushed')
                    .and.to.emit(reserve, 'Withdrawn');
            });

            it('should fail to flush if not manager or owner', async () => {
                await prizeFlush.setManager(wallet2.address);

                await expect(prizeFlush.connect(wallet3).flush()).to.be.revertedWith(
                    'Manageable/caller-not-manager-or-owner',
                );
            });

            it('should fail to flush if zero balance on reserve', async () => {
                await strategy.mock.distribute.returns(toWei('0'));
                await expect(prizeFlush.flush()).to.not.emit(prizeFlush, 'Flushed');
            });
        });
    });
});
