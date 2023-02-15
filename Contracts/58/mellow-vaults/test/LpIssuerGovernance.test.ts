import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { before } from "mocha";
import {
    now,
    randomAddress,
    sleep,
    sleepTo,
    toObject,
    withSigner,
} from "./library/Helpers";
import { deployLpIssuerGovernance } from "./library/Deployments";
import {
    LpIssuerGovernance,
    LpIssuerGovernance_constructor,
} from "./library/Types";
import {
    DelayedProtocolPerVaultParamsStruct,
    DelayedStrategyParamsStruct,
} from "./types/ILpIssuerGovernance";
import Exceptions from "./library/Exceptions";

/**
 * TODO: Define some sort of default params for a series of tests
 * and then do smth like `{...defaultParams, maxTokensPerVault: 12}`
 */
describe("LpIssuerGovernance", () => {
    let contract: LpIssuerGovernance;
    let deploymentFixture: Function;
    let deployer: Signer;
    let protocolTreasury: Signer;

    before(async () => {
        [deployer, protocolTreasury] = await ethers.getSigners();

        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();
            return await deployLpIssuerGovernance({
                adminSigner: deployer,
                treasury: await protocolTreasury.getAddress(),
            });
        });
    });

    beforeEach(async () => {
        let LpIssuerGovernanceSystem = await deploymentFixture();
        contract = LpIssuerGovernanceSystem.LpIssuerGovernance;
    });

    describe("constructor", () => {
        it("deploys", async () => {
            expect(contract.address).to.not.be.equal(
                ethers.constants.AddressZero
            );
        });
    });

    describe("setStrategyParams", () => {
        it("sets strategy params and emits SetStrategyParams event", async () => {
            let nft = Math.random() * 2 ** 52;
            let tokenLimit = Math.random() * 2 ** 52;
            await expect(
                await contract.setStrategyParams(nft, {
                    tokenLimitPerAddress: tokenLimit,
                })
            ).to.emit(contract, "SetStrategyParams");
        });
    });

    describe("strategyParams", () => {
        it("returns correct strategy params", async () => {
            let nft = Math.random() * 2 ** 52;
            let tokenLimit = Math.random() * 2 ** 52;
            await contract.setStrategyParams(nft, {
                tokenLimitPerAddress: tokenLimit,
            });
            expect(toObject(await contract.strategyParams(nft))).to.deep.equal({
                tokenLimitPerAddress: BigNumber.from(tokenLimit),
            });
        });
    });

    describe("stagedDelayedStrategyParams", () => {
        const paramsToStage: DelayedStrategyParamsStruct = {
            strategyTreasury: randomAddress(),
            strategyPerformanceTreasury: randomAddress(),
            managementFee: BigNumber.from(1000),
            performanceFee: BigNumber.from(2000),
        };
        let nft: number;
        let deploy: Function;
        let admin: string;
        let deployer: string;

        before(async () => {
            const {
                weth,
                wbtc,
                admin: a,
                deployer: d,
            } = await getNamedAccounts();
            [admin, deployer] = [a, d];
            deploy = deployments.createFixture(async () => {
                const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    [],
                    deployer
                );
                const yearnNft = (
                    await deployments.read("VaultRegistry", "vaultsCount")
                ).toNumber();
                const coder = ethers.utils.defaultAbiCoder;
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    coder.encode(
                        ["uint256", "string", "string"],
                        [yearnNft, "Test token", "Test token"]
                    ),
                    deployer
                );
            });
        });

        beforeEach(async () => {
            await deploy();
            nft = (
                await deployments.read("VaultRegistry", "vaultsCount")
            ).toNumber();
        });

        it("returns delayed strategy params staged for commit", async () => {
            await deployments.execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "stageDelayedStrategyParams",
                nft,
                paramsToStage
            );

            const stagedParams = await deployments.read(
                "LpIssuerGovernance",
                "stagedDelayedStrategyParams",
                nft
            );
            expect(toObject(stagedParams)).to.eql(paramsToStage);
        });

        describe("when uninitialized", () => {
            it("returns zero struct", async () => {
                const expectedParams: DelayedStrategyParamsStruct = {
                    strategyTreasury: ethers.constants.AddressZero,
                    strategyPerformanceTreasury: ethers.constants.AddressZero,
                    managementFee: BigNumber.from(0),
                    performanceFee: BigNumber.from(0),
                };
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(expectedParams);
            });
        });
    });

    describe("delayedStrategyParams", () => {
        const paramsToStage: DelayedStrategyParamsStruct = {
            strategyTreasury: randomAddress(),
            strategyPerformanceTreasury: randomAddress(),
            managementFee: BigNumber.from(1000),
            performanceFee: BigNumber.from(2000),
        };
        let nft: number;
        let deploy: Function;
        let admin: string;
        let deployer: string;

        before(async () => {
            const {
                weth,
                wbtc,
                admin: a,
                deployer: d,
            } = await getNamedAccounts();
            [admin, deployer] = [a, d];
            deploy = deployments.createFixture(async () => {
                const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    [],
                    deployer
                );
                const yearnNft = (
                    await deployments.read("VaultRegistry", "vaultsCount")
                ).toNumber();
                const coder = ethers.utils.defaultAbiCoder;
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    coder.encode(
                        ["uint256", "string", "string"],
                        [yearnNft, "Test token", "Test token"]
                    ),
                    deployer
                );
            });
        });

        beforeEach(async () => {
            await deploy();
            nft = (
                await deployments.read("VaultRegistry", "vaultsCount")
            ).toNumber();
        });

        it("returns delayed strategy params staged for commit", async () => {
            await deployments.execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "stageDelayedStrategyParams",
                nft,
                paramsToStage
            );

            const governanceDelay = await deployments.read(
                "ProtocolGovernance",
                "governanceDelay"
            );
            await sleep(governanceDelay);

            await deployments.execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "commitDelayedStrategyParams",
                nft
            );

            const params = await deployments.read(
                "LpIssuerGovernance",
                "delayedStrategyParams",
                nft
            );
            expect(toObject(params)).to.eql(paramsToStage);
        });

        describe("when uninitialized", () => {
            it("returns zero struct", async () => {
                const expectedParams: DelayedStrategyParamsStruct = {
                    strategyTreasury: ethers.constants.AddressZero,
                    strategyPerformanceTreasury: ethers.constants.AddressZero,
                    managementFee: BigNumber.from(0),
                    performanceFee: BigNumber.from(0),
                };
                const params = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );
                expect(toObject(params)).to.eql(expectedParams);
            });
        });
    });

    describe("#stageDelayedStrategyParams", () => {
        const paramsToStage: DelayedStrategyParamsStruct = {
            strategyTreasury: randomAddress(),
            strategyPerformanceTreasury: randomAddress(),
            managementFee: BigNumber.from(1000),
            performanceFee: BigNumber.from(2000),
        };
        let nft: number;
        let deploy: Function;
        let admin: string;
        let deployer: string;
        let stranger: string;
        let startTimestamp: number;

        before(async () => {
            const {
                weth,
                wbtc,
                admin: a,
                deployer: d,
                stranger: s,
            } = await getNamedAccounts();
            [admin, deployer, stranger] = [a, d, s];
            deploy = deployments.createFixture(async () => {
                const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    [],
                    deployer
                );
                const yearnNft = (
                    await deployments.read("VaultRegistry", "vaultsCount")
                ).toNumber();
                const coder = ethers.utils.defaultAbiCoder;
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    coder.encode(
                        ["uint256", "string", "string"],
                        [yearnNft, "Test token", "Test token"]
                    ),
                    deployer
                );
            });
        });

        beforeEach(async () => {
            await deploy();
            nft = (
                await deployments.read("VaultRegistry", "vaultsCount")
            ).toNumber();
            startTimestamp = now();
            await sleepTo(startTimestamp);
        });

        describe("when management fees is greater than MAX_MANAGEMENT_FEE", () => {
            it("reverts", async () => {
                const maxManagementFee = await deployments.read(
                    "LpIssuerGovernance",
                    "MAX_MANAGEMENT_FEE"
                );

                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    { ...paramsToStage, managementFee: maxManagementFee }
                );
                await expect(
                    deployments.execute(
                        "LpIssuerGovernance",
                        { from: admin, autoMine: true },
                        "stageDelayedStrategyParams",
                        nft,
                        {
                            ...paramsToStage,
                            managementFee: maxManagementFee.add(1),
                        }
                    )
                ).to.be.revertedWith(Exceptions.MAX_MANAGEMENT_FEE);
            });
        });

        describe("when performance fees is greater than MAX_PERFORMANCE_FEE", () => {
            it("reverts", async () => {
                const maxPerformanceFee = await deployments.read(
                    "LpIssuerGovernance",
                    "MAX_PERFORMANCE_FEE"
                );

                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    { ...paramsToStage, performanceFee: maxPerformanceFee }
                );
                await expect(
                    deployments.execute(
                        "LpIssuerGovernance",
                        { from: admin, autoMine: true },
                        "stageDelayedStrategyParams",
                        nft,
                        {
                            ...paramsToStage,
                            performanceFee: maxPerformanceFee.add(1),
                        }
                    )
                ).to.be.revertedWith(Exceptions.MAX_PERFORMANCE_FEE);
            });
        });

        describe("on first call (params are not initialized)", () => {
            beforeEach(async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToStage
                );
            });
            it("stages new delayed protocol params", async () => {
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });

            it("sets the delay = 0 for commit to enable instant init", async () => {
                const timestamp = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParamsTimestamp",
                    nft
                );
                expect(timestamp).to.eq(startTimestamp + 1);
            });
        });

        describe("on subsequent calls (params are initialized)", () => {
            beforeEach(async () => {
                const otherParams: DelayedStrategyParamsStruct = {
                    strategyTreasury: randomAddress(),
                    strategyPerformanceTreasury: randomAddress(),
                    managementFee: BigNumber.from(1000),
                    performanceFee: BigNumber.from(2000),
                };
                // init params
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    otherParams
                );
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "commitDelayedStrategyParams",
                    nft
                );
                // call stage again
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToStage
                );
            });
            it("stages new delayed protocol params", async () => {
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });

            it("sets the delay for commit", async () => {
                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                const timestamp = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParamsTimestamp",
                    nft
                );
                expect(timestamp).to.eq(
                    governanceDelay.add(startTimestamp).add(5)
                );
            });
        });

        describe("when called by protocol admin", () => {
            it("succeeds", async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToStage
                );
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });
        });

        describe("when called by VaultRegistry ERC721 owner", () => {
            it("succeeds", async () => {
                const owner = randomAddress();
                await deployments.execute(
                    "VaultRegistry",
                    { from: deployer, autoMine: true },
                    "transferFrom",
                    deployer,
                    owner,
                    nft
                );
                await withSigner(owner, async (s) => {
                    const g = await (
                        await ethers.getContract("LpIssuerGovernance")
                    ).connect(s);
                    await g.stageDelayedStrategyParams(nft, paramsToStage);
                });
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });
        });

        describe("when called by VaultRegistry ERC721 approved actor", () => {
            it("succeeds", async () => {
                const approved = randomAddress();
                await deployments.execute(
                    "VaultRegistry",
                    { from: deployer, autoMine: true },
                    "approve",
                    approved,
                    nft
                );
                await withSigner(approved, async (signer) => {
                    // default deployment commands don't work with unknown signer :(
                    // https://github.com/nomiclabs/hardhat/issues/1226
                    // so need to use ethers here
                    const g = await (
                        await ethers.getContract("LpIssuerGovernance")
                    ).connect(signer);
                    await g.stageDelayedStrategyParams(nft, paramsToStage);
                });
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });
        });

        describe("when called not by protocol admin or not by strategy", () => {
            it("reverts", async () => {
                await expect(
                    deployments.execute(
                        "LpIssuerGovernance",
                        { from: stranger, autoMine: true },
                        "stageDelayedStrategyParams",
                        nft,
                        paramsToStage
                    )
                ).to.be.revertedWith(Exceptions.REQUIRE_AT_LEAST_ADMIN);
            });
        });
    });

    describe("#commitDelayedStrategyParams", () => {
        const paramsToCommit: DelayedStrategyParamsStruct = {
            strategyTreasury: randomAddress(),
            strategyPerformanceTreasury: randomAddress(),
            managementFee: BigNumber.from(1000),
            performanceFee: BigNumber.from(2000),
        };
        let nft: number;
        let deploy: Function;
        let admin: string;
        let deployer: string;
        let stranger: string;
        let startTimestamp: number;

        before(async () => {
            const {
                weth,
                wbtc,
                admin: a,
                deployer: d,
                stranger: s,
            } = await getNamedAccounts();
            [admin, deployer, stranger] = [a, d, s];
            deploy = deployments.createFixture(async () => {
                const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    [],
                    deployer
                );
                const yearnNft = (
                    await deployments.read("VaultRegistry", "vaultsCount")
                ).toNumber();
                const coder = ethers.utils.defaultAbiCoder;
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    coder.encode(
                        ["uint256", "string", "string"],
                        [yearnNft, "Test token", "Test token"]
                    ),
                    deployer
                );
            });
        });

        beforeEach(async () => {
            await deploy();
            nft = (
                await deployments.read("VaultRegistry", "vaultsCount")
            ).toNumber();
            startTimestamp = now();
            await sleepTo(startTimestamp);
        });

        describe("on first call (params are not initialized)", () => {
            beforeEach(async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToCommit
                );
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "commitDelayedStrategyParams",
                    nft
                );
            });
            it("commits new delayed protocol params immediately", async () => {
                const params = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );
                expect(toObject(params)).to.eql(paramsToCommit);
            });

            it("resets staged strategy params", async () => {
                const params = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(params)).to.eql({
                    strategyTreasury: ethers.constants.AddressZero,
                    strategyPerformanceTreasury: ethers.constants.AddressZero,
                    managementFee: BigNumber.from(0),
                    performanceFee: BigNumber.from(0),
                });
            });

            it("resets staged strategy params timestamp", async () => {
                const timestamp = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParamsTimestamp",
                    nft
                );
                expect(timestamp).to.eq(0);
            });
        });

        describe("on subsequent calls (params are initialized)", () => {
            beforeEach(async () => {
                const otherParams: DelayedStrategyParamsStruct = {
                    strategyTreasury: randomAddress(),
                    strategyPerformanceTreasury: randomAddress(),
                    managementFee: BigNumber.from(1000),
                    performanceFee: BigNumber.from(2000),
                };
                // init params
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    otherParams
                );
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "commitDelayedStrategyParams",
                    nft
                );
                // call stage again
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToCommit
                );
                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);
            });
            it("commits new delayed protocol params", async () => {
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToCommit);
            });

            describe("when time before delay has not elapsed", () => {
                it("reverts", async () => {
                    await deployments.execute(
                        "LpIssuerGovernance",
                        { from: admin, autoMine: true },
                        "stageDelayedStrategyParams",
                        nft,
                        paramsToCommit
                    );

                    // immediate execution
                    await expect(
                        deployments.execute(
                            "LpIssuerGovernance",
                            { from: admin, autoMine: true },
                            "commitDelayedStrategyParams",
                            nft
                        )
                    ).to.be.revertedWith(Exceptions.TIMESTAMP);

                    const governanceDelay = await deployments.read(
                        "ProtocolGovernance",
                        "governanceDelay"
                    );
                    await sleep(governanceDelay.sub(150));
                    // execution 15 seconds before the deadline
                    await expect(
                        deployments.execute(
                            "LpIssuerGovernance",
                            { from: admin, autoMine: true },
                            "commitDelayedStrategyParams",
                            nft
                        )
                    ).to.be.revertedWith(Exceptions.TIMESTAMP);
                });
            });
        });

        describe("when called by protocol admin", () => {
            it("succeeds", async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToCommit
                );

                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "commitDelayedStrategyParams",
                    nft
                );
                const strategyParams = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );
                expect(toObject(strategyParams)).to.eql(paramsToCommit);
            });
        });

        describe("when called by VaultRegistry ERC721 owner", () => {
            it("succeeds", async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToCommit
                );

                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);

                const owner = randomAddress();
                await deployments.execute(
                    "VaultRegistry",
                    { from: deployer, autoMine: true },
                    "transferFrom",
                    deployer,
                    owner,
                    nft
                );
                await withSigner(owner, async (s) => {
                    const g = await (
                        await ethers.getContract("LpIssuerGovernance")
                    ).connect(s);
                    await g.commitDelayedStrategyParams(nft);
                });
                const params = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );
                expect(toObject(params)).to.eql(paramsToCommit);
            });
        });

        describe("when called by VaultRegistry ERC721 approved actor", () => {
            it("succeeds", async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedStrategyParams",
                    nft,
                    paramsToCommit
                );

                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);

                const approved = randomAddress();
                await deployments.execute(
                    "VaultRegistry",
                    { from: deployer, autoMine: true },
                    "approve",
                    approved,
                    nft
                );
                await withSigner(approved, async (signer) => {
                    // default deployment commands don't work with unknown signer :(
                    // https://github.com/nomiclabs/hardhat/issues/1226
                    // so need to use ethers here
                    const g = await (
                        await ethers.getContract("LpIssuerGovernance")
                    ).connect(signer);
                    await g.commitDelayedStrategyParams(nft);
                });
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToCommit);
            });
        });

        describe("when called not by protocol admin or not by strategy", () => {
            it("reverts", async () => {
                const governanceDelay = await deployments.read(
                    "ProtocolGovernance",
                    "governanceDelay"
                );
                await sleep(governanceDelay);

                await expect(
                    deployments.execute(
                        "LpIssuerGovernance",
                        { from: stranger, autoMine: true },
                        "commitDelayedStrategyParams",
                        nft
                    )
                ).to.be.revertedWith(Exceptions.REQUIRE_AT_LEAST_ADMIN);
            });
        });
    });

    describe("#stageDelayedProtocolPerVaultParams", () => {
        const paramsToStage: DelayedProtocolPerVaultParamsStruct = {
            protocolFee: BigNumber.from(1000),
        };
        let nft: number;
        let deploy: Function;
        let admin: string;
        let deployer: string;
        let stranger: string;
        let startTimestamp: number;

        before(async () => {
            const {
                weth,
                wbtc,
                admin: a,
                deployer: d,
                stranger: s,
            } = await getNamedAccounts();
            [admin, deployer, stranger] = [a, d, s];
            deploy = deployments.createFixture(async () => {
                const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
                await deployments.execute(
                    "YearnVaultGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    [],
                    deployer
                );
                const yearnNft = (
                    await deployments.read("VaultRegistry", "vaultsCount")
                ).toNumber();
                const coder = ethers.utils.defaultAbiCoder;
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: deployer, autoMine: true },
                    "deployVault",
                    tokens,
                    coder.encode(
                        ["uint256", "string", "string"],
                        [yearnNft, "Test token", "Test token"]
                    ),
                    deployer
                );
            });
        });

        beforeEach(async () => {
            await deploy();
            nft = (
                await deployments.read("VaultRegistry", "vaultsCount")
            ).toNumber();
            startTimestamp = now();
            await sleepTo(startTimestamp);
        });

        describe("when called by protocol admin", () => {
            it("succeeds", async () => {
                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedProtocolPerVaultParams",
                    nft,
                    paramsToStage
                );
                const stagedParams = await deployments.read(
                    "LpIssuerGovernance",
                    "stagedDelayedProtocolPerVaultParams",
                    nft
                );
                expect(toObject(stagedParams)).to.eql(paramsToStage);
            });
        });

        describe("when management fees is greater than MAX_PROTOCOL_FEE", () => {
            it("reverts", async () => {
                const maxProtocolFee = await deployments.read(
                    "LpIssuerGovernance",
                    "MAX_PROTOCOL_FEE"
                );

                await deployments.execute(
                    "LpIssuerGovernance",
                    { from: admin, autoMine: true },
                    "stageDelayedProtocolPerVaultParams",
                    nft,
                    { ...paramsToStage, protocolFee: maxProtocolFee }
                );
                await expect(
                    deployments.execute(
                        "LpIssuerGovernance",
                        { from: admin, autoMine: true },
                        "stageDelayedProtocolPerVaultParams",
                        nft,
                        {
                            ...paramsToStage,
                            protocolFee: maxProtocolFee.add(1),
                        }
                    )
                ).to.be.revertedWith(Exceptions.MAX_PROTOCOL_FEE);
            });
        });

        describe("when called not by protocol admin", () => {
            it("reverts", async () => {
                await expect(
                    deployments.execute(
                        "LpIssuerGovernance",
                        { from: stranger, autoMine: true },
                        "stageDelayedProtocolPerVaultParams",
                        nft,
                        paramsToStage
                    )
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });
    });
});
