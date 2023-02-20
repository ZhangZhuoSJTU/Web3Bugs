import { ethers, artifacts } from 'hardhat';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants, Contract, ContractFactory, utils } from 'ethers';
import { expect } from 'chai';

const debug = require('debug')('pt:DrawBeacon.test.ts');

const now = () => (new Date().getTime() / 1000) | 0;

const { AddressZero } = constants;
const { parseEther: toWei } = utils;

describe('DrawBeacon', () => {
    let wallet: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let DrawBeaconFactory: ContractFactory;
    let drawBuffer: MockContract;
    let drawBeacon: Contract;
    let rng: MockContract;
    let rngFeeToken: MockContract;

    let beaconPeriodStart = now();
    const exampleBeaconPeriodSeconds = 1000;
    const rngTimeout = 2000
    const nextDrawId = 1;

    const halfTime = exampleBeaconPeriodSeconds / 2;
    const overTime = exampleBeaconPeriodSeconds + 1;

    let IERC20;

    before(async () => {
        [wallet, wallet2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        IERC20 = await artifacts.readArtifact('IERC20');

        debug(`using wallet ${wallet.address}`);

        debug(`deploy draw buffer...`);
        const DrawBuffer = await artifacts.readArtifact('DrawBuffer');
        drawBuffer = await deployMockContract(wallet as Signer, DrawBuffer.abi);

        debug('mocking rng...');
        const RNGInterface = await artifacts.readArtifact('RNGInterface');
        rng = await deployMockContract(wallet as Signer, RNGInterface.abi);
        rngFeeToken = await deployMockContract(wallet as Signer, IERC20.abi);

        await rng.mock.getRequestFee.returns(rngFeeToken.address, toWei('1'));

        debug('deploying drawBeacon...');
        DrawBeaconFactory = await ethers.getContractFactory('DrawBeaconHarness', wallet);
        drawBeacon = await DrawBeaconFactory.deploy(
            wallet.address,
            drawBuffer.address,
            rng.address,
            nextDrawId,
            beaconPeriodStart,
            exampleBeaconPeriodSeconds,
            rngTimeout
        );
    });

    describe('constructor()', () => {
        it('should emit a Deployed event', async () => {
            const drawBeacon2 = await DrawBeaconFactory.deploy(
                wallet.address,
                drawBuffer.address,
                rng.address,
                nextDrawId,
                beaconPeriodStart,
                exampleBeaconPeriodSeconds,
                rngTimeout
            );

            await expect(drawBeacon2.deployTransaction)
                .to.emit(drawBeacon2, 'Deployed')
                .withArgs(
                    nextDrawId,
                    beaconPeriodStart
                );

            await expect(drawBeacon2.deployTransaction)
                .to.emit(drawBeacon2, 'BeaconPeriodStarted')
                .withArgs(beaconPeriodStart);
        });

        it('should set the params', async () => {
            expect(await drawBeacon.getRngService()).to.equal(rng.address);
            expect(await drawBeacon.getBeaconPeriodStartedAt()).to.equal(beaconPeriodStart);
            expect(await drawBeacon.getBeaconPeriodSeconds()).to.equal(exampleBeaconPeriodSeconds);
        });

        it('should reject rng request period', async () => {
            await expect(
                DrawBeaconFactory.deploy(
                    wallet.address,
                    drawBuffer.address,
                    rng.address,
                    nextDrawId,
                    0,
                    exampleBeaconPeriodSeconds,
                    rngTimeout
                ),
            ).to.be.revertedWith('DrawBeacon/beacon-period-greater-than-zero');
        });

        it('should reject invalid rng', async () => {
            await expect(
                DrawBeaconFactory.deploy(
                    wallet.address,
                    drawBuffer.address,
                    AddressZero,
                    nextDrawId,
                    beaconPeriodStart,
                    exampleBeaconPeriodSeconds,
                    rngTimeout
                ),
            ).to.be.revertedWith('DrawBeacon/rng-not-zero');
        });

        it('should reject nextDrawId inferior to 1', async () => {
            await expect(
                DrawBeaconFactory.deploy(
                    wallet.address,
                    drawBuffer.address,
                    rng.address,
                    0,
                    beaconPeriodStart,
                    exampleBeaconPeriodSeconds,
                    rngTimeout
                ),
            ).to.be.revertedWith('DrawBeacon/next-draw-id-gte-one');
        });
    });

    describe('Core Functions', () => {
        describe('canStartDraw()', () => {
            it('should determine if a prize is able to be awarded', async () => {
                const startTime = await drawBeacon.getBeaconPeriodStartedAt();

                // Prize-period not over, RNG not requested
                await drawBeacon.setCurrentTime(startTime.add(10));
                await drawBeacon.setRngRequest(0, 0);
                expect(await drawBeacon.canStartDraw()).to.equal(false);

                // Prize-period not over, RNG requested
                await drawBeacon.setCurrentTime(startTime.add(10));
                await drawBeacon.setRngRequest(1, 100);
                expect(await drawBeacon.canStartDraw()).to.equal(false);

                // Prize-period over, RNG requested
                await drawBeacon.setCurrentTime(startTime.add(exampleBeaconPeriodSeconds));
                await drawBeacon.setRngRequest(1, 100);
                expect(await drawBeacon.canStartDraw()).to.equal(false);

                // Prize-period over, RNG not requested
                await drawBeacon.setCurrentTime(startTime.add(exampleBeaconPeriodSeconds));
                await drawBeacon.setRngRequest(0, 0);
                expect(await drawBeacon.canStartDraw()).to.equal(true);
            });
        });

        describe('canCompleteDraw()', () => {
            it('should determine if a prize is able to be completed', async () => {
                // RNG not requested, RNG not completed
                await drawBeacon.setRngRequest(0, 0);
                await rng.mock.isRequestComplete.returns(false);
                expect(await drawBeacon.canCompleteDraw()).to.equal(false);

                // RNG requested, RNG not completed
                await drawBeacon.setRngRequest(1, 100);
                await rng.mock.isRequestComplete.returns(false);
                expect(await drawBeacon.canCompleteDraw()).to.equal(false);

                // RNG requested, RNG completed
                await drawBeacon.setRngRequest(1, 100);
                await rng.mock.isRequestComplete.returns(true);
                expect(await drawBeacon.canCompleteDraw()).to.equal(true);
            });
        });

        describe('with a prize-period scheduled in the future', () => {
            let drawBeaconBase2: Contract;

            beforeEach(async () => {
                beaconPeriodStart = 10000;
                drawBeaconBase2 = await DrawBeaconFactory.deploy(
                    wallet.address,
                    drawBuffer.address,
                    rng.address,
                    nextDrawId,
                    beaconPeriodStart,
                    exampleBeaconPeriodSeconds,
                    rngTimeout
                );
            });

            describe('startDraw()', () => {
                it('should prevent starting an award', async () => {
                    await drawBeaconBase2.setCurrentTime(100);
                    await expect(drawBeaconBase2.startDraw()).to.be.revertedWith(
                        'DrawBeacon/beacon-period-not-over',
                    );
                });

                it('should not be called twice', async () => {
                    await drawBeaconBase2.setCurrentTime(1000000);
                    await rng.mock.getRequestFee.returns(ethers.constants.AddressZero, 0);
                    await rng.mock.requestRandomNumber.returns(1, 0);
                    await drawBeaconBase2.startDraw();
                    await expect(drawBeaconBase2.startDraw()).to.be.revertedWith(
                        'DrawBeacon/rng-already-requested',
                    );
                });
            });

            describe('completeDraw()', () => {
                it('should prevent completing a draw', async () => {
                    await drawBeaconBase2.setCurrentTime(100);
                    await expect(drawBeaconBase2.startDraw()).to.be.revertedWith(
                        'DrawBeacon/beacon-period-not-over',
                    );
                });

                it('should require an rng to be requested', async () => {
                    await expect(drawBeaconBase2.completeDraw()).to.be.revertedWith(
                        'DrawBeacon/rng-not-requested',
                    );
                });

                it('should require the rng to be complete', async () => {
                    await drawBeaconBase2.setCurrentTime(1000000);
                    await rng.mock.getRequestFee.returns(ethers.constants.AddressZero, 0);
                    await rng.mock.requestRandomNumber.returns(1, 0);
                    await drawBeaconBase2.startDraw();

                    await rng.mock.isRequestComplete.returns(false);

                    await expect(drawBeaconBase2.completeDraw()).to.be.revertedWith(
                        'DrawBeacon/rng-not-complete',
                    );
                });
            });
        });
        describe('cancelDraw()', () => {
            it('should not allow anyone to cancel if the rng has not timed out', async () => {
                await expect(drawBeacon.cancelDraw()).to.be.revertedWith(
                    'DrawBeacon/rng-not-timedout',
                );
            });

            it('should allow anyone to reset the rng if it times out', async () => {
                await rngFeeToken.mock.allowance.returns(0);
                await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
                await rng.mock.requestRandomNumber.returns('11', '1');
                await drawBeacon.setCurrentTime(await drawBeacon.beaconPeriodEndAt());
                await drawBeacon.startDraw();

                // set it beyond request timeout
                await drawBeacon.setCurrentTime(
                    (await drawBeacon.beaconPeriodEndAt())
                        .add(await drawBeacon.getRngTimeout())
                        .add(1),
                );

                // should be timed out
                expect(await drawBeacon.isRngTimedOut()).to.be.true;

                await expect(drawBeacon.cancelDraw())
                    .to.emit(drawBeacon, 'DrawCancelled')
                    .withArgs(11, 1);
            });
        });

        describe('completeDraw()', () => {
            beforeEach(async () => {
                debug('Setting time');
                // ensure prize period is over
                await drawBeacon.setCurrentTime(await drawBeacon.beaconPeriodEndAt());

                // allow an rng request
                await rngFeeToken.mock.allowance.returns(0);
                await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
                await rng.mock.requestRandomNumber.returns('1', '1');

                debug('Starting rng request...');

                // start the rng request
                await drawBeacon.startDraw();

                // rng is done
                await rng.mock.isRequestComplete.returns(true);
                await rng.mock.randomNumber.returns(
                    '0x6c00000000000000000000000000000000000000000000000000000000000000',
                );
            });

            it('should emit the events', async () => {
                debug('Completing rng request...');

                const beaconPeriodEndAt = await drawBeacon.beaconPeriodEndAt();
                const beaconPeriodStartedAt = await drawBeacon.getBeaconPeriodStartedAt();

                await drawBuffer.mock.pushDraw
                    .withArgs([
                        '0x6c00000000000000000000000000000000000000000000000000000000000000',
                        1,
                        beaconPeriodEndAt,
                        beaconPeriodStartedAt,
                        exampleBeaconPeriodSeconds,
                    ])
                    .returns(1);

                await drawBeacon.setCurrentTime((await drawBeacon.beaconPeriodEndAt()).add(1000));

                const nextStartTime =
                    await drawBeacon.calculateNextBeaconPeriodStartTimeFromCurrentTime();

                expect(await drawBeacon.completeDraw())
                    .to.emit(drawBeacon, 'DrawCompleted')
                    .withArgs(
                        '0x6c00000000000000000000000000000000000000000000000000000000000000',
                    )
                    .and.to.emit(drawBeacon, 'BeaconPeriodStarted')
                    .withArgs(nextStartTime);

                expect(await drawBeacon.getBeaconPeriodStartedAt()).to.equal(nextStartTime);
            });
        });
    });

    describe('Setter Functions', () => {
        describe('setDrawBuffer()', () => {
            it('should allow the owner to set the draw buffer', async () => {
                await expect(drawBeacon.setDrawBuffer(wallet2.address))
                    .to.emit(drawBeacon, 'DrawBufferUpdated')
                    .withArgs(wallet2.address);

                expect(await drawBeacon.getDrawBuffer()).to.equal(wallet2.address);
            });

            it('should not allow setting a zero draw buffer', async () => {
                await expect(
                    drawBeacon.setDrawBuffer(ethers.constants.AddressZero),
                ).to.be.revertedWith('DrawBeacon/draw-history-not-zero-address');
            });

            it('should be a different draw buffer', async () => {
                await expect(drawBeacon.setDrawBuffer(drawBuffer.address)).to.be.revertedWith(
                    'DrawBeacon/existing-draw-history-address',
                );
            });
        });

        describe('setRngService', () => {
            it('should only allow the owner to change it', async () => {
                await expect(drawBeacon.setRngService(wallet2.address))
                    .to.emit(drawBeacon, 'RngServiceUpdated')
                    .withArgs(wallet2.address);
            });

            it('should not allow anyone but the owner to change', async () => {
                const drawBeaconWallet2 = drawBeacon.connect(wallet2);
                await expect(drawBeaconWallet2.setRngService(wallet2.address)).to.be.revertedWith(
                    'Ownable/caller-not-owner',
                );
            });

            it('should not be called if an rng request is in flight', async () => {
                await rngFeeToken.mock.allowance.returns(0);
                await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
                await rng.mock.requestRandomNumber.returns('11', '1');
                await drawBeacon.setCurrentTime(await drawBeacon.beaconPeriodEndAt());
                await drawBeacon.startDraw();
                await expect(drawBeacon.setRngService(wallet2.address)).to.be.revertedWith(
                    'DrawBeacon/rng-in-flight',
                );
            });
        });

        describe('setRngTimeout()', () => {
            it('should prevent the owner from setting rngTimeout below 60', async () => {
                await expect(drawBeacon.setRngTimeout(55)).to.be.revertedWith(
                    'DrawBeacon/rng-timeout-gt-60-secs',
                );

                expect(await drawBeacon.getRngTimeout()).to.equal(rngTimeout);
            });
            it('should allow the owner to set the rngTimeout above 60', async () => {
                await expect(drawBeacon.setRngTimeout(100))
                    .to.emit(drawBeacon, 'RngTimeoutSet')
                    .withArgs(100);

                expect(await drawBeacon.getRngTimeout()).to.equal(100);
            });
        });

        describe('setBeaconPeriodSeconds()', () => {
            it('should allow the owner to set the beacon period', async () => {
                await expect(drawBeacon.setBeaconPeriodSeconds(99))
                    .to.emit(drawBeacon, 'BeaconPeriodSecondsUpdated')
                    .withArgs(99);

                expect(await drawBeacon.getBeaconPeriodSeconds()).to.equal(99);
            });

            it('should not allow non-owners to set the prize period', async () => {
                await expect(
                    drawBeacon.connect(wallet2).setBeaconPeriodSeconds(99),
                ).to.be.revertedWith('Ownable/caller-not-owner');
            });

            it('should not allow a zero period', async () => {
                await expect(drawBeacon.setBeaconPeriodSeconds(0)).to.be.revertedWith(
                    'DrawBeacon/beacon-period-greater-than-zero',
                );
            });
        });
    });

    describe('Getter Functions', () => {
        describe('getNextDrawId()', () => {
            it('should return the next draw id', async () => {
                expect(await drawBeacon.getNextDrawId()).to.equal(nextDrawId);
            });
        });
        describe('beaconPeriodRemainingSeconds()', () => {
            it('should calculate the remaining seconds of the prize period', async () => {
                const startTime = await drawBeacon.getBeaconPeriodStartedAt();

                // Half-time
                await drawBeacon.setCurrentTime(startTime.add(halfTime));
                expect(await drawBeacon.beaconPeriodRemainingSeconds()).to.equal(halfTime);

                // Over-time
                await drawBeacon.setCurrentTime(startTime.add(overTime));
                expect(await drawBeacon.beaconPeriodRemainingSeconds()).to.equal(0);
            });
        });

        describe('calculateNextBeaconPeriodStartTime()', () => {
            it('should always sync to the last period start time', async () => {
                let startedAt = await drawBeacon.getBeaconPeriodStartedAt();

                expect(
                    await drawBeacon.calculateNextBeaconPeriodStartTime(
                        startedAt.add(exampleBeaconPeriodSeconds * 14),
                    ),
                ).to.equal(startedAt.add(exampleBeaconPeriodSeconds * 14));
            });

            it('should return the current if it is within', async () => {
                let startedAt = await drawBeacon.getBeaconPeriodStartedAt();

                expect(
                    await drawBeacon.calculateNextBeaconPeriodStartTime(
                        startedAt.add(exampleBeaconPeriodSeconds / 2),
                    ),
                ).to.equal(startedAt);
            });

            it('should return the next if it is after', async () => {
                let startedAt = await drawBeacon.getBeaconPeriodStartedAt();

                expect(
                    await drawBeacon.calculateNextBeaconPeriodStartTime(
                        startedAt.add(parseInt('' + exampleBeaconPeriodSeconds * 1.5)),
                    ),
                ).to.equal(startedAt.add(exampleBeaconPeriodSeconds));
            });
        });

        describe('getLastRngLockBlock()', () => {
            it('should return the lock-block for the last RNG request', async () => {
                await drawBeacon.setRngRequest(0, 0);
                expect(await drawBeacon.getLastRngLockBlock()).to.equal(0);

                await drawBeacon.setRngRequest(1, 123);
                expect(await drawBeacon.getLastRngLockBlock()).to.equal(123);
            });
        });
        describe('getLastRngRequestId()', () => {
            it('should return the Request ID for the last RNG request', async () => {
                await drawBeacon.setRngRequest(0, 0);
                expect(await drawBeacon.getLastRngRequestId()).to.equal(0);

                await drawBeacon.setRngRequest(1, 123);
                expect(await drawBeacon.getLastRngRequestId()).to.equal(1);
            });
        });
        it('should get the getBeaconPeriodSeconds', async () => {
            expect(await drawBeacon.getBeaconPeriodSeconds()).to.equal(1000);
        });
        it('should get the beaconPeriodEndAt', async () => {
            expect(await drawBeacon.beaconPeriodEndAt()).to.equal(
                await drawBeacon.beaconPeriodEndAt(),
            );
        });
        it('should get the getBeaconPeriodSeconds', async () => {
            expect(await drawBeacon.getBeaconPeriodSeconds()).to.equal(1000);
        });
        it('should get the getBeaconPeriodStartedAt', async () => {
            expect(await drawBeacon.getBeaconPeriodStartedAt()).to.equal(
                await drawBeacon.getBeaconPeriodStartedAt(),
            );
        });
        it('should get the getDrawBuffer', async () => {
            expect(await drawBeacon.getDrawBuffer()).to.equal(drawBuffer.address);
        });
        it('should get the getLastRngLockBlock', async () => {
            expect(await drawBeacon.getLastRngLockBlock()).to.equal(0);
        });
        it('should get the getLastRngRequestId', async () => {
            expect(await drawBeacon.getLastRngRequestId()).to.equal(0);
        });
        it('should get the getRngTimeout', async () => {
            expect(await drawBeacon.getRngTimeout()).to.equal(rngTimeout);
        });
        it('should get the getRngService', async () => {
            expect(await drawBeacon.getRngService()).to.equal(rng.address);
        });
        it('should return current block.timestamp', async () => {
            const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
            expect(await drawBeacon._currentTimeInternal()).to.equal(timestamp);
        });
        describe('isBeaconPeriodOver()', () => {
            it('should determine if the prize-period is over', async () => {
                const startTime = await drawBeacon.getBeaconPeriodStartedAt();

                // Half-time
                await drawBeacon.setCurrentTime(startTime.add(halfTime));
                expect(await drawBeacon.isBeaconPeriodOver()).to.equal(false);

                // Over-time
                await drawBeacon.setCurrentTime(startTime.add(overTime));
                expect(await drawBeacon.isBeaconPeriodOver()).to.equal(true);
            });
        });
    });

    describe('Internal Functions', () => {
        it('should return the internally set block.timestamp', async () => {
            await drawBeacon.setCurrentTime(100);
            expect(await drawBeacon.currentTime()).to.equal(100);
        });

        it('should return current block.timestamp', async () => {
            const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
            expect(await drawBeacon._currentTimeInternal()).to.equal(timestamp);
        });
    });
});
