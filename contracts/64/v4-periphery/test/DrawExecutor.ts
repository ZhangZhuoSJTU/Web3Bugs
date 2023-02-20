import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { artifacts, ethers } from "hardhat";
import { Artifact } from "hardhat/types";

import { IDrawBeacon } from "../types/@pooltogether/v4-core/contracts/interfaces/IDrawBuffer";

const { constants, getContractFactory, getSigners, provider, utils, Wallet } = ethers;
const { getTransactionReceipt } = provider;
const { Interface, formatBytes32String, solidityPack } = utils;
const { AddressZero, Zero } = constants;

describe("DrawExecutor", () => {
    let wallet: SignerWithAddress;
    let stranger: SignerWithAddress;

    let drawDispatcherFactory: ContractFactory;
    let drawDispatcher: Contract;

    let drawExecutorFactory: ContractFactory;
    let drawExecutor: Contract;

    let IDrawBuffer: Artifact;
    let drawBufferMock: MockContract;
    let drawBufferFactory: ContractFactory;
    let drawBuffer: Contract;

    const beaconPeriodSeconds = 86400;
    const fromChainId = 1;

    const mockedMessageId = formatBytes32String("");

    const NEWEST_DRAW = {
        winningRandomNumber: BigNumber.from(
            "40915453424841276066216659657882080769542951486300783855291357409493418239004"
        ),
        drawId: 3,
        timestamp: BigNumber.from(1670267603),
        beaconPeriodStartedAt: BigNumber.from(1670180400),
        beaconPeriodSeconds,
    };

    const DRAW_2 = {
        winningRandomNumber: BigNumber.from(
            "64339088980103463139645995941327992265254002724697124345779657466504643646813"
        ),
        drawId: 2,
        timestamp: BigNumber.from(1670008199),
        beaconPeriodStartedAt: BigNumber.from(1669921200),
        beaconPeriodSeconds,
    };

    const DRAW_1 = {
        winningRandomNumber: BigNumber.from(
            "80553736152766854578213568172612508909811630975130684656101794566871918526593"
        ),
        drawId: 1,
        timestamp: BigNumber.from(1669748591),
        beaconPeriodStartedAt: BigNumber.from(1669662000),
        beaconPeriodSeconds,
    };

    const draws = [
        [
            DRAW_1.winningRandomNumber,
            DRAW_1.drawId,
            DRAW_1.timestamp,
            DRAW_1.beaconPeriodStartedAt,
            DRAW_1.beaconPeriodSeconds,
        ],
        [
            DRAW_2.winningRandomNumber,
            DRAW_2.drawId,
            DRAW_2.timestamp,
            DRAW_2.beaconPeriodStartedAt,
            DRAW_2.beaconPeriodSeconds,
        ],
        [
            NEWEST_DRAW.winningRandomNumber,
            NEWEST_DRAW.drawId,
            NEWEST_DRAW.timestamp,
            NEWEST_DRAW.beaconPeriodStartedAt,
            NEWEST_DRAW.beaconPeriodSeconds,
        ],
    ];

    before(async () => {
        [wallet, stranger] = await getSigners();

        IDrawBuffer = await artifacts.readArtifact("IDrawBuffer");

        drawBufferFactory = await getContractFactory("DrawBuffer");
        drawDispatcherFactory = await getContractFactory("DrawDispatcher");
        drawExecutorFactory = await getContractFactory("DrawExecutor");
    });

    beforeEach(async () => {
        drawBufferMock = await deployMockContract(wallet, IDrawBuffer.abi);
        drawDispatcher = await drawDispatcherFactory.deploy(drawBufferMock.address);

        drawBuffer = await drawBufferFactory.deploy(wallet.address, 255);

        // To be able to send tx to drawExecutor, wallet is set as trusted executor
        drawExecutor = await drawExecutorFactory.deploy(
            fromChainId,
            drawDispatcher.address,
            wallet.address,
            drawBuffer.address
        );

        await drawBuffer.setManager(drawExecutor.address);
    });

    describe("constructor()", () => {
        it("should deploy contract", async () => {
            expect(await drawExecutor.callStatic.originChainId()).to.equal(fromChainId);
            expect(await drawExecutor.callStatic.drawDispatcher()).to.equal(drawDispatcher.address);
            expect(await drawExecutor.callStatic.trustedExecutor()).to.equal(wallet.address);
            expect(await drawExecutor.callStatic.drawBuffer()).to.equal(drawBuffer.address);
        });

        it("should fail to deploy contract if originChainId is zero", async () => {
            await expect(
                drawExecutorFactory.deploy(
                    Zero,
                    drawDispatcher.address,
                    wallet.address,
                    drawBuffer.address
                )
            ).to.be.revertedWith("DE/originChainId-not-zero");
        });

        it("should fail to deploy contract if drawDispatcher is address zero", async () => {
            await expect(
                drawExecutorFactory.deploy(
                    fromChainId,
                    AddressZero,
                    wallet.address,
                    drawBuffer.address
                )
            ).to.be.revertedWith("DE/drawDispatcher-not-zero-adrs");
        });

        it("should fail to deploy contract if executor is address zero", async () => {
            await expect(
                drawExecutorFactory.deploy(
                    fromChainId,
                    drawDispatcher.address,
                    AddressZero,
                    drawBuffer.address
                )
            ).to.be.revertedWith("executor-not-zero-address");
        });

        it("should fail to deploy contract if drawBuffer is address zero", async () => {
            await expect(
                drawExecutorFactory.deploy(
                    fromChainId,
                    drawDispatcher.address,
                    wallet.address,
                    AddressZero
                )
            ).to.be.revertedWith("DE/drawBuffer-not-zero-address");
        });
    });

    describe("pushDraw()", async () => {
        it("should push draw onto DrawBuffer", async () => {
            const {
                winningRandomNumber,
                drawId,
                timestamp,
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
            } = NEWEST_DRAW;

            const drawData = [
                winningRandomNumber,
                drawId,
                timestamp,
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
            ];

            const callData = new Interface([
                "function pushDraw((uint256,uint32,uint64,uint64,uint32))",
            ]).encodeFunctionData("pushDraw", [drawData]);

            const pushDrawTx = await wallet.sendTransaction({
                to: drawExecutor.address,
                data: solidityPack(
                    ["bytes", "bytes32", "uint256", "address"],
                    [callData, mockedMessageId, fromChainId, drawDispatcher.address]
                ),
            });

            await expect(pushDrawTx).to.emit(drawExecutor, "DrawPushed").withArgs(drawData);

            const pushDrawTxReceipt = await getTransactionReceipt(pushDrawTx.hash);

            const pushDrawTxEvents = pushDrawTxReceipt.logs.map((log) => {
                try {
                    return drawBuffer.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            });

            const drawSetEvent = pushDrawTxEvents.find(
                (event) => event && event.name === "DrawSet"
            );

            if (drawSetEvent) {
                expect(drawSetEvent.args[0]).to.equal(drawId);

                const draw = drawSetEvent.args[1];

                expect(draw.winningRandomNumber).to.equal(winningRandomNumber);
                expect(draw.drawId).to.equal(drawId);
                expect(draw.timestamp).to.equal(timestamp);
                expect(draw.beaconPeriodStartedAt).to.equal(beaconPeriodStartedAt);
                expect(draw.beaconPeriodSeconds).to.equal(beaconPeriodSeconds);
            }
        });

        it("should fail to push draw if not dispatched from originChainId", async () => {
            const {
                winningRandomNumber,
                drawId,
                timestamp,
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
            } = NEWEST_DRAW;

            const callData = new Interface([
                "function pushDraw((uint256,uint32,uint64,uint64,uint32))",
            ]).encodeFunctionData("pushDraw", [
                [
                    winningRandomNumber,
                    drawId,
                    timestamp,
                    beaconPeriodStartedAt,
                    beaconPeriodSeconds,
                ],
            ]);

            const randomWallet = Wallet.createRandom();

            await expect(
                wallet.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, 5, randomWallet.address]
                    ),
                })
            ).to.be.revertedWith("DE/l1-chainId-not-supported");
        });

        it("should fail to push draw if not dispatched by drawDispatcher", async () => {
            const {
                winningRandomNumber,
                drawId,
                timestamp,
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
            } = NEWEST_DRAW;

            const callData = new Interface([
                "function pushDraw((uint256,uint32,uint64,uint64,uint32))",
            ]).encodeFunctionData("pushDraw", [
                [
                    winningRandomNumber,
                    drawId,
                    timestamp,
                    beaconPeriodStartedAt,
                    beaconPeriodSeconds,
                ],
            ]);

            const randomWallet = Wallet.createRandom();

            await expect(
                wallet.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, fromChainId, randomWallet.address]
                    ),
                })
            ).to.be.revertedWith("DE/l1-sender-not-dispatcher");
        });

        it("should fail to push draw if not executed by trustedExecutor", async () => {
            const {
                winningRandomNumber,
                drawId,
                timestamp,
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
            } = NEWEST_DRAW;

            const callData = new Interface([
                "function pushDraw((uint256,uint32,uint64,uint64,uint32))",
            ]).encodeFunctionData("pushDraw", [
                [
                    winningRandomNumber,
                    drawId,
                    timestamp,
                    beaconPeriodStartedAt,
                    beaconPeriodSeconds,
                ],
            ]);

            await expect(
                stranger.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, fromChainId, drawDispatcher.address]
                    ),
                })
            ).to.be.revertedWith("DE/l2-sender-not-executor");
        });
    });

    describe("pushDraws()", async () => {
        it("should push draws onto DrawBuffer", async () => {
            const callData = new Interface([
                "function pushDraws((uint256,uint32,uint64,uint64,uint32)[])",
            ]).encodeFunctionData("pushDraws", [draws]);

            const pushDrawsTx = await wallet.sendTransaction({
                to: drawExecutor.address,
                data: solidityPack(
                    ["bytes", "bytes32", "uint256", "address"],
                    [callData, mockedMessageId, fromChainId, drawDispatcher.address]
                ),
            });

            const pushDrawsTxReceipt = await getTransactionReceipt(pushDrawsTx.hash);

            const pushDrawsTxEvents = pushDrawsTxReceipt.logs.map((log) => {
                try {
                    return drawExecutor.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            });

            const drawsPushedEvent = pushDrawsTxEvents.find(
                (event) => event && event.name === "DrawsPushed"
            );

            if (drawsPushedEvent) {
                drawsPushedEvent.args[0].map((draw: IDrawBeacon.DrawStruct, index: number) => {
                    const currentDraw = draws[index];

                    expect(draw.winningRandomNumber).to.equal(currentDraw[0]);
                    expect(draw.drawId).to.equal(currentDraw[1]);
                    expect(draw.timestamp).to.equal(currentDraw[2]);
                    expect(draw.beaconPeriodStartedAt).to.equal(currentDraw[3]);
                    expect(draw.beaconPeriodSeconds).to.equal(currentDraw[4]);
                });
            }
        });

        it("should fail to push draws if not in order", async () => {
            const callData = new Interface([
                "function pushDraws((uint256,uint32,uint64,uint64,uint32)[])",
            ]).encodeFunctionData("pushDraws", [[draws[1], draws[0], draws[2]]]);

            await expect(
                wallet.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, fromChainId, drawDispatcher.address]
                    ),
                })
            ).to.be.revertedWith("DRB/must-be-contig");
        });

        it("should fail to push draws if not dispatched from originChainId", async () => {
            const callData = new Interface([
                "function pushDraws((uint256,uint32,uint64,uint64,uint32)[])",
            ]).encodeFunctionData("pushDraws", [draws]);

            const randomWallet = Wallet.createRandom();

            await expect(
                wallet.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, 5, randomWallet.address]
                    ),
                })
            ).to.be.revertedWith("DE/l1-chainId-not-supported");
        });

        it("should fail to push draws if not dispatched by drawDispatcher", async () => {
            const callData = new Interface([
                "function pushDraws((uint256,uint32,uint64,uint64,uint32)[])",
            ]).encodeFunctionData("pushDraws", [draws]);

            const randomWallet = Wallet.createRandom();

            await expect(
                wallet.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, fromChainId, randomWallet.address]
                    ),
                })
            ).to.be.revertedWith("DE/l1-sender-not-dispatcher");
        });

        it("should fail to push draws if not executed by trustedExecutor", async () => {
            const callData = new Interface([
                "function pushDraws((uint256,uint32,uint64,uint64,uint32)[])",
            ]).encodeFunctionData("pushDraws", [draws]);

            await expect(
                stranger.sendTransaction({
                    to: drawExecutor.address,
                    data: solidityPack(
                        ["bytes", "bytes32", "uint256", "address"],
                        [callData, mockedMessageId, fromChainId, drawDispatcher.address]
                    ),
                })
            ).to.be.revertedWith("DE/l2-sender-not-executor");
        });
    });
});
