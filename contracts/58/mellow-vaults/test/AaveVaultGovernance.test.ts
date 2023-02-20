import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { Signer } from "ethers";
import {
    ERC20,
    Vault,
    VaultGovernance,
    ProtocolGovernance,
    VaultRegistry,
} from "./library/Types";
import { deploySubVaultSystem } from "./library/Deployments";
import { sleep, toObject } from "./library/Helpers";

describe("AaveVaultGovernance", () => {
    const tokensCount = 2;
    let deployer: Signer;
    let admin: Signer;
    let stranger: Signer;
    let treasury: Signer;
    let anotherTreasury: Signer;
    let anotherAaveLendingPool: Signer;
    let AaveVaultGovernance: VaultGovernance;
    let protocolGovernance: ProtocolGovernance;
    let vault: Vault;
    let nftAave: number;
    let tokens: ERC20[];
    let deployment: Function;
    let namedAccounts: any;
    let vaultRegistry: VaultRegistry;

    before(async () => {
        [
            deployer,
            admin,
            stranger,
            treasury,
            anotherTreasury,
            anotherAaveLendingPool,
        ] = await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            ({
                protocolGovernance,
                AaveVaultGovernance,
                tokens,
                nftAave,
                vaultRegistry,
            } = await deploySubVaultSystem({
                tokensCount: tokensCount,
                adminSigner: admin,
                treasury: await treasury.getAddress(),
                vaultOwner: await deployer.getAddress(),
            }));
        });
        namedAccounts = await getNamedAccounts();
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("constructor", () => {
        it("creates AaveVaultGovernance", async () => {
            expect(
                await deployer.provider?.getCode(AaveVaultGovernance.address)
            ).not.to.be.equal("0x");
        });
    });

    describe("delayedProtocolParams", () => {
        it("returns correct params", async () => {
            expect(
                toObject(await AaveVaultGovernance.delayedProtocolParams())
            ).to.be.deep.equal({ lendingPool: namedAccounts.aaveLendingPool });
        });

        describe("when delayedProtocolParams is empty", () => {
            it("returns zero address", async () => {
                let factory = await ethers.getContractFactory(
                    "AaveVaultGovernanceTest"
                );
                let contract = await factory.deploy(
                    {
                        protocolGovernance: protocolGovernance.address,
                        registry: vaultRegistry.address,
                    },
                    { lendingPool: namedAccounts.aaveLendingPool }
                );
                expect(
                    toObject(await contract.delayedProtocolParams())
                ).to.be.deep.equal({
                    lendingPool: ethers.constants.AddressZero,
                });
            });
        });
    });

    describe("stagedDelayedProtocolParams", () => {
        describe("when nothing is staged", async () => {
            it("returns an empty struct", async () => {
                expect(
                    await AaveVaultGovernance.stagedDelayedProtocolParams()
                ).to.be.deep.equal([ethers.constants.AddressZero]);
            });
        });

        it("returns staged params", async () => {
            await AaveVaultGovernance.connect(admin).stageDelayedProtocolParams(
                [await anotherAaveLendingPool.getAddress()]
            );
            expect(
                await AaveVaultGovernance.connect(
                    admin
                ).stagedDelayedProtocolParams()
            ).to.be.deep.equal([await anotherAaveLendingPool.getAddress()]);
        });
    });

    describe("stageDelayedProtocolParams", () => {
        it("stages DelayedProtocolParams", async () => {
            await AaveVaultGovernance.connect(admin).stageDelayedProtocolParams(
                [await anotherAaveLendingPool.getAddress()]
            );
            expect(
                await AaveVaultGovernance.connect(
                    admin
                ).stagedDelayedProtocolParams()
            ).to.be.deep.equal([await anotherAaveLendingPool.getAddress()]);
        });

        it("emits StageDelayedProtocolParams event", async () => {
            await AaveVaultGovernance.connect(admin).stageDelayedProtocolParams(
                [await anotherAaveLendingPool.getAddress()]
            );
            await expect(
                AaveVaultGovernance.connect(admin).stageDelayedProtocolParams([
                    await anotherAaveLendingPool.getAddress(),
                ])
            ).to.emit(AaveVaultGovernance, "StageDelayedProtocolParams");
        });
    });

    describe("commitDelayedProtocolParams", () => {
        it("commits delayed protocol params", async () => {
            await AaveVaultGovernance.connect(admin).stageDelayedProtocolParams(
                [await anotherAaveLendingPool.getAddress()]
            );
            await sleep(Number(await protocolGovernance.governanceDelay()));
            await AaveVaultGovernance.connect(
                admin
            ).commitDelayedProtocolParams();
            expect(
                await AaveVaultGovernance.delayedProtocolParams()
            ).to.deep.equal([await anotherAaveLendingPool.getAddress()]);
        });

        it("emits CommitDelayedProtocolParams event", async () => {
            await AaveVaultGovernance.connect(admin).stageDelayedProtocolParams(
                [await anotherAaveLendingPool.getAddress()]
            );
            await sleep(Number(await protocolGovernance.governanceDelay()));
            await expect(
                AaveVaultGovernance.connect(admin).commitDelayedProtocolParams()
            ).to.emit(AaveVaultGovernance, "CommitDelayedProtocolParams");
        });
    });
});
