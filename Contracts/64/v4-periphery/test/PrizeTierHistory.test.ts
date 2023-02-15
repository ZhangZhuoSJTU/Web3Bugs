import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import { range } from './utils/range';

const { getSigners, utils } = ethers;
const { parseEther: toWei } = utils;

describe('PrizeTierHistory', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;

    let prizeTierHistory: Contract;
    let prizeTierHistoryFactory: ContractFactory;

    const tiers = range(16, 0).map((i) => 0);

    const prizeTiers = [
        {
            bitRangeSize: 5,
            drawId: 1,
            maxPicksPerUser: 10,
            tiers,
            expiryDuration: 10000,
            prize: toWei('10000'),
            endTimestampOffset: 3000,
        },
        {
            bitRangeSize: 5,
            drawId: 6,
            maxPicksPerUser: 10,
            tiers,
            expiryDuration: 10000,
            prize: toWei('10000'),
            endTimestampOffset: 3000,
        },
        {
            bitRangeSize: 5,
            drawId: 9,
            maxPicksPerUser: 10,
            tiers,
            expiryDuration: 10000,
            prize: toWei('10000'),
            endTimestampOffset: 3000,
        },
        {
            bitRangeSize: 5,
            drawId: 20,
            maxPicksPerUser: 10,
            tiers,
            expiryDuration: 10000,
            prize: toWei('10000'),
            endTimestampOffset: 3000,
        },
    ];

    const tiersGT1e9 = [
        141787658, 0, 0, 0, 85072595, 0, 0, 136116152, 136116152, 108892921, 0, 0, 217785843,
        174228675, 174228675, 0,
    ];

    const pushPrizeTiers = async () => {
        await Promise.all(
            prizeTiers.map(async (tier) => {
                await prizeTierHistory.push(tier);
            }),
        );
    };

    before(async () => {
        [wallet1, wallet2, wallet3] = await getSigners();
        prizeTierHistoryFactory = await ethers.getContractFactory('PrizeTierHistory');
    });

    beforeEach(async () => {
        prizeTierHistory = await prizeTierHistoryFactory.deploy(wallet1.address, []);
    });

    describe('Getters', () => {
        it('should succeed to get history length', async () => {
            await pushPrizeTiers();
            const count = await prizeTierHistory.count();
            expect(count).to.equal(4);
        });

        it('should succeed to get oldest Draw Id', async () => {
            await pushPrizeTiers();
            const oldestDrawId = await prizeTierHistory.getOldestDrawId();
            expect(oldestDrawId).to.equal(1);
        });

        it('should succeed to get newest Draw Id', async () => {
            await pushPrizeTiers();
            const newestDrawId = await prizeTierHistory.getNewestDrawId();
            expect(newestDrawId).to.equal(20);
        });

        it('should succeed to get a PrizeTier using an index position', async () => {
            await pushPrizeTiers();
            const prizeTier = await prizeTierHistory.getPrizeTierAtIndex(3);
            expect(prizeTier.drawId).to.equal(20);
        });

        it('should succeed to get prize tiers from history', async () => {
            await pushPrizeTiers();
            const prizeTierFromHistory = await prizeTierHistory.getPrizeTierList([3, 7, 9]);
            expect(prizeTierFromHistory[0].drawId).to.equal(1);
            expect(prizeTierFromHistory[1].drawId).to.equal(6);
            expect(prizeTierFromHistory[2].drawId).to.equal(9);
        });

        it('should return prize tier before our searched draw id', async () => {
            await pushPrizeTiers();
            const prizeTierFromHistory = await prizeTierHistory.getPrizeTier(4);
            expect(prizeTierFromHistory.drawId).to.equal(prizeTiers[0].drawId);
        });

        it('should fail to get a PrizeTier before history range', async () => {
            await pushPrizeTiers();
            await expect(prizeTierHistory.getPrizeTier(0)).to.revertedWith(
                'PrizeTierHistory/draw-id-not-zero',
            );
        });

        it('should fail to get a PrizeTer after history range', async () => {
            await prizeTierHistory.push(prizeTiers[2]);
            await expect(prizeTierHistory.getPrizeTier(4)).to.be.revertedWith(
                'BinarySearchLib/draw-id-out-of-range',
            );
        });
    });

    describe('Setters', () => {
        describe('.push()', () => {
            it('should succeed push PrizeTier into history from Owner wallet.', async () => {
                await expect(prizeTierHistory.push(prizeTiers[0])).to.emit(
                    prizeTierHistory,
                    'PrizeTierPushed',
                );
            });

            it('should succeed to push PrizeTier into history from Manager wallet', async () => {
                await prizeTierHistory.setManager(wallet2.address);
                await expect(
                    prizeTierHistory.connect(wallet2 as unknown as Signer).push(prizeTiers[0]),
                ).to.emit(prizeTierHistory, 'PrizeTierPushed');
            });

            it('should fail to push PrizeTier into history because non-sequential-id', async () => {
                await pushPrizeTiers();
                await expect(
                    prizeTierHistory.push({ ...prizeTiers[3], drawId: 18 }),
                ).to.be.revertedWith('PrizeTierHistory/non-sequential-id');
            });

            it('should fail to push PrizeTier into history from Unauthorized wallet', async () => {
                await expect(
                    prizeTierHistory.connect(wallet3 as unknown as Signer).push(prizeTiers[0]),
                ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
            });

            it('should fail to push a PrizeTier if the sum of tiers is greater than 1e9', async () => {
                prizeTiers[0].tiers = tiersGT1e9;

                await expect(prizeTierHistory.push(prizeTiers[0])).to.be.revertedWith(
                    'PrizeTierHistory/tiers-gt-100%',
                );

                prizeTiers[0].tiers = tiers;
            });
        });

        describe('.popAndPush()', () => {
            it('should succeed to set existing PrizeTier in history from Owner wallet.', async () => {
                await pushPrizeTiers();
                const prizeTier = {
                    ...prizeTiers[2],
                    drawId: 20,
                    bitRangeSize: 16,
                };

                await expect(prizeTierHistory.popAndPush(prizeTier)).to.emit(
                    prizeTierHistory,
                    'PrizeTierSet',
                );
            });

            it('should succeed to set newest PrizeTier in history from Owner wallet.', async () => {
                await pushPrizeTiers();
                const prizeTier = {
                    ...prizeTiers[2],
                    drawId: 20,
                    bitRangeSize: 16,
                };

                await expect(prizeTierHistory.popAndPush(prizeTier)).to.emit(
                    prizeTierHistory,
                    'PrizeTierSet',
                );
            });

            it('should fail to set existing PrizeTier in history due to invalid draw id`.', async () => {
                await pushPrizeTiers();
                const prizeTier = {
                    ...prizeTiers[0],
                    drawId: 8,
                    bitRangeSize: 16,
                };
                await expect(prizeTierHistory.popAndPush(prizeTier)).to.revertedWith(
                    'PrizeTierHistory/invalid-draw-id',
                );
            });

            it('should fail to set existing PrizeTier due to empty history', async () => {
                await expect(prizeTierHistory.popAndPush(prizeTiers[0])).to.revertedWith(
                    'PrizeTierHistory/history-empty',
                );
            });

            it('should fail to set existing PrizeTier in history from Manager wallet', async () => {
                await expect(
                    prizeTierHistory
                        .connect(wallet2 as unknown as Signer)
                        .popAndPush(prizeTiers[0]),
                ).to.revertedWith('Ownable/caller-not-owner');
            });

            it('should fail to popAndPush a PrizeTier if the sum of tiers is greater than 1e9', async () => {
                await prizeTierHistory.push(prizeTiers[0]);

                prizeTiers[0].tiers = tiersGT1e9;

                await expect(prizeTierHistory.popAndPush(prizeTiers[0])).to.be.revertedWith(
                    'PrizeTierHistory/tiers-gt-100%',
                );

                prizeTiers[0].tiers = tiers;
            });
        });
    });

    describe('replace()', async () => {
        it('should successfully emit PrizeTierSet event when replacing an existing PrizeTier', async () => {
            await pushPrizeTiers();
            await expect(await prizeTierHistory.replace(prizeTiers[1])).to.emit(
                prizeTierHistory,
                'PrizeTierSet',
            );
        });

        it('should successfully return new values after replacing an existing PrizeTier', async () => {
            await pushPrizeTiers();
            const prizeTier = {
                ...prizeTiers[1],
                bitRangeSize: 12,
            };
            await prizeTierHistory.replace(prizeTier);
            const prizeTierVal = await prizeTierHistory.getPrizeTier(prizeTier.drawId);
            expect(prizeTierVal.bitRangeSize).to.equal(12);
        });

        it('should fail to replace a PrizeTier if not owner', async () => {
            await prizeTierHistory.setManager(wallet2.address);

            await expect(
                prizeTierHistory.connect(wallet2).replace(prizeTiers[1]),
            ).to.be.revertedWith('Ownable/caller-not-owner');
        });

        it('should fail to replace a PrizeTier because history is empty', async () => {
            await expect(prizeTierHistory.replace(prizeTiers[1])).to.be.revertedWith(
                'PrizeTierHistory/no-prize-tiers',
            );
        });

        it('should fail to replace a PrizeTier that is out of range', async () => {
            await prizeTierHistory.push(prizeTiers[3]);
            await expect(prizeTierHistory.replace(prizeTiers[0])).to.be.revertedWith(
                'PrizeTierHistory/draw-id-out-of-range',
            );
        });

        it('should fail to replace a PrizeTier if the sum of tiers is greater than 1e9', async () => {
            await prizeTierHistory.push(prizeTiers[3]);

            prizeTiers[3].tiers = tiersGT1e9;

            await expect(prizeTierHistory.replace(prizeTiers[3])).to.be.revertedWith(
                'PrizeTierHistory/tiers-gt-100%',
            );

            prizeTiers[3].tiers = tiers;
        });

        it('should fail to replace a non-existent PrizeTier', async () => {
            await pushPrizeTiers();
            const prizeTier = {
                ...prizeTiers[1],
                drawId: 4,
            };
            await expect(prizeTierHistory.replace(prizeTier)).to.be.revertedWith(
                'PrizeTierHistory/draw-id-must-match',
            );
        });
    });
});
