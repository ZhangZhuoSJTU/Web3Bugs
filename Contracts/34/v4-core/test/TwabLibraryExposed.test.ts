import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { utils, Contract, ContractFactory, BigNumber } from 'ethers';
import { ethers } from 'hardhat';

const { getSigners } = ethers;
const { parseEther: toWei } = utils;

describe('TwabLib', () => {
    let cardinality: number;
    let twabLib: Contract;

    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;

    beforeEach(async () => {
        [wallet1, wallet2] = await getSigners();

        const twabLibFactory: ContractFactory = await ethers.getContractFactory('TwabLibExposed');
        twabLib = await twabLibFactory.deploy();
        cardinality = await twabLib.MAX_CARDINALITY();
    });

    describe('increaseBalance()', () => {
        const timestamp = 100;
        const currentTime = 200;

        it('should create a new record', async () => {
            await expect(twabLib.increaseBalance(100, timestamp))
                .to.emit(twabLib, 'Updated')
                .withArgs([100, 1, 1], [0, timestamp], true);

            expect(await twabLib.getBalanceAt(timestamp, currentTime)).to.equal(100);
        });

        it('should not create a new record when the timestamp is the same', async () => {
            await twabLib.increaseBalance(100, timestamp);

            await expect(twabLib.increaseBalance(100, timestamp))
                .to.emit(twabLib, 'Updated')
                .withArgs([200, 1, 1], [0, timestamp], false);
        });

        it('should add second twab', async () => {
            await expect(twabLib.increaseBalance(100, timestamp))
                .to.emit(twabLib, 'Updated')
                .withArgs([100, 1, 1], [0, timestamp], true);

            await expect(twabLib.increaseBalance(100, timestamp + 1000))
                .to.emit(twabLib, 'Updated')
                .withArgs([200, 2, 2], [100000, timestamp + 1000], true);
        });
    });

    describe('oldestTwab() newestTwab()', () => {
        const timestamp = 100;

        it('should get the oldest twab', async () => {
            await twabLib.increaseBalance(100, timestamp);
            await twabLib.increaseBalance(100, timestamp + 10);

            expect((await twabLib.oldestTwab())[1].timestamp).to.equal(timestamp);
            expect((await twabLib.newestTwab())[1].timestamp).to.equal(timestamp + 10);
        });
    });

    describe('getAverageBalanceBetween()', () => {
        context('with one twab', () => {
            const currentBalance = 1000;
            let timestamp = 1000;
            let currentTime = 2000;

            beforeEach(async () => {
                await twabLib.increaseBalance(currentBalance, timestamp);
            });

            it('should return an average of zero for pre-history requests', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp - 100,
                        timestamp - 50,
                        currentTime,
                    ),
                ).to.equal('0');
            });

            it('should return an average of zero for pre-history requests when including the first twab', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(timestamp - 100, timestamp, currentTime),
                ).to.equal('0');
            });

            it('should not project into the future', async () => {
                // at this time the user has held 1000 tokens for zero seconds
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp - 50,
                        timestamp + 50,
                        timestamp,
                    ),
                ).to.equal('0');
            });

            it('should return half the minted balance when the duration is centered over first twab', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp - 50,
                        timestamp + 50,
                        currentTime,
                    ),
                ).to.equal('500');
            });

            it('should return an accurate average when the range is after the last twab', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp + 50,
                        timestamp + 51,
                        currentTime,
                    ),
                ).to.equal('1000');
            });
        });

        context('with two twabs', () => {
            const mintAmount = toWei('1000');
            const transferAmount = toWei('500');
            let timestamp1 = 1000;
            let timestamp2 = 2000;
            let currentTime = 3000;

            beforeEach(async () => {
                await twabLib.increaseBalance(mintAmount, timestamp1);
                await twabLib.decreaseBalance(transferAmount, 'insufficient-balance', timestamp2);
            });

            /*
      | |   < >
      | < | >
      | <| >
      < | | >
      < | > |
      < > | |
      */

            it('should return an average of zero for pre-history requests', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp1 - 100,
                        timestamp1 - 50,
                        currentTime,
                    ),
                ).to.equal(toWei('0'));
            });

            it('should return half the minted balance when the duration is centered over first twab', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp1 - 50,
                        timestamp1 + 50,
                        currentTime,
                    ),
                ).to.equal(toWei('500'));
            });

            it('should return an accurate average when the range is between twabs', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp1 + 50,
                        timestamp1 + 55,
                        currentTime,
                    ),
                ).to.equal(toWei('1000'));
            });

            it('should return an accurate average when the end is after the last twab', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp2 - 50,
                        timestamp2 + 50,
                        currentTime,
                    ),
                ).to.equal(toWei('750'));
            });

            it('should return an accurate average when the range is after twabs', async () => {
                expect(
                    await twabLib.getAverageBalanceBetween(
                        timestamp2 + 50,
                        timestamp2 + 51,
                        currentTime,
                    ),
                ).to.equal(toWei('500'));
            });
        });
    });

    describe('getBalanceAt', () => {
        context('with one twab', () => {
            const currentBalance = toWei('1000');
            let timestamp = 1000;
            let currentTime = 2000;

            beforeEach(async () => {
                await twabLib.increaseBalance(currentBalance, timestamp);
            });

            it('should return 0 for time before twabs', async () => {
                expect(await twabLib.getBalanceAt(500, currentTime)).to.equal(0);
            });

            it('should return the current balance if time at or after last twab', async () => {
                expect(await twabLib.getBalanceAt(timestamp, currentTime)).to.equal(currentBalance);
            });

            it('should return the current balance after the twab', async () => {
                expect(await twabLib.getBalanceAt(1500, currentTime)).to.equal(currentBalance);
            });
        });

        context('with two twabs', () => {
            const mintAmount = toWei('1000');
            const transferAmount = toWei('500');

            let timestamp1 = 1;
            let timestamp2 = 3;
            let currentTime = 3000;

            beforeEach(async () => {
                await twabLib.increaseBalance(mintAmount, timestamp1);
                await twabLib.decreaseBalance(transferAmount, 'insufficient-balance', timestamp2);
            });

            /*
      Legend: < > = twabs start and end, | = timestamp

      | < > = before first twab
      |< > = at same time as first twab
      < | > = between twabs
      < |> = at same time as last twab
      < > | = after last twab
      */

            it('should return zero when request before first twab', async () => {
                expect(await twabLib.getBalanceAt(timestamp1 - 1, currentTime)).to.equal(
                    toWei('0'),
                );
            });

            it('should return end-of-block balance when request is on first twab', async () => {
                expect(await twabLib.getBalanceAt(timestamp1, currentTime)).to.equal(mintAmount);
            });

            it('should return mint amount when between twabs', async () => {
                expect(await twabLib.getBalanceAt(timestamp1 + 1, currentTime)).to.equal(
                    mintAmount,
                );
            });

            it('should return current balance when on last twab', async () => {
                expect(await twabLib.getBalanceAt(timestamp2, currentTime)).to.equal(
                    mintAmount.sub(transferAmount),
                );
            });

            it('should return current balance when after last twab', async () => {
                expect(await twabLib.getBalanceAt(timestamp2 + 50, currentTime)).to.equal(
                    mintAmount.sub(transferAmount),
                );
            });
        });

        describe('with problematic query', () => {
            beforeEach(async () => {
                await twabLib.increaseBalance('100000000000000000000', 1630713395);
                await twabLib.decreaseBalance(
                    '100000000000000000000',
                    'revert-message',
                    1630713396,
                );
            });

            it('should work', async () => {
                expect(
                    await twabLib.getBalanceAt(
                        1630713395,
                        parseInt('' + new Date().getTime() / 1000 + 1000),
                    ),
                ).to.equal(toWei('100'));
            });
        });
    });

    describe('push()', () => {
        it('should increment the cardinality', async () => {
            const result = await twabLib.push({ balance: '0', nextTwabIndex: 2, cardinality: 10 })
            expect(
                result.map((obj: any) => obj.toString())
            ).to.deep.equals(
                [ '0', '3', `11` ]
            )
        })

        it('should correctly limit the cardinality', async () => {
            const result = await twabLib.push({ balance: '0', nextTwabIndex: 2, cardinality: 2**24-1 })
            expect(
                result.map((obj: any) => obj.toString())
            ).to.deep.equals(
                [ '0', '3', `${2**24-1}` ]
            )
        })
    })
});
