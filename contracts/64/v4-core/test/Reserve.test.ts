import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { getContractFactory, getSigners, utils } = ethers;
const { parseEther: toWei } = utils;

describe('Reserve', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;
    let reserve: Contract;
    let ticket: Contract;
    let ReserveHarnessFactory: ContractFactory;
    let erc20MintableFactory: ContractFactory;

    before(async () => {
        [wallet1, wallet2, wallet3] = await getSigners();

        erc20MintableFactory = await getContractFactory('ERC20Mintable');
        ReserveHarnessFactory = await getContractFactory('ReserveHarness');
    });

    beforeEach(async () => {
        ticket = await erc20MintableFactory.deploy('Ticket', 'TICK');
        reserve = await ReserveHarnessFactory.deploy(wallet1.address, ticket.address);
    });

    describe('getToken()', () => {
        it('should return the token address', async () => {
            expect(await reserve.getToken()).to.equal(ticket.address);
        });
    });

    describe('checkpoint()', () => {
        it('will succeed creating checkpoint with 0 balance', async () => {
            await expect(reserve.checkpoint()).to.not.emit(reserve, 'Checkpoint').withArgs(0, 0);
        });

        it('will succeed creating checkpoint with positive balance', async () => {
            await ticket.mint(reserve.address, toWei('100'));
            await expect(reserve.checkpoint())
                .to.emit(reserve, 'Checkpoint')
                .withArgs(toWei('100'), 0);
        });

        it('will succeed creating checkpoint with positive balance and after withdrawal', async () => {
            await ticket.mint(reserve.address, toWei('100'));

            await reserve.withdrawTo(wallet2.address, toWei('100'));

            await ticket.mint(reserve.address, toWei('100'));
            await expect(reserve.checkpoint())
                .to.emit(reserve, 'Checkpoint')
                .withArgs(toWei('200'), toWei('100'));
        });
        it('two checkpoints in a row, no event from second', async () => {
            await ticket.mint(reserve.address, toWei('100'));
            await reserve.checkpoint();

            await expect(reserve.checkpoint()).to.not.emit(reserve, 'Checkpoint');
        });

        it('two checkpoints same block', async () => {
            await ticket.mint(reserve.address, toWei('100'));
            await expect(reserve.doubleCheckpoint(ticket.address, toWei('50')))
                .to.emit(reserve, 'Checkpoint')
                .withArgs(toWei('100'), 0)
                .and.to.emit(reserve, 'Checkpoint')
                .withArgs(toWei('150'), 0);
        });
    });

    describe('getReserveAccumulatedBetween()', () => {
        context('with one observation', () => {
            it('start and end before observations', async () => {
                // s e |
                await reserve.setObservationsAt([{ timestamp: 5, amount: 70 }]);
                expect(await reserve.getReserveAccumulatedBetween(2, 3)).to.equal(0);
            });

            it('start before and end at observation', async () => {
                // s e|
                await reserve.setObservationsAt([{ timestamp: 5, amount: 70 }]);
                expect(await reserve.getReserveAccumulatedBetween(2, 5)).to.equal(70);
            });

            it('start and end around observation', async () => {
                // s | e
                await reserve.setObservationsAt([{ timestamp: 5, amount: 70 }]);
                expect(await reserve.getReserveAccumulatedBetween(2, 6)).to.equal(70);
            });

            it('start at and end after observation', async () => {
                // s| e
                await reserve.setObservationsAt([{ timestamp: 5, amount: 70 }]);
                expect(await reserve.getReserveAccumulatedBetween(5, 6)).to.equal(0);
            });
            it('start and end after observation', async () => {
                // | s e
                await reserve.setObservationsAt([{ timestamp: 5, amount: 70 }]);
                expect(await reserve.getReserveAccumulatedBetween(6, 7)).to.equal(0);
            });
        });

        context('with two observations', () => {
            it('start and end before observations', async () => {
                // s e []
                const observations = [
                    {
                        timestamp: 5,
                        amount: 70,
                    },
                    {
                        timestamp: 8,
                        amount: 72,
                    },
                ];
                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(2, 3);
                expect(result).to.equal(0);
            });

            it('start before and end inside', async () => {
                // s [ e ]
                const observations = [
                    {
                        timestamp: 5,
                        amount: 70,
                    },
                    {
                        timestamp: 8,
                        amount: 72,
                    },
                ];
                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(2, 6);
                expect(result).to.equal(70);
            });

            it('start before and end at first observation', async () => {
                // s [e ]
                const observations = [
                    {
                        timestamp: 5,
                        amount: 70,
                    },
                    {
                        timestamp: 8,
                        amount: 72,
                    },
                ];
                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(2, 5);
                expect(result).to.equal(70);
            });

            it('start before and end at second observation', async () => {
                // s [ e]
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(2, 8);
                expect(result).to.equal(72);
            });

            it('both start and end inside', async () => {
                // [ s e ]
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(6, 7);
                expect(result).to.equal(0);
            });

            it('start inside and end at second', async () => {
                // [ s e]
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(6, 8);
                expect(result).to.equal(2);
            });

            it('start at first and end at second', async () => {
                // [s e]
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(5, 8);
                expect(result).to.equal(2);
            });

            it('start inside and end after', async () => {
                // [ s ] e
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(6, 10);
                expect(result).to.equal(2);
            });

            it('start at end and end after', async () => {
                // [ s] e
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(8, 29);
                expect(result).to.equal(0);
            });

            it('start after and end after', async () => {
                // [] s e
                const observations = [
                    { timestamp: 5, amount: 70 },
                    { timestamp: 8, amount: 72 },
                ];

                await reserve.setObservationsAt(observations);
                const result = await reserve.getReserveAccumulatedBetween(18, 29);
                expect(result).to.equal(0);
            });
        });

        it('should revert if start timestamp is before end timestamp', async () => {
            await reserve.setObservationsAt([{ timestamp: 5, amount: 70 }]);

            await expect(reserve.getReserveAccumulatedBetween(3, 2)).to.be.revertedWith(
                'Reserve/start-less-then-end',
            );
        });

        it('should return 0 if no observation has been recorded', async () => {
            expect(await reserve.getReserveAccumulatedBetween(2, 3)).to.equal(0);
        });
    });

    describe('withdrawTo()', () => {
        it('should emit Checkpoint, Transfer and Withdrawn events', async () => {
            await ticket.mint(reserve.address, toWei('100'));
            await expect(reserve.withdrawTo(wallet2.address, toWei('10')))
                .to.emit(reserve, 'Checkpoint')
                .and.to.emit(ticket, 'Transfer')
                .and.to.emit(reserve, 'Withdrawn');

            it('should emit Checkpoint event', async () => {
                await ticket.mint(reserve.address, toWei('100'));
                await expect(reserve.withdrawTo(wallet2.address, toWei('10')))
                    .to.emit(reserve, 'Checkpoint')
                    .withArgs(toWei('100'), 0);
            });

            it('should emit Withdrawn event', async () => {
                await ticket.mint(reserve.address, toWei('100'));
                await expect(reserve.withdrawTo(wallet2.address, toWei('10')))
                    .and.to.emit(reserve, 'Withdrawn')
                    .withArgs(wallet2.address, toWei('10'));
                expect(await ticket.balanceOf(wallet2.address)).to.equal(toWei('10'));
            });
        });
    });
});
