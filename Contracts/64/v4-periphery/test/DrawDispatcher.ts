import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { artifacts, ethers } from "hardhat";
import { Artifact } from "hardhat/types";

import { IDrawBeacon } from "../types/@pooltogether/v4-core/contracts/interfaces/IDrawBuffer";

const { constants, getContractFactory, getSigners, provider, utils } = ethers;
const { getTransactionReceipt } = provider;
const { Interface, formatBytes32String } = utils;
const { AddressZero, Zero } = constants;

describe("DrawDispatcher", () => {
    let wallet: SignerWithAddress;

    let drawDispatcherFactory: ContractFactory;
    let drawDispatcher: Contract;

    let drawExecutorFactory: ContractFactory;
    let drawExecutor: Contract;

    let IMessageExecutor: Artifact;
    let messageExecutorMock: MockContract;

    let ISingleMessageDispatcher: Artifact;
    let messageDispatcherMock: MockContract;

    let IDrawBuffer: Artifact;
    let drawBufferMock: MockContract;

    const beaconPeriodSeconds = 86400;
    const originChainId = 1;
    const toChainId = 10;

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

    const drawIds = [DRAW_1.drawId, DRAW_2.drawId, NEWEST_DRAW.drawId];

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
        [wallet] = await getSigners();

        IMessageExecutor = await artifacts.readArtifact("IMessageExecutor");
        ISingleMessageDispatcher = await artifacts.readArtifact("ISingleMessageDispatcher");
        IDrawBuffer = await artifacts.readArtifact("IDrawBuffer");
        drawDispatcherFactory = await getContractFactory("DrawDispatcher");
        drawExecutorFactory = await getContractFactory("DrawExecutor");
    });

    beforeEach(async () => {
        messageExecutorMock = await deployMockContract(wallet, IMessageExecutor.abi);
        messageDispatcherMock = await deployMockContract(wallet, ISingleMessageDispatcher.abi);
        drawBufferMock = await deployMockContract(wallet, IDrawBuffer.abi);
        drawDispatcher = await drawDispatcherFactory.deploy(drawBufferMock.address);
        drawExecutor = await drawExecutorFactory.deploy(
            originChainId,
            drawDispatcher.address,
            messageExecutorMock.address,
            drawBufferMock.address
        );
    });

    describe("constructor()", () => {
        it("should deploy contract", async () => {
            expect(await drawDispatcher.callStatic.drawBuffer()).to.equal(drawBufferMock.address);
        });

        it("should fail to deploy contract if drawBuffer is address zero", async () => {
            await expect(drawDispatcherFactory.deploy(AddressZero)).to.be.revertedWith(
                "DD/drawBuffer-not-zero-address"
            );
        });
    });

    describe("dispatchNewestDraw()", async () => {
        it("should dispatch the newest recorded draw", async () => {
            await drawBufferMock.mock.getNewestDraw.returns(NEWEST_DRAW);

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

            await messageDispatcherMock.mock.dispatchMessage
                .withArgs(toChainId, drawExecutor.address, callData)
                .returns(mockedMessageId);

            await expect(
                drawDispatcher.dispatchNewestDraw(
                    messageDispatcherMock.address,
                    toChainId,
                    drawExecutor.address
                )
            )
                .to.emit(drawDispatcher, "DrawDispatched")
                .withArgs(messageDispatcherMock.address, toChainId, drawExecutor.address, [
                    winningRandomNumber,
                    drawId,
                    timestamp,
                    beaconPeriodStartedAt,
                    beaconPeriodSeconds,
                ]);
        });
    });

    describe("dispatchDraw()", async () => {
        it("should dispatch draw", async () => {
            const {
                winningRandomNumber,
                drawId,
                timestamp,
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
            } = DRAW_2;

            await drawBufferMock.mock.getDraw.withArgs(drawId).returns(DRAW_2);

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

            await messageDispatcherMock.mock.dispatchMessage
                .withArgs(toChainId, drawExecutor.address, callData)
                .returns(mockedMessageId);

            await expect(
                drawDispatcher.dispatchDraw(
                    messageDispatcherMock.address,
                    toChainId,
                    drawExecutor.address,
                    drawId
                )
            )
                .to.emit(drawDispatcher, "DrawDispatched")
                .withArgs(messageDispatcherMock.address, toChainId, drawExecutor.address, [
                    winningRandomNumber,
                    drawId,
                    timestamp,
                    beaconPeriodStartedAt,
                    beaconPeriodSeconds,
                ]);
        });

        it("should fail to dispatch draw if drawId is zero", async () => {
            await expect(
                drawDispatcher.dispatchDraw(
                    messageDispatcherMock.address,
                    toChainId,
                    drawExecutor.address,
                    Zero
                )
            ).to.be.revertedWith("DD/drawId-gt-zero");
        });
    });

    describe("dispatchDraws()", async () => {
        it("should dispatch several draws", async () => {
            await drawBufferMock.mock.getDraws.withArgs(drawIds).returns(draws);

            const callData = new Interface([
                "function pushDraws((uint256,uint32,uint64,uint64,uint32)[])",
            ]).encodeFunctionData("pushDraws", [draws]);

            await messageDispatcherMock.mock.dispatchMessage
                .withArgs(toChainId, drawExecutor.address, callData)
                .returns(mockedMessageId);

            const dispatchDrawsTx = await drawDispatcher.dispatchDraws(
                messageDispatcherMock.address,
                toChainId,
                drawExecutor.address,
                drawIds
            );

            await expect(dispatchDrawsTx).to.emit(drawDispatcher, "DrawsDispatched");

            const dispatchDrawsTxReceipt = await getTransactionReceipt(dispatchDrawsTx.hash);

            const dispatchDrawsTxEvents = dispatchDrawsTxReceipt.logs.map((log) => {
                try {
                    return drawDispatcher.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            });

            const drawsBridgedEvent = dispatchDrawsTxEvents.find(
                (event) => event && event.name === "DrawsDispatched"
            );

            if (drawsBridgedEvent) {
                expect(drawsBridgedEvent.args[0]).to.equal(messageDispatcherMock.address);
                expect(drawsBridgedEvent.args[1]).to.equal(toChainId);
                expect(drawsBridgedEvent.args[2]).to.equal(drawExecutor.address);
                drawsBridgedEvent.args[3].map((draw: IDrawBeacon.DrawStruct, index: number) => {
                    const currentDraw = draws[index];

                    expect(draw.winningRandomNumber).to.equal(currentDraw[0]);
                    expect(draw.drawId).to.equal(currentDraw[1]);
                    expect(draw.timestamp).to.equal(currentDraw[2]);
                    expect(draw.beaconPeriodStartedAt).to.equal(currentDraw[3]);
                    expect(draw.beaconPeriodSeconds).to.equal(currentDraw[4]);
                });
            }
        });
    });

    describe("_dispatchMessage()", async () => {
        it("should fail to dispatch message if dispatcher is address zero", async () => {
            const { drawId } = DRAW_2;

            await drawBufferMock.mock.getDraw.withArgs(drawId).returns(DRAW_2);

            await expect(
                drawDispatcher.dispatchDraw(AddressZero, toChainId, drawExecutor.address, drawId)
            ).to.be.revertedWith("DD/dispatcher-not-zero-address");
        });

        it("should fail to dispatch message if drawExecutor is address zero", async () => {
            const { drawId } = DRAW_2;

            await drawBufferMock.mock.getDraw.withArgs(drawId).returns(DRAW_2);

            await expect(
                drawDispatcher.dispatchDraw(
                    messageDispatcherMock.address,
                    toChainId,
                    AddressZero,
                    drawId
                )
            ).to.be.revertedWith("DD/drawExecutor-not-zero-address");
        });
    });
});
