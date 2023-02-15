import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import {
    now,
    randomAddress,
    sleep,
    sleepTo,
    toObject,
    withSigner,
} from "./library/Helpers";
import Exceptions from "./library/Exceptions";
import { DelayedProtocolParamsStruct } from "./types/YearnVaultGovernance";

describe("YearnVaultGovernance", () => {
    let deploymentFixture: Function;
    let deployer: string;
    let admin: string;
    let stranger: string;
    let yearnVaultRegistry: string;
    let protocolGovernance: string;
    let vaultRegistry: string;
    let startTimestamp: number;

    before(async () => {
        const {
            deployer: d,
            admin: a,
            yearnVaultRegistry: y,
            stranger: s,
        } = await getNamedAccounts();
        [deployer, admin, yearnVaultRegistry, stranger] = [d, a, y, s];

        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();

            const { deploy, get } = deployments;
            protocolGovernance = (await get("ProtocolGovernance")).address;
            vaultRegistry = (await get("VaultRegistry")).address;

            await deploy("YearnVaultGovernance", {
                from: deployer,
                args: [
                    {
                        protocolGovernance: protocolGovernance,
                        registry: vaultRegistry,
                    },
                    { yearnVaultRegistry },
                ],
                autoMine: true,
            });
        });
    });

    beforeEach(async () => {
        await deploymentFixture();
        startTimestamp = now();
        await sleepTo(startTimestamp);
    });

    describe("stagedDelayedProtocolParams", () => {
        const paramsToStage: DelayedProtocolParamsStruct = {
            yearnVaultRegistry: randomAddress(),
        };

        it("returns delayed protocol params staged for commit", async () => {
            await deployments.execute(
                "YearnVaultGovernance",
                { from: admin, autoMine: true },
                "stageDelayedProtocolParams",
                paramsToStage
            );

            const stagedParams = await deployments.read(
                "YearnVaultGovernance",
                "stagedDelayedProtocolParams"
            );
            expect(toObject(stagedParams)).to.eql(paramsToStage);
        });

        describe("when uninitialized", () => {
            it("returns zero struct", async () => {
                const expectedParams: DelayedProtocolParamsStruct = {
                    yearnVaultRegistry: ethers.constants.AddressZero,
                };
                const stagedParams = await deployments.read(
                    "YearnVaultGovernance",
                    "stagedDelayedProtocolParams"
                );
                expect(toObject(stagedParams)).to.eql(expectedParams);
            });
        });
    });

    describe("delayedProtocolParams", () => {
        const paramsToStage: DelayedProtocolParamsStruct = {
            yearnVaultRegistry: randomAddress(),
        };

        it("returns delayed protocol params staged for commit", async () => {
            await deployments.execute(
                "YearnVaultGovernance",
                { from: admin, autoMine: true },
                "stageDelayedProtocolParams",
                paramsToStage
            );
            const governanceDelay = await deployments.read(
                "ProtocolGovernance",
                "governanceDelay"
            );
            await sleep(governanceDelay);

            await deployments.execute(
                "YearnVaultGovernance",
                { from: admin, autoMine: true },
                "commitDelayedProtocolParams"
            );

            const stagedParams = await deployments.read(
                "YearnVaultGovernance",
                "delayedProtocolParams"
            );
            expect(toObject(stagedParams)).to.eql(paramsToStage);
        });
    });

    describe("#stageDelayedProtocolParams", () => {
        const paramsToStage: DelayedProtocolParamsStruct = {
            yearnVaultRegistry: randomAddress(),
        };

        describe("when happy case", () => {
            beforeEach(async () => {
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedProtocolParams",
                    paramsToStage
                );
            });
            it("stages new delayed protocol params", async () => {
                const stagedParams = await deployments.read(
                    "YearnVaultGovernance",
                    "stagedDelayedProtocolParams"
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });

            it("sets the delay for commit", async () => {
                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                const timestamp = await deployments.read(
                    "YearnVaultGovernance",
                    "delayedProtocolParamsTimestamp"
                );
                expect(timestamp).to.eq(
                    governanceDelay.add(startTimestamp).add(1)
                );
            });
        });

        describe("when called not by protocol admin", () => {
            it("reverts", async () => {
                for (const actor of [deployer, stranger]) {
                    await expect(
                        deployments.execute(
                            "YearnVaultGovernance",
                            { from: actor, autoMine: true },
                            "stageDelayedProtocolParams",
                            paramsToStage
                        )
                    ).to.be.revertedWith(Exceptions.ADMIN);
                }
            });
        });
    });

    describe("#commitDelayedProtocolParams", () => {
        const paramsToCommit: DelayedProtocolParamsStruct = {
            yearnVaultRegistry: randomAddress(),
        };

        describe("when happy case", () => {
            beforeEach(async () => {
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedProtocolParams",
                    paramsToCommit
                );
                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: admin, autoMine: true },
                    "commitDelayedProtocolParams"
                );
            });
            it("commits staged protocol params", async () => {
                const protocolParams = await deployments.read(
                    "YearnVaultGovernance",
                    "delayedProtocolParams"
                );
                expect(toObject(protocolParams)).to.eql(paramsToCommit);
            });
            it("resets staged protocol params", async () => {
                const stagedProtocolParams = await deployments.read(
                    "YearnVaultGovernance",
                    "stagedDelayedProtocolParams"
                );
                expect(toObject(stagedProtocolParams)).to.eql({
                    yearnVaultRegistry: ethers.constants.AddressZero,
                });
            });
            it("resets staged protocol params timestamp", async () => {
                const stagedProtocolParams = await deployments.read(
                    "YearnVaultGovernance",
                    "delayedProtocolParamsTimestamp"
                );
                expect(toObject(stagedProtocolParams)).to.eq(0);
            });
        });

        describe("when called not by admin", () => {
            it("reverts", async () => {
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedProtocolParams",
                    paramsToCommit
                );
                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);

                for (const actor of [deployer, stranger]) {
                    await expect(
                        deployments.execute(
                            "YearnVaultGovernance",
                            { from: actor, autoMine: true },
                            "stageDelayedProtocolParams",
                            paramsToCommit
                        )
                    ).to.be.revertedWith(Exceptions.ADMIN);
                }
            });
        });

        describe("when time before delay has not elapsed", () => {
            it("reverts", async () => {
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedProtocolParams",
                    paramsToCommit
                );
                // immediate execution
                await expect(
                    deployments.execute(
                        "YearnVaultGovernance",
                        { from: admin, autoMine: true },
                        "commitDelayedProtocolParams"
                    )
                ).to.be.revertedWith(Exceptions.TIMESTAMP);

                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay.sub(15));
                // execution 15 seconds before the deadline
                await expect(
                    deployments.execute(
                        "YearnVaultGovernance",
                        { from: admin, autoMine: true },
                        "commitDelayedProtocolParams"
                    )
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });
    });

    describe("#yTokenForToken", () => {
        const YEARN_WETH_POOL =
            "0xa258C4606Ca8206D8aA700cE2143D7db854D168c".toLowerCase();
        it("returns a corresponding yVault for token", async () => {
            const { read } = deployments;
            const { weth } = await getNamedAccounts();
            const yToken = await read(
                "YearnVaultGovernance",
                "yTokenForToken",
                weth
            );
            expect(yToken.toLowerCase()).to.eq(YEARN_WETH_POOL);
        });

        describe("when overriden by setYTokenForToken", () => {
            it("returns overriden yToken", async () => {
                const { read } = deployments;
                const { weth, admin } = await getNamedAccounts();
                const newYToken = randomAddress();
                await withSigner(admin, async (s) => {
                    const g = await (
                        await ethers.getContract("YearnVaultGovernance")
                    ).connect(s);
                    await g.setYTokenForToken(weth, newYToken);
                });
                const yToken = await read(
                    "YearnVaultGovernance",
                    "yTokenForToken",
                    weth
                );
                expect(yToken.toLowerCase()).to.eq(newYToken.toLowerCase());
            });
        });

        describe("when yToken doesn't exist in overrides or yearnRegistry", () => {
            it("returns 0 address", async () => {
                const { read } = deployments;
                const yToken = await read(
                    "YearnVaultGovernance",
                    "yTokenForToken",
                    randomAddress()
                );
                expect(yToken).to.eq(ethers.constants.AddressZero);
            });
        });
    });

    describe("setYTokenForToken", () => {
        it("sets a yToken override for a token", async () => {
            const { read } = deployments;
            const { weth, admin } = await getNamedAccounts();
            const newYToken = randomAddress();
            await withSigner(admin, async (s) => {
                const g = (
                    await ethers.getContract("YearnVaultGovernance")
                ).connect(s);
                await g.setYTokenForToken(weth, newYToken);
            });
            const yToken = await read(
                "YearnVaultGovernance",
                "yTokenForToken",
                weth
            );
            expect(yToken.toLowerCase()).to.eq(newYToken.toLowerCase());
        });

        describe("when called not by admin", () => {
            it("reverts", async () => {
                const { weth, stranger, deployer } = await getNamedAccounts();
                for (const actor of [stranger, deployer]) {
                    await withSigner(actor, async (s) => {
                        const g = (
                            await ethers.getContract("YearnVaultGovernance")
                        ).connect(s);
                        await expect(
                            g.setYTokenForToken(weth, randomAddress())
                        ).to.be.revertedWith(Exceptions.ADMIN);
                    });
                }
            });
        });
    });
});
