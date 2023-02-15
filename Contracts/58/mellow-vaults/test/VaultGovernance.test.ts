import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { BigNumber, Signer } from "ethers";
import Exceptions from "./library/Exceptions";
import {
    encodeToBytes,
    now,
    sleep,
    sleepTo,
    toObject,
} from "./library/Helpers";
import {
    deployProtocolGovernance,
    deployTestVaultGovernanceSystem,
    deployVaultRegistry,
} from "./library/Deployments";
import {
    ProtocolGovernance,
    TestVaultGovernance,
    VaultFactory,
    VaultGovernance_InternalParams,
    VaultRegistry,
    ProtocolGovernance_Params,
} from "./library/Types";

describe("TestVaultGovernance", () => {
    const SECONDS_PER_DAY = 60 * 60 * 24;

    let deploymentFixture: Function;
    let deployer: Signer;
    let stranger: Signer;
    let treasury: Signer;
    let newTreasury: Signer;
    let contract: TestVaultGovernance;
    let protocolGovernance: ProtocolGovernance;
    let vaultRegistry: VaultRegistry;
    let initialParams: any;
    let emptyParams: VaultGovernance_InternalParams;
    let customParams: VaultGovernance_InternalParams;
    let timestamp: number;
    let timeshift: number;
    let timeEps: number;
    let newVaultRegistry: VaultRegistry;
    let newProtocolGovernance: ProtocolGovernance;
    let vaultFactory: VaultFactory;
    let newVaultFactory: Signer;
    let testVaultGovernanceSystem: any;
    let protocolParams: ProtocolGovernance_Params;
    let encodedParams: any;
    let defaultDelay: number;

    before(async () => {
        timestamp = now();
        timeshift = 10 ** 6;
        timeEps = 2;
        defaultDelay = SECONDS_PER_DAY;

        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();
            [deployer, stranger, treasury, newTreasury, newVaultFactory] =
                await ethers.getSigners();

            return await deployTestVaultGovernanceSystem({
                adminSigner: deployer,
                treasury: await treasury.getAddress(),
            });
        });
    });

    beforeEach(async () => {
        testVaultGovernanceSystem = await deploymentFixture();
        const { protocolTreasury } = await getNamedAccounts();

        contract = testVaultGovernanceSystem.vaultGovernance;
        vaultRegistry = testVaultGovernanceSystem.vaultRegistry;
        vaultFactory = testVaultGovernanceSystem.vaultFactory;
        protocolGovernance = testVaultGovernanceSystem.protocolGovernance;

        initialParams = toObject(await contract.internalParams());

        emptyParams = {
            protocolGovernance: ethers.constants.AddressZero,
            registry: ethers.constants.AddressZero,
        };

        newProtocolGovernance = await deployProtocolGovernance({
            constructorArgs: {
                admin: await deployer.getAddress(),
            },
            adminSigner: deployer,
        });

        newVaultRegistry = await deployVaultRegistry({
            name: "NAME",
            symbol: "SYM",
            protocolGovernance: newProtocolGovernance,
        });

        customParams = {
            protocolGovernance: newProtocolGovernance.address,
            registry: newVaultRegistry.address,
        };

        protocolParams = {
            permissionless: true,
            maxTokensPerVault: BigNumber.from(2),
            governanceDelay: BigNumber.from(1),
            protocolTreasury,
        };

        encodedParams = encodeToBytes(
            [
                "tuple(" +
                    "bool permissionless, " +
                    "uint256 maxTokensPerVault, " +
                    "uint256 governanceDelay)" +
                    "protocolParams",
            ],
            [protocolParams]
        );
    });

    describe("constructor", () => {
        it("internal params timestamp == 0", async () => {
            expect(await contract.internalParamsTimestamp()).to.be.equal(
                BigNumber.from(0)
            );
        });

        it("sets initial internal params", async () => {
            expect(toObject(await contract.internalParams())).to.deep.equal(
                initialParams
            );
        });

        it("has initial staged internal params", async () => {
            expect(
                toObject(await contract.stagedInternalParams())
            ).to.deep.equal(initialParams);
        });

        it("delayed protocol params timestamp == 0", async () => {
            expect(await contract.delayedProtocolParamsTimestamp()).to.be.equal(
                BigNumber.from(0)
            );
        });

        it("has zero delayed strategy params timestamps", async () => {
            expect(
                await contract.delayedStrategyParamsTimestamp(0)
            ).to.be.equal(BigNumber.from(0));

            for (let i: number = 0; i < 100; ++i) {
                expect(
                    await contract.delayedStrategyParamsTimestamp(
                        Math.random() * 2 ** 52
                    )
                ).to.be.equal(BigNumber.from(0));
            }
        });
    });

    describe("stageInternalParams", () => {
        describe("when called by not admin", () => {
            it("reverts", async () => {
                await expect(
                    contract
                        .connect(stranger)
                        .stageInternalParams(initialParams)
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        it("sets internal params timestamp", async () => {
            timestamp += timeshift;
            sleepTo(timestamp);
            await contract.stageInternalParams(initialParams);
            expect(
                Math.abs(
                    (await contract.internalParamsTimestamp()) -
                        timestamp -
                        defaultDelay
                )
            ).lessThanOrEqual(timeEps);
        });

        it("sets params and emits StagedInternalParams", async () => {
            let customParamsZero: VaultGovernance_InternalParams;

            let newProtocolGovernanceZero = await deployProtocolGovernance({
                adminSigner: deployer,
            });
            let newVaultRegistryZero = await deployVaultRegistry({
                name: "",
                symbol: "",
                protocolGovernance: newProtocolGovernanceZero,
            });

            customParamsZero = {
                protocolGovernance: newProtocolGovernanceZero.address,
                registry: newVaultRegistryZero.address,
            };

            await expect(
                await contract.stageInternalParams(customParamsZero)
            ).to.emit(contract, "StagedInternalParams");

            expect(
                toObject(await contract.stagedInternalParams())
            ).to.deep.equal(customParamsZero);
        });
    });

    describe("commitInternalParams", () => {
        describe("when called by not admin", () => {
            it("reverts", async () => {
                await contract.stageInternalParams(initialParams);

                await expect(
                    contract.connect(stranger).commitInternalParams()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when internal params timestamp == 0", () => {
            it("reverts", async () => {
                await expect(
                    contract.commitInternalParams()
                ).to.be.revertedWith(Exceptions.NULL);
            });
        });

        describe("when governance delay has not passed or has almost passed", () => {
            it("reverts", async () => {
                let customParams: VaultGovernance_InternalParams;

                let newProtocolGovernance = await deployProtocolGovernance({
                    constructorArgs: {
                        admin: await deployer.getAddress(),
                    },
                    adminSigner: deployer,
                });

                let newVaultRegistry = await deployVaultRegistry({
                    name: "",
                    symbol: "",
                    protocolGovernance: newProtocolGovernance,
                });

                await newProtocolGovernance.setPendingParams({
                    maxTokensPerVault: BigNumber.from(2),
                    governanceDelay: BigNumber.from(100),
                    protocolPerformanceFee: BigNumber.from(10 ** 9),
                    strategyPerformanceFee: BigNumber.from(10 ** 9),
                    protocolExitFee: BigNumber.from(10 ** 9),
                    protocolTreasury: await treasury.getAddress(),
                    vaultRegistry: newVaultRegistry.address,
                });
                await sleep(defaultDelay);
                await newProtocolGovernance.commitParams();

                customParams = {
                    protocolGovernance: newProtocolGovernance.address,
                    registry: newVaultRegistry.address,
                };

                timestamp += timeshift;
                sleepTo(timestamp);

                await contract.stageInternalParams(customParams);
                await sleep(defaultDelay);
                await contract.commitInternalParams();

                await contract.stageInternalParams(initialParams);

                await expect(
                    contract.commitInternalParams()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);

                sleep(95);
                await expect(
                    contract.commitInternalParams()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });

        it("sets new params, deletes internal params timestamp, emits CommitedInternalParams", async () => {
            await contract.stageInternalParams(customParams);
            await sleep(defaultDelay);
            await expect(contract.commitInternalParams()).to.emit(
                contract,
                "CommitedInternalParams"
            );

            expect(await contract.internalParamsTimestamp()).to.be.equal(
                BigNumber.from(0)
            );

            expect(toObject(await contract.internalParams())).to.deep.equal(
                customParams
            );
        });
    });

    describe("_stageDelayedStrategyParams", () => {
        it("sets _stagedDelayedStrategyParams and _delayedStrategyParamsTimestamp", async () => {
            let params = encodeToBytes(
                ["address"],
                [await newTreasury.getAddress()]
            );
            let nft = Math.random() * 2 ** 52;

            timestamp += timeshift;
            sleepTo(timestamp);

            await contract.stageDelayedStrategyParams(nft, params);

            expect(
                await contract.getStagedDelayedStrategyParams(nft)
            ).to.deep.equal(params);

            expect(
                Math.abs(
                    (await contract.getDelayedStrategyParamsTimestamp(nft)) -
                        timestamp
                )
            ).to.be.lessThanOrEqual(timeEps);
        });

        describe("when called by not admin and not by nft owner", () => {
            it("reverts", async () => {
                let params = encodeToBytes(
                    ["address"],
                    [await newTreasury.getAddress()]
                );
                await expect(
                    contract
                        .connect(stranger)
                        .stageDelayedStrategyParams(
                            Math.random() * 2 ** 52,
                            params
                        )
                ).to.be.reverted;
            });
        });
    });

    describe("_stageDelayedProtocolParams", () => {
        it("sets _stagedDelayedProtocolParams and _delayedProtocolParamsTimestamp", async () => {
            timestamp += timeshift;
            sleepTo(timestamp);

            await contract.stageDelayedProtocolParams(encodedParams);

            expect(
                await contract.getStagedDelayedProtocolParams()
            ).to.deep.equal(encodedParams);

            expect(
                Math.abs(
                    (await contract.getDelayedProtocolParamsTimestamp()) -
                        timestamp
                )
            ).to.be.lessThanOrEqual(timeEps);
        });

        describe("when called not by admin", () => {
            it("reverts", async () => {
                await expect(
                    contract
                        .connect(stranger)
                        .stageDelayedProtocolParams(encodedParams)
                ).to.be.reverted;
            });
        });
    });

    describe("_commitDelayedStrategyParams", () => {
        it("sets _delayedStrategyParams[nft] and deletes _delayedStrategyParamsTimestamp[nft]", async () => {
            let params = encodeToBytes(
                ["address"],
                [await newTreasury.getAddress()]
            );
            let nft = Math.random() * 2 ** 52;
            await contract.stageDelayedStrategyParams(nft, params);
            await sleep(defaultDelay);
            contract.commitDelayedStrategyParams(nft);
            expect(await contract.getDelayedStrategyParams(nft)).to.be.equal(
                params
            );
            expect(
                await contract.getDelayedStrategyParamsTimestamp(nft)
            ).to.be.equal(BigNumber.from(0));
        });

        describe("when called by not admin and not by nft owner", () => {
            it("reverts", async () => {
                let params = encodeToBytes(
                    ["address"],
                    [await newTreasury.getAddress()]
                );
                let nft = Math.random() * 2 ** 52;
                await contract.stageDelayedStrategyParams(nft, params);

                await expect(
                    contract.connect(stranger).commitDelayedStrategyParams(nft)
                ).to.be.reverted;
            });
        });

        describe("when stageDelayedStrategyParams has not been called", () => {
            it("reverts", async () => {
                let nft = Math.random() * 2 ** 52;
                await expect(
                    contract.commitDelayedStrategyParams(nft)
                ).to.be.revertedWith(Exceptions.NULL);
            });
        });

        describe("when _delayedStrategyParamsTimestamp[nft] has not passed or has almost passed", () => {
            it("reverts", async () => {
                let params = encodeToBytes(
                    ["address"],
                    [await newTreasury.getAddress()]
                );
                let nft = Math.random() * 2 ** 52;

                let newProtocolGovernance = await deployProtocolGovernance({
                    constructorArgs: {
                        admin: await deployer.getAddress(),
                    },
                    adminSigner: deployer,
                });

                let newVaultRegistry = await deployVaultRegistry({
                    name: "n",
                    symbol: "s",
                    protocolGovernance: newProtocolGovernance,
                });

                await newProtocolGovernance.setPendingParams({
                    maxTokensPerVault: BigNumber.from(2),
                    governanceDelay: BigNumber.from(100),
                    protocolPerformanceFee: BigNumber.from(10 ** 9),
                    strategyPerformanceFee: BigNumber.from(10 ** 9),
                    protocolExitFee: BigNumber.from(10 ** 9),
                    protocolTreasury: await treasury.getAddress(),
                    vaultRegistry: newVaultRegistry.address,
                });
                await sleep(defaultDelay);
                await newProtocolGovernance.commitParams();
                timestamp += timeshift;
                sleepTo(timestamp);

                await contract.stageInternalParams({
                    protocolGovernance: newProtocolGovernance.address,
                    registry: newVaultRegistry.address,
                    factory: vaultFactory.address,
                });
                await sleep(defaultDelay);
                await contract.commitInternalParams();

                await contract.stageDelayedStrategyParams(nft, params);

                // First time we can commit immediately
                await expect(
                    contract.commitDelayedStrategyParams(nft)
                ).not.to.be.revertedWith(Exceptions.TIMESTAMP);

                sleep(95);
                await contract.stageDelayedStrategyParams(nft, params);
                await expect(
                    contract.commitDelayedStrategyParams(nft)
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });
    });

    describe("_commitDelayedProtocolParams", () => {
        it("sets _delayedProtocolParams and deletes _delayedProtocolParamsTimestamp", async () => {
            await contract.stageDelayedProtocolParams(encodedParams);
            await sleep(defaultDelay);
            contract.commitDelayedProtocolParams();

            expect(await contract.getDelayedProtocolParams()).to.be.equal(
                encodedParams
            );
            expect(
                await contract.getDelayedProtocolParamsTimestamp()
            ).to.be.equal(BigNumber.from(0));
        });

        describe("when called by not admin", () => {
            it("reverts", async () => {
                await contract.stageDelayedProtocolParams(encodedParams);
                await expect(
                    contract.connect(stranger).commitDelayedProtocolParams()
                ).to.be.reverted;
            });
        });

        describe("when stageDelayedProtocolParams has not been called", () => {
            it("reverts", async () => {
                await expect(
                    contract.commitDelayedProtocolParams()
                ).to.be.revertedWith(Exceptions.NULL);
            });
        });

        describe("when _delayedProtocolParamsTimestamp has not passed or has almost passed", () => {
            it("reverts", async () => {
                let newProtocolGovernance = await deployProtocolGovernance({
                    constructorArgs: {
                        admin: await deployer.getAddress(),
                    },
                    adminSigner: deployer,
                });
                let newVaultRegistry = await deployVaultRegistry({
                    name: "n",
                    symbol: "s",
                    protocolGovernance: newProtocolGovernance,
                });
                await newProtocolGovernance.setPendingParams({
                    maxTokensPerVault: BigNumber.from(2),
                    governanceDelay: BigNumber.from(100),
                    protocolPerformanceFee: BigNumber.from(10 ** 9),
                    strategyPerformanceFee: BigNumber.from(10 ** 9),
                    protocolExitFee: BigNumber.from(10 ** 9),
                    protocolTreasury: await treasury.getAddress(),
                    vaultRegistry: newVaultRegistry.address,
                });
                await sleep(defaultDelay);
                await newProtocolGovernance.commitParams();

                timestamp += timeshift;
                sleepTo(timestamp);

                await contract.stageInternalParams({
                    protocolGovernance: newProtocolGovernance.address,
                    registry: newVaultRegistry.address,
                    factory: vaultFactory.address,
                });
                await sleep(defaultDelay);
                await contract.commitInternalParams();
                await contract.stageDelayedProtocolParams(encodedParams);
                await expect(
                    contract.commitDelayedProtocolParams()
                ).to.not.be.revertedWith(Exceptions.TIMESTAMP);

                sleep(95);
                await contract.stageDelayedProtocolParams(encodedParams);
                await expect(
                    contract.commitDelayedProtocolParams()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });
    });

    describe("_setStrategyParams", () => {
        it("sets strategy params", async () => {
            let params = encodeToBytes(
                ["address"],
                [await newTreasury.getAddress()]
            );
            let nft = Math.random() * 2 ** 52;

            await contract.setStrategyParams(nft, params);

            expect(await contract.getStrategyParams(nft)).to.be.equal(params);
        });

        describe("when called by not admin and not by nft owner", () => {
            it("reverts", async () => {
                let params = encodeToBytes(
                    ["address"],
                    [await newTreasury.getAddress()]
                );
                let nft = Math.random() * 2 ** 52;
                await expect(
                    contract.connect(stranger).setStrategyParams(nft, params)
                ).to.be.reverted;
            });
        });
    });

    describe("_setProtocolParams", () => {
        it("sets protocol params", async () => {
            await contract.setProtocolParams(encodedParams);

            expect(await contract.getProtocolParams()).to.be.equal(
                encodedParams
            );
        });

        describe("when called by not admin", () => {
            it("reverts", async () => {
                await expect(
                    contract.connect(stranger).setProtocolParams(encodedParams)
                ).to.be.reverted;
            });
        });
    });

    describe("initialize", () => {
        describe("when already initialized", () => {
            it("reverts", async () => {
                contract
                    .connect(deployer)
                    .initialize(await newVaultFactory.getAddress());
                await expect(
                    contract
                        .connect(deployer)
                        .initialize(await newVaultFactory.getAddress())
                ).to.be.revertedWith(Exceptions.INITIALIZED_ALREADY);
            });
        });
        it("initializes vault factory", async () => {
            await contract.initialize(await newVaultFactory.getAddress());
            expect(await contract.initialized()).to.be.equal(true);
            expect(await contract.factory()).to.be.equal(
                await newVaultFactory.getAddress()
            );
        });
    });

    describe("deployVault", () => {
        describe("when vault factory has not been initialized", () => {
            it("reverts", async () => {
                await expect(
                    contract
                        .connect(deployer)
                        .deployVault([], [], await deployer.getAddress())
                ).to.be.revertedWith(Exceptions.INITIALIZED_ALREADY);
            });
        });

        describe("when called by not admin", () => {
            it("reverts", async () => {
                await protocolGovernance.connect(deployer).setPendingParams({
                    permissionless: false,
                    maxTokensPerVault: BigNumber.from(10),
                    governanceDelay: BigNumber.from(60 * 60 * 24), // 1 day
                    strategyPerformanceFee: BigNumber.from(10 * 10 ** 9),
                    protocolPerformanceFee: BigNumber.from(2 * 10 ** 9),
                    protocolExitFee: BigNumber.from(10 ** 9),
                    protocolTreasury: await treasury.getAddress(),
                    vaultRegistry: vaultRegistry.address,
                });
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await protocolGovernance.connect(deployer).commitParams();

                await contract.initialize(await newVaultFactory.getAddress());
                await expect(
                    contract
                        .connect(stranger)
                        .deployVault([], [], await deployer.getAddress())
                ).to.be.revertedWith(Exceptions.PERMISSIONLESS_OR_ADMIN);
            });
        });
    });

    describe("_requireProtocolAdmin", () => {
        describe("when called by admin", () => {
            it("not reverts", async () => {
                await expect(contract.requireProtocolAdmin()).to.not.be
                    .reverted;
            });
        });

        describe("when called by admin", () => {
            it("reverts", async () => {
                await expect(
                    contract.connect(stranger).requireProtocolAdmin()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });
    });
});
