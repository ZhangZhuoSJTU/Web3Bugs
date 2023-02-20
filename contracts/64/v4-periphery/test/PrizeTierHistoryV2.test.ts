import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';

import { IPrizeTierHistoryV2 } from '../types/contracts/interfaces/IPrizeTierHistoryV2';

import { range } from './utils/range';

const { getSigners, utils } = ethers;
const { parseEther: toWei, parseUnits } = utils;

describe('PrizeTierHistoryV2', () => {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;

    let prizeTierHistoryV2: Contract;
    let prizeTierHistoryV2Factory: ContractFactory;

    const dpr = parseUnits('0.1', 9); // 10%
    const tiers = range(16, 0).map((i) => 0);

    const prizeTiers: IPrizeTierHistoryV2.PrizeTierV2Struct[] = [
        {
            bitRangeSize: 5,
            drawId: 1,
            maxPicksPerUser: 10,
            expiryDuration: 10000,
            dpr,
            endTimestampOffset: 3000,
            prize: toWei('10000'),
            tiers,
        },
        {
            bitRangeSize: 5,
            drawId: 6,
            maxPicksPerUser: 10,
            expiryDuration: 10000,
            endTimestampOffset: 3000,
            dpr,
            prize: toWei('10000'),
            tiers,
        },
        {
            bitRangeSize: 5,
            drawId: 9,
            maxPicksPerUser: 10,
            expiryDuration: 10000,
            endTimestampOffset: 3000,
            dpr,
            prize: toWei('10000'),
            tiers,
        },
        {
            bitRangeSize: 5,
            drawId: 20,
            maxPicksPerUser: 10,
            expiryDuration: 10000,
            endTimestampOffset: 3000,
            dpr,
            prize: toWei('10000'),
            tiers,
        },
    ];

    const dprGT1e9 = parseUnits('1.1', 9);

    const tiersGT1e9 = [
        141787658, 0, 0, 0, 85072595, 0, 0, 136116152, 136116152, 108892921, 0, 0, 217785843,
        174228675, 174228675, 0,
    ];

    const pushPrizeTiers = async () => {
        await Promise.all(
            prizeTiers.map(async (tier) => {
                await prizeTierHistoryV2.push(tier);
            }),
        );
    };

    before(async () => {
        [wallet1, wallet2, wallet3] = await getSigners();
        prizeTierHistoryV2Factory = await ethers.getContractFactory('PrizeTierHistoryV2');
    });

    beforeEach(async () => {
        prizeTierHistoryV2 = await prizeTierHistoryV2Factory.deploy(wallet1.address, []);
    });

    describe('Getters', () => {
        it('should succeed to get history length', async () => {
            await pushPrizeTiers();

            expect(await prizeTierHistoryV2.count()).to.equal(4);
        });

        it('should succeed to get oldest Draw Id', async () => {
            await pushPrizeTiers();

            expect(await prizeTierHistoryV2.getOldestDrawId()).to.equal(1);
        });

        it('should succeed to get newest Draw Id', async () => {
            await pushPrizeTiers();

            expect(await prizeTierHistoryV2.getNewestDrawId()).to.equal(20);
        });

        it('should succeed to get a PrizeTier using an index position', async () => {
            await pushPrizeTiers();

            const prizeTier = await prizeTierHistoryV2.getPrizeTierAtIndex(3);
            expect(prizeTier.drawId).to.equal(20);
        });

        it('should succeed to get prize tiers from history', async () => {
            await pushPrizeTiers();

            const prizeTierFromHistory = await prizeTierHistoryV2.getPrizeTierList([3, 7, 9]);

            expect(prizeTierFromHistory[0].drawId).to.equal(1);
            expect(prizeTierFromHistory[1].drawId).to.equal(6);
            expect(prizeTierFromHistory[2].drawId).to.equal(9);
        });

        it('should return prize tier before our searched draw id', async () => {
            await pushPrizeTiers();

            const prizeTierFromHistory = await prizeTierHistoryV2.getPrizeTier(4);
            expect(prizeTierFromHistory.drawId).to.equal(prizeTiers[0].drawId);
        });

        it('should fail to get a PrizeTier before history range', async () => {
            await pushPrizeTiers();

            await expect(prizeTierHistoryV2.getPrizeTier(0)).to.revertedWith(
                'PTH/draw-id-not-zero',
            );
        });

        it('should fail to get a PrizeTer after history range', async () => {
            await prizeTierHistoryV2.push(prizeTiers[2]);

            await expect(prizeTierHistoryV2.getPrizeTier(4)).to.be.revertedWith(
                'BinarySearchLib/draw-id-out-of-range',
            );
        });
    });

    describe('Setters', () => {
        describe('.push()', () => {
            it('should succeed to push PrizeTier into history from Owner wallet.', async () => {
                await expect(prizeTierHistoryV2.push(prizeTiers[0])).to.emit(
                    prizeTierHistoryV2,
                    'PrizeTierPushed',
                );
            });

            it('should succeed to push PrizeTier into history from Manager wallet', async () => {
                await prizeTierHistoryV2.setManager(wallet2.address);

                await expect(prizeTierHistoryV2.connect(wallet2).push(prizeTiers[0])).to.emit(
                    prizeTierHistoryV2,
                    'PrizeTierPushed',
                );
            });

            it('should fail to push PrizeTier into history because non-sequential-id', async () => {
                await pushPrizeTiers();

                await expect(
                    prizeTierHistoryV2.push({ ...prizeTiers[3], drawId: 18 }),
                ).to.be.revertedWith('PTH/non-sequential-id');
            });

            it('should fail to push PrizeTier into history from Unauthorized wallet', async () => {
                await expect(
                    prizeTierHistoryV2.connect(wallet3).push(prizeTiers[0]),
                ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
            });

            it('should fail to push a PrizeTier if the sum of tiers is greater than 1e9', async () => {
                prizeTiers[0].tiers = tiersGT1e9;

                await expect(prizeTierHistoryV2.push(prizeTiers[0])).to.be.revertedWith(
                    'PTH/tiers-gt-100%',
                );

                prizeTiers[0].tiers = tiers;
            });

            it('should fail to push a PrizeTier if the dpr is greater than 1e9', async () => {
                prizeTiers[0].dpr = dprGT1e9;

                await expect(prizeTierHistoryV2.push(prizeTiers[0])).to.be.revertedWith(
                    'PTH/dpr-gt-100%',
                );

                prizeTiers[0].dpr = dpr;
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

                await expect(prizeTierHistoryV2.popAndPush(prizeTier)).to.emit(
                    prizeTierHistoryV2,
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

                await expect(prizeTierHistoryV2.popAndPush(prizeTier)).to.emit(
                    prizeTierHistoryV2,
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

                await expect(prizeTierHistoryV2.popAndPush(prizeTier)).to.revertedWith(
                    'PTH/invalid-draw-id',
                );
            });

            it('should fail to set existing PrizeTier due to empty history', async () => {
                await expect(prizeTierHistoryV2.popAndPush(prizeTiers[0])).to.revertedWith(
                    'PTH/history-empty',
                );
            });

            it('should fail to set existing PrizeTier in history from Manager wallet', async () => {
                await prizeTierHistoryV2.setManager(wallet2.address);

                await expect(
                    prizeTierHistoryV2.connect(wallet2).popAndPush(prizeTiers[0]),
                ).to.revertedWith('Ownable/caller-not-owner');
            });

            it('should fail to popAndPush a PrizeTier if the sum of tiers is greater than 1e9', async () => {
                await prizeTierHistoryV2.push(prizeTiers[0]);

                prizeTiers[0].tiers = tiersGT1e9;

                await expect(prizeTierHistoryV2.popAndPush(prizeTiers[0])).to.be.revertedWith(
                    'PTH/tiers-gt-100%',
                );

                prizeTiers[0].tiers = tiers;
            });

            it('should fail to popAndPush a PrizeTier if the dpr is greater than 1e9', async () => {
                await prizeTierHistoryV2.push(prizeTiers[0]);

                prizeTiers[0].dpr = dprGT1e9;

                await expect(prizeTierHistoryV2.popAndPush(prizeTiers[0])).to.be.revertedWith(
                    'PTH/dpr-gt-100%',
                );

                prizeTiers[0].dpr = dpr;
            });
        });
    });

    describe('replace()', async () => {
        it('should successfully emit PrizeTierSet event when replacing an existing PrizeTier', async () => {
            await pushPrizeTiers();

            await expect(await prizeTierHistoryV2.replace(prizeTiers[1])).to.emit(
                prizeTierHistoryV2,
                'PrizeTierSet',
            );
        });

        it('should successfully return new values after replacing an existing PrizeTier', async () => {
            await pushPrizeTiers();

            const prizeTier = {
                ...prizeTiers[1],
                bitRangeSize: 12,
            };

            await prizeTierHistoryV2.replace(prizeTier);

            const prizeTierVal = await prizeTierHistoryV2.getPrizeTier(prizeTier.drawId);
            expect(prizeTierVal.bitRangeSize).to.equal(12);
        });

        it('should fail to replace a PrizeTier if not owner', async () => {
            await prizeTierHistoryV2.setManager(wallet2.address);

            await expect(
                prizeTierHistoryV2.connect(wallet2).replace(prizeTiers[1]),
            ).to.be.revertedWith('Ownable/caller-not-owner');
        });

        it('should fail to replace a PrizeTier because history is empty', async () => {
            await expect(prizeTierHistoryV2.replace(prizeTiers[1])).to.be.revertedWith(
                'PTH/no-prize-tiers',
            );
        });

        it('should fail to replace a PrizeTier that is out of range', async () => {
            await prizeTierHistoryV2.push(prizeTiers[3]);

            await expect(prizeTierHistoryV2.replace(prizeTiers[0])).to.be.revertedWith(
                'PTH/draw-id-out-of-range',
            );
        });

        it('should fail to replace a PrizeTier if the sum of tiers is greater than 1e9', async () => {
            await prizeTierHistoryV2.push(prizeTiers[3]);

            prizeTiers[3].tiers = tiersGT1e9;

            await expect(prizeTierHistoryV2.replace(prizeTiers[3])).to.be.revertedWith(
                'PTH/tiers-gt-100%',
            );

            prizeTiers[3].tiers = tiers;
        });

        it('should fail to replace a PrizeTier if the dpr is greater than 1e9', async () => {
            await prizeTierHistoryV2.push(prizeTiers[3]);

            prizeTiers[3].dpr = dprGT1e9;

            await expect(prizeTierHistoryV2.replace(prizeTiers[3])).to.be.revertedWith(
                'PTH/dpr-gt-100%',
            );

            prizeTiers[3].dpr = dpr;
        });

        it('should fail to replace a non-existent PrizeTier', async () => {
            await pushPrizeTiers();

            const prizeTier = {
                ...prizeTiers[1],
                drawId: 4,
            };

            await expect(prizeTierHistoryV2.replace(prizeTier)).to.be.revertedWith(
                'PTH/draw-id-must-match',
            );
        });
    });
});
