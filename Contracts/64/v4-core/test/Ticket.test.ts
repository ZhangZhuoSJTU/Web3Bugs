import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { utils, Contract, ContractFactory, BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { delegateSignature } from './helpers/delegateSignature';
import { increaseTime as increaseTimeHelper } from './helpers/increaseTime';

const newDebug = require('debug');

const debug = newDebug('pt:Ticket.test.ts');

const { constants, getSigners, provider } = ethers;
const { AddressZero } = constants;
const { getBlock } = provider;
const { parseEther: toWei } = utils;

const increaseTime = (time: number) => increaseTimeHelper(provider, time);

async function deployTicketContract(
    ticketName: string,
    ticketSymbol: string,
    decimals: number,
    controllerAddress: string,
) {
    const ticketFactory: ContractFactory = await ethers.getContractFactory('TicketHarness');
    const ticketContract = await ticketFactory.deploy(
        ticketName,
        ticketSymbol,
        decimals,
        controllerAddress,
    );

    return ticketContract;
}

async function printTwabs(
    ticketContract: Contract,
    wallet: SignerWithAddress,
    debugLog: any = debug,
) {
    const context = await ticketContract.getAccountDetails(wallet.address);

    debugLog(
        `Twab Context for ${wallet.address}: { balance: ${ethers.utils.formatEther(
            context.balance,
        )}, nextTwabIndex: ${context.nextTwabIndex}, cardinality: ${context.cardinality}}`,
    );

    const twabs = [];

    for (var i = 0; i < context.cardinality; i++) {
        twabs.push(await ticketContract.getTwab(wallet.address, i));
    }

    twabs.forEach((twab, index) => {
        debugLog(`Twab ${index} { amount: ${twab.amount}, timestamp: ${twab.timestamp}}`);
    });

    return twabs;
}

describe('Ticket', () => {
    let ticket: Contract;

    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;
    let wallet4: SignerWithAddress;

    const ticketName = 'PoolTogether Dai Ticket';
    const ticketSymbol = 'PcDAI';
    const ticketDecimals = 18;

    beforeEach(async () => {
        [wallet1, wallet2, wallet3, wallet4] = await getSigners();

        ticket = await deployTicketContract(
            ticketName,
            ticketSymbol,
            ticketDecimals,
            wallet1.address,
        );

        // delegate for each of the users
        await ticket.delegate(wallet1.address);
        await ticket.connect(wallet2).delegate(wallet2.address);
        await ticket.connect(wallet3).delegate(wallet3.address);
        await ticket.connect(wallet4).delegate(wallet4.address);
    });

    describe('constructor()', () => {
        it('should initialize ticket', async () => {
            let ticket = await deployTicketContract(
                ticketName,
                ticketSymbol,
                ticketDecimals,
                wallet1.address,
            );

            expect(await ticket.name()).to.equal(ticketName);
            expect(await ticket.symbol()).to.equal(ticketSymbol);
            expect(await ticket.decimals()).to.equal(ticketDecimals);
            expect(await ticket.controller()).to.equal(wallet1.address);
        });

        it('should fail if token decimal is not greater than 0', async () => {
            await expect(
                deployTicketContract(ticketName, ticketSymbol, 0, wallet1.address),
            ).to.be.revertedWith('ControlledToken/decimals-gt-zero');
        });

        it('should fail if controller address is address 0', async () => {
            await expect(
                deployTicketContract(
                    ticketName,
                    ticketSymbol,
                    ticketDecimals,
                    constants.AddressZero,
                ),
            ).to.be.revertedWith('ControlledToken/controller-not-zero-address');
        });
    });

    describe('decimals()', () => {
        it('should return default decimals', async () => {
            expect(await ticket.decimals()).to.equal(18);
        });
    });

    describe('balanceOf()', () => {
        it('should return user balance', async () => {
            const mintBalance = toWei('1000');

            await ticket.mint(wallet1.address, mintBalance);

            expect(await ticket.balanceOf(wallet1.address)).to.equal(mintBalance);
        });
    });

    describe('totalSupply()', () => {
        it('should return total supply of tickets', async () => {
            const mintBalance = toWei('1000');

            await ticket.mint(wallet1.address, mintBalance);
            await ticket.mint(wallet2.address, mintBalance);

            expect(await ticket.totalSupply()).to.equal(mintBalance.mul(2));
        });
    });

    describe('flash loan attack', () => {
        let flashTimestamp: number;
        let mintTimestamp: number;

        beforeEach(async () => {
            await ticket.flashLoan(wallet1.address, toWei('100000'));
            flashTimestamp = (await provider.getBlock('latest')).timestamp;
            await increaseTime(10);

            await ticket.mint(wallet1.address, toWei('100'));
            mintTimestamp = (await provider.getBlock('latest')).timestamp;

            await increaseTime(20);
        });

        it('should not affect getBalanceAt()', async () => {
            expect(await ticket.getBalanceAt(wallet1.address, flashTimestamp - 1)).to.equal(0);
            expect(await ticket.getBalanceAt(wallet1.address, flashTimestamp)).to.equal(0);
            expect(await ticket.getBalanceAt(wallet1.address, flashTimestamp + 1)).to.equal(0);
        });

        it('should not affect getAverageBalanceBetween() for that time', async () => {
            expect(
                await ticket.getAverageBalanceBetween(
                    wallet1.address,
                    flashTimestamp - 1,
                    flashTimestamp + 1,
                ),
            ).to.equal(0);
        });

        it('should not affect subsequent twabs for getAverageBalanceBetween()', async () => {
            expect(
                await ticket.getAverageBalanceBetween(
                    wallet1.address,
                    mintTimestamp - 11,
                    mintTimestamp + 11,
                ),
            ).to.equal(toWei('50'));
        });
    });

    describe('_transfer()', () => {
        const mintAmount = toWei('2500');
        const transferAmount = toWei('1000');

        beforeEach(async () => {
            await ticket.mint(wallet1.address, mintAmount);
        });

        it('should transfer tickets from sender to recipient', async () => {
            expect(await ticket.transferTo(wallet1.address, wallet2.address, transferAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(wallet1.address, wallet2.address, transferAmount);

            await increaseTime(10);

            expect(
                await ticket.getBalanceAt(wallet2.address, (await getBlock('latest')).timestamp),
            ).to.equal(transferAmount);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount.sub(transferAmount));
        });

        it('should not perform any transfer if sender and recipient are the same', async () => {
            expect(await ticket.transferTo(wallet1.address, wallet1.address, transferAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(wallet1.address, wallet1.address, transferAmount);

            await increaseTime(10);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount);
        });

        it('should update delegate balance', async () => {
            await ticket.delegate(wallet3.address);
            await ticket.connect(wallet2).delegate(wallet4.address);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(
                await ticket.getBalanceAt(wallet2.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(
                await ticket.getBalanceAt(wallet3.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount);

            expect(
                await ticket.getBalanceAt(wallet4.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(await ticket.transferTo(wallet1.address, wallet2.address, transferAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(wallet1.address, wallet2.address, transferAmount);

            await increaseTime(10);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(
                await ticket.getBalanceAt(wallet2.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(
                await ticket.getBalanceAt(wallet3.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount.sub(transferAmount));

            expect(
                await ticket.getBalanceAt(wallet4.address, (await getBlock('latest')).timestamp),
            ).to.equal(transferAmount);
        });

        it('should fail to transfer tickets if sender address is address zero', async () => {
            await expect(
                ticket.transferTo(AddressZero, wallet2.address, transferAmount),
            ).to.be.revertedWith('ERC20: transfer from the zero address');
        });

        it('should fail to transfer tickets if receiver address is address zero', async () => {
            await expect(
                ticket.transferTo(wallet1.address, AddressZero, transferAmount),
            ).to.be.revertedWith('ERC20: transfer to the zero address');
        });

        it('should fail to transfer tickets if transfer amount exceeds sender balance', async () => {
            const insufficientMintAmount = toWei('5000');

            await expect(
                ticket.transferTo(wallet1.address, wallet2.address, insufficientMintAmount),
            ).to.be.revertedWith('Ticket/twab-burn-lt-balance');
        });
    });

    describe('_mint()', () => {
        const debug = newDebug('pt:Ticket.test.ts:_mint()');
        const mintAmount = toWei('1000');

        it('should mint tickets to user', async () => {
            expect(await ticket.mint(wallet1.address, mintAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(AddressZero, wallet1.address, mintAmount);

            await increaseTime(10);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount);

            expect(await ticket.totalSupply()).to.equal(mintAmount);
        });

        it('should update delegate balance', async () => {
            await ticket.delegate(wallet2.address);

            expect(await ticket.mint(wallet1.address, mintAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(AddressZero, wallet1.address, mintAmount);

            await increaseTime(10);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(
                await ticket.getBalanceAt(wallet2.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount);

            expect(await ticket.totalSupply()).to.equal(mintAmount);
        });

        it('should fail to mint tickets if user address is address zero', async () => {
            await expect(ticket.mint(AddressZero, mintAmount)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });

        it('should not record additional twabs when minting twice in the same block', async () => {
            expect(await ticket.mintTwice(wallet1.address, mintAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(AddressZero, wallet1.address, mintAmount);
            const timestamp = (await getBlock('latest')).timestamp;

            const twabs = await printTwabs(ticket, wallet1, debug);

            const matchingTwabs = twabs.reduce((all: any, twab: any) => {
                debug(`TWAB timestamp ${twab.timestamp}, timestamp: ${timestamp}`);
                debug(twab);
                if (twab.timestamp.toString() == timestamp.toString()) {
                    all.push(twab);
                }
                return all;
            }, []);

            expect(matchingTwabs.length).to.equal(1);
            expect(await ticket.totalSupply()).to.equal(mintAmount.mul(2));
        });
    });

    describe('_burn()', () => {
        const burnAmount = toWei('500');
        const mintAmount = toWei('1500');

        it('should burn tickets from user balance', async () => {
            await ticket.mint(wallet1.address, mintAmount);

            expect(await ticket.burn(wallet1.address, burnAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(wallet1.address, AddressZero, burnAmount);

            await increaseTime(1);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount.sub(burnAmount));

            expect(await ticket.totalSupply()).to.equal(mintAmount.sub(burnAmount));
        });

        it('should update delegate balance', async () => {
            await ticket.delegate(wallet2.address);
            await ticket.mint(wallet1.address, mintAmount);

            expect(await ticket.burn(wallet1.address, burnAmount))
                .to.emit(ticket, 'Transfer')
                .withArgs(wallet1.address, AddressZero, burnAmount);

            await increaseTime(1);

            expect(
                await ticket.getBalanceAt(wallet1.address, (await getBlock('latest')).timestamp),
            ).to.equal(toWei('0'));

            expect(
                await ticket.getBalanceAt(wallet2.address, (await getBlock('latest')).timestamp),
            ).to.equal(mintAmount.sub(burnAmount));

            expect(await ticket.totalSupply()).to.equal(mintAmount.sub(burnAmount));
        });

        it('should fail to burn tickets from user balance if user address is address zero', async () => {
            await expect(ticket.burn(AddressZero, mintAmount)).to.be.revertedWith(
                'ERC20: burn from the zero address',
            );
        });

        it('should fail to burn tickets from user balance if burn amount exceeds user balance', async () => {
            const insufficientMintAmount = toWei('250');

            await ticket.mint(wallet1.address, insufficientMintAmount);
            await ticket.mint(wallet2.address, mintAmount);

            await expect(ticket.burn(wallet1.address, mintAmount)).to.be.revertedWith(
                'Ticket/twab-burn-lt-balance',
            );
        });
    });

    describe('getAverageTotalSupplyBetween()', () => {
        const balanceBefore = toWei('1000');
        let timestamp: number;

        beforeEach(async () => {
            await ticket.mint(wallet1.address, balanceBefore);
            timestamp = (await getBlock('latest')).timestamp;
            debug(`minted ${ethers.utils.formatEther(balanceBefore)} @ timestamp ${timestamp}`);
        });

        it('should revert on unequal lenght inputs', async () => {
            const drawStartTimestamp = timestamp;
            const drawEndTimestamp = timestamp;

            await expect(
                ticket.getAverageBalancesBetween(
                    wallet1.address,
                    [drawStartTimestamp, drawStartTimestamp],
                    [drawEndTimestamp],
                ),
            ).to.be.revertedWith('Ticket/start-end-times-length-match');
        });

        it('should return an average of zero for pre-history requests', async () => {
            const drawStartTimestamp = timestamp - 100;
            const drawEndTimestamp = timestamp - 50;

            const result = await ticket.getAverageTotalSuppliesBetween(
                [drawStartTimestamp],
                [drawEndTimestamp],
            );

            result.forEach((res: any) => {
                expect(res).to.deep.equal(toWei('0'));
            });
        });

        it('should not project into the future', async () => {
            // at this time the user has held 1000 tokens for zero seconds
            const drawStartTimestamp = timestamp - 50;
            const drawEndTimestamp = timestamp + 50;

            const result = await ticket.getAverageTotalSuppliesBetween(
                [drawStartTimestamp],
                [drawEndTimestamp],
            );

            result.forEach((res: any) => {
                expect(res).to.deep.equal(toWei('0'));
            });
        });

        it('should return half the minted balance when the duration is centered over first twab', async () => {
            await increaseTime(100);
            const drawStartTimestamp = timestamp - 50;
            const drawEndTimestamp = timestamp + 50;

            const result = await ticket.getAverageTotalSuppliesBetween(
                [drawStartTimestamp],
                [drawEndTimestamp],
            );

            result.forEach((res: any) => {
                expect(res).to.deep.equal(toWei('500'));
            });
        });

        it('should return an accurate average when the range is after the last twab', async () => {
            await increaseTime(100);
            const drawStartTimestamp = timestamp + 50;
            const drawEndTimestamp = timestamp + 51;

            const result = await ticket.getAverageTotalSuppliesBetween(
                [drawStartTimestamp],
                [drawEndTimestamp],
            );

            result.forEach((res: any) => {
                expect(res).to.deep.equal(toWei('1000'));
            });
        });
    });

    describe('getAverageBalanceBetween()', () => {
        const debug = newDebug('pt:Ticket.test.ts:getAverageBalanceBetween()');
        const balanceBefore = toWei('1000');
        let timestamp: number;

        beforeEach(async () => {
            await ticket.mint(wallet1.address, balanceBefore);
            timestamp = (await getBlock('latest')).timestamp;
            debug(`minted ${ethers.utils.formatEther(balanceBefore)} @ timestamp ${timestamp}`);
        });

        it('should return an average of zero for pre-history requests', async () => {
            await printTwabs(ticket, wallet1, debug);

            expect(
                await ticket.getAverageBalanceBetween(
                    wallet1.address,
                    timestamp - 100,
                    timestamp - 50,
                ),
            ).to.equal(toWei('0'));
        });

        it('should not project into the future', async () => {
            // at this time the user has held 1000 tokens for zero seconds
            expect(
                await ticket.getAverageBalanceBetween(
                    wallet1.address,
                    timestamp - 50,
                    timestamp + 50,
                ),
            ).to.equal(toWei('0'));
        });

        it('should return half the minted balance when the duration is centered over first twab', async () => {
            await increaseTime(100);

            expect(
                await ticket.getAverageBalanceBetween(
                    wallet1.address,
                    timestamp - 50,
                    timestamp + 50,
                ),
            ).to.equal(toWei('500'));
        });

        it('should return an accurate average when the range is after the last twab', async () => {
            await increaseTime(100);

            expect(
                await ticket.getAverageBalanceBetween(
                    wallet1.address,
                    timestamp + 50,
                    timestamp + 51,
                ),
            ).to.equal(toWei('1000'));
        });

        context('with two twabs', () => {
            const transferAmount = toWei('500');
            let timestamp2: number;

            beforeEach(async () => {
                // they've held 1000 for t+100 seconds
                await increaseTime(100);

                debug(`Transferring ${ethers.utils.formatEther(transferAmount)}...`);
                // now transfer out 500

                await ticket.transfer(wallet2.address, transferAmount);
                timestamp2 = (await getBlock('latest')).timestamp;

                debug(`Transferred at time ${timestamp2}`);

                // they've held 500 for t+100+100 seconds
                await increaseTime(100);
            });

            it('should return an average of zero for pre-history requests', async () => {
                await ticket.getAverageBalanceTx(wallet1.address, timestamp - 100, timestamp - 50);

                debug(`Test getAverageBalance() : ${timestamp - 100}, ${timestamp - 50}`);

                expect(
                    await ticket.getAverageBalanceBetween(
                        wallet1.address,
                        timestamp - 100,
                        timestamp - 50,
                    ),
                ).to.equal(toWei('0'));
            });

            it('should return half the minted balance when the duration is centered over first twab', async () => {
                await printTwabs(ticket, wallet1, debug);

                debug(`Test getAverageBalance() : ${timestamp - 50}, ${timestamp + 50}`);

                expect(
                    await ticket.getAverageBalanceBetween(
                        wallet1.address,
                        timestamp - 50,
                        timestamp + 50,
                    ),
                ).to.equal(toWei('500'));
            });

            it('should return an accurate average when the range is between twabs', async () => {
                await ticket.getAverageBalanceTx(wallet1.address, timestamp + 50, timestamp + 55);

                debug(`Test getAverageBalance() : ${timestamp + 50}, ${timestamp + 55}`);

                expect(
                    await ticket.getAverageBalanceBetween(
                        wallet1.address,
                        timestamp + 50,
                        timestamp + 55,
                    ),
                ).to.equal(toWei('1000'));
            });

            it('should return an accurate average when the end is after the last twab', async () => {
                debug(`Test getAverageBalance() : ${timestamp2 - 50}, ${timestamp2 + 50}`);

                expect(
                    await ticket.getAverageBalanceBetween(
                        wallet1.address,
                        timestamp2 - 50,
                        timestamp2 + 50,
                    ),
                ).to.equal(toWei('750'));
            });

            it('should return an accurate average when the range is after twabs', async () => {
                debug(`Test getAverageBalance() : ${timestamp2 + 50}, ${timestamp2 + 51}`);

                expect(
                    await ticket.getAverageBalanceBetween(
                        wallet1.address,
                        timestamp2 + 50,
                        timestamp2 + 51,
                    ),
                ).to.equal(toWei('500'));
            });
        });
    });

    describe('getAverageBalancesBetween()', () => {
        const debug = newDebug('pt:Ticket.test.ts:getAverageBalancesBetween()');
        const balanceBefore = toWei('1000');
        let timestamp: number;

        beforeEach(async () => {
            await ticket.mint(wallet1.address, balanceBefore);
            timestamp = (await getBlock('latest')).timestamp;
            debug(`minted ${ethers.utils.formatEther(balanceBefore)} @ timestamp ${timestamp}`);
        });

        it('should revert on unequal lenght inputs', async () => {
            const drawStartTimestamp = timestamp;
            const drawEndTimestamp = timestamp;

            await expect(
                ticket.getAverageBalancesBetween(
                    wallet1.address,
                    [drawStartTimestamp, drawStartTimestamp],
                    [drawEndTimestamp],
                ),
            ).to.be.revertedWith('Ticket/start-end-times-length-match');
        });

        it('should return an average of zero for pre-history requests', async () => {
            const drawStartTimestamp = timestamp - 100;
            const drawEndTimestamp = timestamp - 50;

            const result = await ticket.getAverageBalancesBetween(
                wallet1.address,
                [drawStartTimestamp, drawStartTimestamp - 50],
                [drawEndTimestamp, drawEndTimestamp - 50],
            );

            result.forEach((res: any) => {
                expect(res).to.deep.equal(toWei('0'));
            });
        });

        it('should return half the minted balance when the duration is centered over first twab, and zero from before', async () => {
            await increaseTime(100);

            const drawStartTimestamp0 = timestamp - 100;
            const drawEndTimestamp0 = timestamp - 50;
            const drawStartTimestamp = timestamp - 50;
            const drawEndTimestamp = timestamp + 50;

            const result = await ticket.getAverageBalancesBetween(
                wallet1.address,
                [drawStartTimestamp, drawStartTimestamp0],
                [drawEndTimestamp, drawEndTimestamp0],
            );

            expect(result[0]).to.deep.equal(toWei('500'));
            expect(result[1]).to.deep.equal(toWei('0'));
        });
    });

    describe('getBalance()', () => {
        const balanceBefore = toWei('1000');

        beforeEach(async () => {
            await ticket.mint(wallet1.address, balanceBefore);
        });

        it('should get correct balance after a ticket transfer', async () => {
            const transferAmount = toWei('500');

            await increaseTime(60);

            const timestampBefore = (await getBlock('latest')).timestamp;

            await ticket.transfer(wallet2.address, transferAmount);

            // no-op register for gas usage
            await ticket.getBalanceTx(wallet1.address, timestampBefore);

            expect(await ticket.getBalanceAt(wallet1.address, timestampBefore)).to.equal(
                balanceBefore,
            );

            const timestampAfter = (await getBlock('latest')).timestamp;

            expect(await ticket.getBalanceAt(wallet1.address, timestampAfter)).to.equal(
                balanceBefore.sub(transferAmount),
            );
        });
    });

    describe('getBalancesAt()', () => {
        it('should get user balances', async () => {
            const mintAmount = toWei('2000');
            const transferAmount = toWei('500');

            await ticket.mint(wallet1.address, mintAmount);
            const mintTimestamp = (await getBlock('latest')).timestamp;

            await increaseTime(10);

            await ticket.transfer(wallet2.address, transferAmount);
            const transferTimestamp = (await getBlock('latest')).timestamp;

            await increaseTime(10);

            const balances = await ticket.getBalancesAt(wallet1.address, [
                mintTimestamp - 1,
                mintTimestamp,
                mintTimestamp + 1,
                transferTimestamp + 2,
            ]);

            expect(balances[0]).to.equal('0');

            // end of block balance is mint amount
            expect(balances[1]).to.equal(mintAmount);
            expect(balances[2]).to.equal(mintAmount);
            expect(balances[3]).to.equal(mintAmount.sub(transferAmount));
        });
    });

    describe('getTotalSupplyAt()', () => {
        const debug = newDebug('pt:Ticket.test.ts:getTotalSupplyAt()');

        context('after a mint', () => {
            const mintAmount = toWei('1000');
            let timestamp: number;

            beforeEach(async () => {
                await ticket.mint(wallet1.address, mintAmount);
                timestamp = (await getBlock('latest')).timestamp;
            });

            it('should return 0 before the mint', async () => {
                expect(await ticket.getTotalSupplyAt(timestamp - 50)).to.equal(0);
            });

            it('should return 0 at the time of the mint', async () => {
                expect(await ticket.getTotalSupplyAt(timestamp)).to.equal(mintAmount);
            });

            it('should return the value after the timestamp', async () => {
                const twab = await ticket.getTwab(wallet1.address, 0);

                debug(`twab: `, twab);
                debug(`Checking time ${timestamp + 1}`);

                await increaseTime(10);

                expect(await ticket.getTotalSupplyAt(timestamp + 1)).to.equal(mintAmount);
            });
        });
    });

    describe('getTotalSuppliesAt()', () => {
        const debug = newDebug('pt:Ticket.test.ts:getTotalSuppliesAt()');

        it('should get ticket total supplies', async () => {
            const mintAmount = toWei('2000');
            const burnAmount = toWei('500');

            await ticket.mint(wallet1.address, mintAmount);
            const mintTimestamp = (await getBlock('latest')).timestamp;
            debug(`mintTimestamp: ${mintTimestamp}`);

            await increaseTime(10);

            await ticket.burn(wallet1.address, burnAmount);
            const burnTimestamp = (await getBlock('latest')).timestamp;
            debug(`burnTimestamp: ${burnTimestamp}`);

            const totalSupplies = await ticket.getTotalSuppliesAt([
                mintTimestamp - 1,
                mintTimestamp,
                mintTimestamp + 1,
                burnTimestamp + 1,
            ]);

            debug(
                `Total supplies: ${totalSupplies.map((ts: any) => ethers.utils.formatEther(ts))}`,
            );

            expect(totalSupplies[0]).to.equal(toWei('0'));
            expect(totalSupplies[1]).to.equal(mintAmount);
            expect(totalSupplies[2]).to.equal(mintAmount);
            expect(totalSupplies[3]).to.equal(mintAmount.sub(burnAmount));
        });
    });

    describe('delegate()', () => {
        const debug = newDebug('pt:Ticket.test.ts:delegate()');

        it('should allow a user to delegate to another', async () => {
            await ticket.mint(wallet1.address, toWei('100'));

            await expect(ticket.delegate(wallet2.address))
                .to.emit(ticket, 'Delegated')
                .withArgs(wallet1.address, wallet2.address);

            const timestamp = (await provider.getBlock('latest')).timestamp;

            expect(await ticket.delegateOf(wallet1.address)).to.equal(wallet2.address);
            expect(await ticket.getBalanceAt(wallet1.address, timestamp)).to.equal(toWei('0'));
            expect(await ticket.getBalanceAt(wallet2.address, timestamp)).to.equal(toWei('100'));
        });

        it('should be a no-op if delegate address has already been set to passed address', async () => {
            await ticket.mint(wallet1.address, toWei('100'));
            await ticket.delegate(wallet2.address);

            await expect(ticket.delegate(wallet2.address)).to.not.emit(ticket, 'Delegated');
        });

        it('should allow the delegate to be reset by passing zero', async () => {
            await ticket.mint(wallet1.address, toWei('100'));
            await ticket.delegate(wallet2.address);

            const beforeTimestamp = (await provider.getBlock('latest')).timestamp;

            expect(await ticket.delegateOf(wallet1.address)).to.equal(wallet2.address);
            expect(await ticket.getBalanceAt(wallet2.address, beforeTimestamp)).to.equal(
                toWei('100'),
            );

            await ticket.delegate(AddressZero);

            const afterTimestamp = (await provider.getBlock('latest')).timestamp;

            expect(await ticket.delegateOf(wallet1.address)).to.equal(AddressZero);
            expect(await ticket.getBalanceAt(wallet2.address, afterTimestamp)).to.equal(toWei('0'));
            expect(await ticket.getBalanceAt(wallet1.address, afterTimestamp)).to.equal(toWei('0'));
        });

        it('should clear old delegates if any', async () => {
            await ticket.mint(wallet1.address, toWei('100'));

            const mintTimestamp = (await provider.getBlock('latest')).timestamp;
            debug(`mintTimestamp: ${mintTimestamp}`);

            await ticket.delegate(wallet2.address);

            const delegateTimestamp = (await provider.getBlock('latest')).timestamp;
            debug(`delegateTimestamp: ${delegateTimestamp}`);

            await ticket.delegate(wallet3.address);

            const secondTimestamp = (await provider.getBlock('latest')).timestamp;
            debug(`secondTimestamp: ${secondTimestamp}`);

            debug(`WALLET 2: ${wallet2.address}`);
            await printTwabs(ticket, wallet2, debug);

            debug(`WALLET 3: ${wallet3.address}`);
            await printTwabs(ticket, wallet3, debug);

            expect(await ticket.getBalanceAt(wallet1.address, delegateTimestamp)).to.equal(
                toWei('0'),
            );

            expect(await ticket.getBalanceAt(wallet2.address, mintTimestamp)).to.equal('0');

            // balance at the end of the block was zero
            expect(await ticket.getBalanceAt(wallet2.address, delegateTimestamp)).to.equal(
                toWei('100'),
            );

            expect(await ticket.delegateOf(wallet1.address)).to.equal(wallet3.address);
            expect(await ticket.getBalanceAt(wallet1.address, secondTimestamp)).to.equal(
                toWei('0'),
            );

            expect(await ticket.getBalanceAt(wallet2.address, secondTimestamp)).to.equal(
                toWei('0'),
            );

            expect(await ticket.getBalanceAt(wallet3.address, secondTimestamp)).to.equal(
                toWei('100'),
            );
        });
    });

    describe('delegateWithSignature()', () => {
        it('should allow somone to delegate with a signature', async () => {
            const { user, delegate, deadline, v, r, s } = await delegateSignature({
                ticket,
                userWallet: wallet1,
                delegate: wallet2.address,
            });

            await ticket.connect(wallet3).delegateWithSignature(user, delegate, deadline, v, r, s);

            expect(await ticket.delegateOf(wallet1.address)).to.equal(wallet2.address);
        });
    });

    describe('controllerDelegateFor', () => {
        it('should allow the controller to delegate for a user', async () => {
            await ticket.controllerDelegateFor(wallet2.address, wallet3.address);

            expect(await ticket.delegateOf(wallet2.address)).to.equal(wallet3.address);
        });

        it('should not allow anyone else to delegate', async () => {
            await expect(
                ticket.connect(wallet2).controllerDelegateFor(wallet1.address, wallet3.address),
            ).to.be.revertedWith('ControlledToken/only-controller');
        });
    });

    context('when the timestamp overflows', () => {
        let overflowMintTimestamp: number;

        beforeEach(async () => {
            await ticket.mint(wallet1.address, toWei('100'));
            const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
            const timeUntilOverflow = 2 ** 32 - timestamp;
            await increaseTime(timeUntilOverflow);
            await ticket.mint(wallet1.address, toWei('100'));
            overflowMintTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            await increaseTime(100);
        });

        describe('getAverageBalanceBetween()', () => {
            it('should function across overflow boundary', async () => {
                expect(
                    await ticket.getAverageBalanceBetween(
                        wallet1.address,
                        overflowMintTimestamp - 100,
                        overflowMintTimestamp + 100,
                    ),
                ).to.equal(toWei('150'));
            });
        });

        describe('getBalanceAt', () => {
            it('should function across overflow boundary', async () => {
                expect(await ticket.getBalanceAt(wallet1.address, overflowMintTimestamp)).to.equal(
                    toWei('200'),
                );
            });
        });
    });
});
