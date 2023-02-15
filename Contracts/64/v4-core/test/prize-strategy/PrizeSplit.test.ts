import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory, constants } from 'ethers';

const { getSigners } = ethers;
const { AddressZero } = constants;
const toWei = (val: string | number) => ethers.utils.parseEther('' + val);

describe('PrizeSplitStrategy', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;
    let wallet4: SignerWithAddress;
    let prizeSplit: Contract;
    let prizeSplitHarnessFactory: ContractFactory;

    before(async () => {
        [wallet1, wallet2, wallet3, wallet4] = await getSigners();

        prizeSplitHarnessFactory = await ethers.getContractFactory('PrizeSplitHarness');
    });

    beforeEach(async () => {
        prizeSplit = await prizeSplitHarnessFactory.deploy(wallet1.address);
    });

    describe('setPrizeSplits()', () => {
        it('should fail to set more than 256 prize splits', async () => {
            const newPrizeSplits = [];

            for (let i = 0; i < 256; i++) {
                newPrizeSplits.push({
                    target: wallet2.address,
                    percentage: 1,
                    token: 1,
                });
            }

            await expect(
                prizeSplit.setPrizeSplits(newPrizeSplits),
            ).to.be.revertedWith('PrizeSplit/invalid-prizesplits-length');
        });

        it('should revert with invalid prize split target address', async () => {
            await expect(
                prizeSplit.setPrizeSplits([
                    {
                        target: AddressZero,
                        percentage: 100,
                        token: 0,
                    },
                ]),
            ).to.be.revertedWith('PrizeSplit/invalid-prizesplit-target');
        });

        it('should revert when calling setPrizeSplits from a non-owner address', async () => {
            prizeSplit = prizeSplit.connect(wallet2);

            await expect(
                prizeSplit.setPrizeSplits([
                    {
                        target: wallet2.address,
                        percentage: 55,
                        token: 1,
                    },
                    {
                        target: wallet3.address,
                        percentage: 120,
                        token: 0,
                    },
                ]),
            ).to.be.revertedWith('Ownable/caller-not-owner');
        });

        it('should revert with single prize split config is equal to or above 100% percent', async () => {
            await expect(
                prizeSplit.setPrizeSplits([
                    {
                        target: wallet2.address,
                        percentage: 1005,
                        token: 0,
                    },
                ]),
            ).to.be.revertedWith('PrizeSplit/invalid-prizesplit-percentage');
        });

        it('should revert when multiple prize split configs is above 100% percent', async () => {
            await expect(
                prizeSplit.setPrizeSplits([
                    {
                        target: wallet2.address,
                        percentage: 500,
                        token: 0,
                    },
                    {
                        target: wallet3.address,
                        percentage: 501,
                        token: 0,
                    },
                ]),
            ).to.be.revertedWith('PrizeSplit/invalid-prizesplit-percentage-total');
        });

        it('should revert when setting a non-existent prize split config', async () => {
            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 500,
                    token: 0,
                },
            ]);

            await expect(
                prizeSplit.setPrizeSplit(
                    {
                        target: wallet2.address,
                        percentage: 300,
                        token: 0,
                    },
                    1,
                ),
            ).to.be.revertedWith('PrizeSplit/nonexistent-prizesplit');
        });

        it('should set two split prize winners using valid percentages', async () => {
            await expect(
                prizeSplit.setPrizeSplits([
                    {
                        target: wallet2.address,
                        percentage: 50,
                    },
                    {
                        target: wallet2.address,
                        percentage: 500,
                    },
                ]),
            )
                .to.emit(prizeSplit, 'PrizeSplitSet')
                .withArgs(wallet2.address, 50, 0);

            const prizeSplits = await prizeSplit.getPrizeSplits();

            // First Prize Split
            expect(prizeSplits[0].target).to.equal(wallet2.address);
            expect(prizeSplits[0].percentage).to.equal(50);

            // Second Prize Split
            expect(prizeSplits[1].target).to.equal(wallet2.address);
            expect(prizeSplits[1].percentage).to.equal(500);
        });

        it('should set two split prize configs and update the first prize split config', async () => {
            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                },
                {
                    target: wallet2.address,
                    percentage: 500,
                },
            ]);

            await prizeSplit.setPrizeSplit(
                {
                    target: wallet2.address,
                    percentage: 150,
                },
                0,
            );

            const prizeSplits = await prizeSplit.getPrizeSplits();

            // First Prize Split
            expect(prizeSplits[0].target).to.equal(wallet2.address);
            expect(prizeSplits[0].percentage).to.equal(150);

            // Second Prize Split
            expect(prizeSplits[1].target).to.equal(wallet2.address);
            expect(prizeSplits[1].percentage).to.equal(500);
        });

        it('should set two split prize config and add a third prize split config', async () => {
            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                },
                {
                    target: wallet3.address,
                    percentage: 500,
                },
            ]);

            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                },
                {
                    target: wallet3.address,
                    percentage: 500,
                },
                {
                    target: wallet4.address,
                    percentage: 150,
                },
            ]);

            const prizeSplits = await prizeSplit.getPrizeSplits();

            // First Prize Split
            expect(prizeSplits[0].target).to.equal(wallet2.address);
            expect(prizeSplits[0].percentage).to.equal(50);

            // Second Prize Split
            expect(prizeSplits[1].target).to.equal(wallet3.address);
            expect(prizeSplits[1].percentage).to.equal(500);

            // Third Prize Split
            expect(prizeSplits[2].target).to.equal(wallet4.address);
            expect(prizeSplits[2].percentage).to.equal(150);
        });

        it('should set two split prize configs, update the second prize split config and add a third prize split config', async () => {
            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                },
                {
                    target: wallet3.address,
                    percentage: 500,
                },
            ]);

            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                },
                {
                    target: wallet3.address,
                    percentage: 300,
                },
                {
                    target: wallet4.address,
                    percentage: 150,
                },
            ]);

            const prizeSplits = await prizeSplit.getPrizeSplits();

            // First Prize Split
            expect(prizeSplits[0].target).to.equal(wallet2.address);
            expect(prizeSplits[0].percentage).to.equal(50);

            // Second Prize Split
            expect(prizeSplits[1].target).to.equal(wallet3.address);
            expect(prizeSplits[1].percentage).to.equal(300);

            // Third Prize Split
            expect(prizeSplits[2].target).to.equal(wallet4.address);
            expect(prizeSplits[2].percentage).to.equal(150);
        });

        it('should set two split prize configs, update the first and remove the second prize split config', async () => {
            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                },
                {
                    target: wallet3.address,
                    percentage: 500,
                },
            ]);

            await expect(
                prizeSplit.setPrizeSplits([
                    {
                        target: wallet2.address,
                        percentage: 400,
                    },
                ]),
            ).to.emit(prizeSplit, 'PrizeSplitRemoved');

            const prizeSplits = await prizeSplit.getPrizeSplits();
            expect(prizeSplits.length).to.equal(1);

            // First Prize Split
            expect(prizeSplits[0].target).to.equal(wallet2.address);

            expect(prizeSplits[0].percentage).to.equal(400);
        });

        it('should set two split prize configs and a remove all prize split configs', async () => {
            await prizeSplit.setPrizeSplits([
                {
                    target: wallet2.address,
                    percentage: 50,
                    token: 0,
                },
                {
                    target: wallet3.address,
                    percentage: 500,
                    token: 0,
                },
            ]);

            await expect(prizeSplit.setPrizeSplits([]))
                .to.emit(prizeSplit, 'PrizeSplitRemoved')
                .withArgs(0);

            const prizeSplits = await prizeSplit.getPrizeSplits();
            expect(prizeSplits.length).to.equal(0);
        });
    });

    /*============================================ */
    // Internal Functions ----------------------------
    /*============================================ */
    describe('Internal Functions', () => {
        it('should awardPrizeSplitAmount()', async () => {
            expect(prizeSplit.awardPrizeSplitAmount(wallet3.address, toWei('100'))).to.emit(
                prizeSplit,
                'PrizeSplitAwarded',
            );
        });
    });
});
