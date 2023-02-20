import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { Signer } from "ethers";
import Exceptions from "./library/Exceptions";
import {
    deploySubVaultSystem,
    deployERC20Tokens,
    deployProtocolGovernance,
} from "./library/Deployments";
import {
    ERC20,
    ERC20Vault,
    ProtocolGovernance,
    VaultRegistry,
    VaultFactory,
    VaultGovernance,
} from "./library/Types";
import {
    randomAddress,
    sortContractsByAddresses,
    withSigner,
    setTokenWhitelist,
} from "./library/Helpers";
import { now, sleep, sleepTo } from "./library/Helpers";

describe("VaultRegistry", () => {
    let vaultRegistry: VaultRegistry;
    let ERC20VaultFactory: VaultFactory;
    let ERC20VaultGovernance: VaultGovernance;
    let protocolGovernance: ProtocolGovernance;
    let ERC20Vault: ERC20Vault;
    let AnotherERC20Vault: ERC20Vault;
    let UniV3Vault: ERC20Vault;
    let AaveVault: ERC20Vault;
    let deployer: Signer;
    let treasury: Signer;
    let stranger: Signer;
    let nftERC20: number;
    let deployment: Function;

    before(async () => {
        [deployer, treasury, stranger] = await ethers.getSigners();

        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            return await deploySubVaultSystem({
                tokensCount: 2,
                adminSigner: deployer,
                vaultOwner: await deployer.getAddress(),
                treasury: await treasury.getAddress(),
            });
        });
    });

    beforeEach(async () => {
        ({
            vaultRegistry,
            ERC20VaultFactory,
            protocolGovernance,
            ERC20VaultFactory,
            ERC20VaultGovernance,
            ERC20Vault,
            AnotherERC20Vault,
            AaveVault,
            UniV3Vault,
            nftERC20,
        } = await deployment());
    });

    describe("constructor", () => {
        it("creates VaultRegistry", async () => {
            expect(
                await deployer.provider?.getCode(vaultRegistry.address)
            ).not.to.be.equal("0x");
        });
    });

    describe("vaults", () => {
        it("returns correct vaults", async () => {
            expect(await vaultRegistry.vaults()).to.deep.equal([
                ERC20Vault.address,
                AnotherERC20Vault.address,
                AaveVault.address,
                UniV3Vault.address,
                await deployer.getAddress(), // hack for testing
            ]);
        });
    });

    describe("vaultForNft", () => {
        it("returns correct ERC20Vault for existing nftERC20", async () => {
            expect(await vaultRegistry.vaultForNft(nftERC20)).to.equal(
                ERC20Vault.address
            );
        });

        it("returns zero nftERC20 for nonexistent ERC20Vault", async () => {
            expect(await vaultRegistry.vaultForNft(nftERC20 + 1)).to.equal(
                ethers.constants.AddressZero
            );
        });
    });

    describe("nftForVault", () => {
        it("returns correct ERC20Vault for nftERC20", async () => {
            expect(
                await vaultRegistry.nftForVault(ERC20Vault.address)
            ).to.equal(nftERC20);
        });

        it("returns zero address for nonexisting nftERC20", async () => {
            expect(
                await vaultRegistry.nftForVault(ERC20VaultFactory.address)
            ).to.equal(0);
        });
    });

    describe("registerVault", () => {
        describe("when called by VaultGovernance", async () => {
            it("registers ERC20Vault", async () => {
                const anotherTokens = sortContractsByAddresses(
                    await deployERC20Tokens(5)
                );
                await setTokenWhitelist(
                    protocolGovernance,
                    anotherTokens,
                    deployer
                );
                const [newVaultAddress, _] =
                    await ERC20VaultGovernance.callStatic.deployVault(
                        anotherTokens.map((token) => token.address),
                        [],
                        await deployer.getAddress()
                    );
                await ERC20VaultGovernance.deployVault(
                    anotherTokens.map((token) => token.address),
                    [],
                    await deployer.getAddress()
                );
                expect(await vaultRegistry.vaults()).to.deep.equal([
                    ERC20Vault.address,
                    AnotherERC20Vault.address,
                    AaveVault.address,
                    UniV3Vault.address,
                    await deployer.getAddress(), // hack for testing
                    newVaultAddress,
                ]);
            });
        });

        describe("when called by stranger", async () => {
            it("reverts", async () => {
                await expect(
                    vaultRegistry.registerVault(
                        ERC20VaultFactory.address,
                        await stranger.getAddress()
                    )
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
            });
        });
    });

    describe("protocolGovernance", () => {
        it("has correct protocolGovernance", async () => {
            expect(await vaultRegistry.protocolGovernance()).to.equal(
                protocolGovernance.address
            );
        });
    });

    describe("stagedProtocolGovernance", () => {
        describe("when nothing staged", () => {
            it("returns address zero", async () => {
                expect(await vaultRegistry.stagedProtocolGovernance()).to.equal(
                    ethers.constants.AddressZero
                );
            });
        });

        describe("when staged new protocolGovernance", () => {
            it("returns correct stagedProtocolGovernance", async () => {
                const newProtocolGovernance = await deployProtocolGovernance({
                    adminSigner: deployer,
                });
                await vaultRegistry.stageProtocolGovernance(
                    newProtocolGovernance.address
                );
                expect(await vaultRegistry.stagedProtocolGovernance()).to.equal(
                    newProtocolGovernance.address
                );
            });
        });
    });

    describe("stagedProtocolGovernanceTimestamp", () => {
        it("returns 0 when nothing is staged", async () => {
            expect(
                await vaultRegistry.stagedProtocolGovernanceTimestamp()
            ).to.equal(0);
        });

        it("returns correct timestamp when new ProtocolGovernance is staged", async () => {
            let ts = now();
            const newProtocolGovernance = await deployProtocolGovernance({
                adminSigner: deployer,
            });
            ts += 10 ** 4;
            await sleepTo(ts);
            await vaultRegistry.stageProtocolGovernance(
                newProtocolGovernance.address
            );
            expect(
                await vaultRegistry.stagedProtocolGovernanceTimestamp()
            ).to.equal(
                ts + Number(await protocolGovernance.governanceDelay()) + 1
            );
        });
    });

    describe("vaultsCount", () => {
        it("returns correct vaults count", async () => {
            expect(await vaultRegistry.vaultsCount()).to.equal(4 + 1); // 4 vaults + 1 for hack
        });
    });

    describe("stageProtocolGovernance", () => {
        describe("when called by stranger", () => {
            it("reverts", async () => {
                await expect(
                    vaultRegistry
                        .connect(stranger)
                        .stageProtocolGovernance(protocolGovernance.address)
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });
    });

    describe("commitStagedProtocolGovernance", () => {
        let newProtocolGovernance: ProtocolGovernance;

        beforeEach(async () => {
            newProtocolGovernance = await deployProtocolGovernance({
                adminSigner: deployer,
            });
        });

        describe("when nothing staged", () => {
            it("reverts", async () => {
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await expect(
                    vaultRegistry.commitStagedProtocolGovernance()
                ).to.be.revertedWith(Exceptions.NULL_OR_NOT_INITIALIZED);
            });
        });

        describe("when called by stranger", () => {
            it("reverts", async () => {
                await vaultRegistry.stageProtocolGovernance(
                    newProtocolGovernance.address
                );
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await expect(
                    vaultRegistry
                        .connect(stranger)
                        .commitStagedProtocolGovernance()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when called too early", () => {
            it("reverts", async () => {
                await vaultRegistry.stageProtocolGovernance(
                    protocolGovernance.address
                );
                await expect(
                    vaultRegistry.commitStagedProtocolGovernance()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });

        it("commits staged ProtocolGovernance", async () => {
            await vaultRegistry.stageProtocolGovernance(
                newProtocolGovernance.address
            );
            await sleep(Number(await protocolGovernance.governanceDelay()));
            await vaultRegistry.commitStagedProtocolGovernance();
            expect(await vaultRegistry.protocolGovernance()).to.equal(
                newProtocolGovernance.address
            );
        });
    });

    describe("adminApprove", () => {
        it("approves token to new address", async () => {
            const { admin } = await getNamedAccounts();
            const { execute, read, get } = deployments;
            const vaultCount = await read("VaultRegistry", "vaultsCount");
            for (let nft = 1; nft <= vaultCount; nft++) {
                const newAddress = randomAddress();
                await execute(
                    "VaultRegistry",
                    { from: admin, autoMine: true },
                    "adminApprove",
                    newAddress,
                    nft
                );

                expect(await read("VaultRegistry", "getApproved", nft)).to.eq(
                    newAddress
                );
            }
        });

        describe("when called not by admin", () => {
            it("reverts", async () => {
                const { deployer, stranger } = await getNamedAccounts();
                const { execute, read } = deployments;
                const vaultCount = await read("VaultRegistry", "vaultsCount");
                for (let nft = 1; nft <= vaultCount; nft++) {
                    for (const actor of [deployer, stranger]) {
                        const newAddress = randomAddress();
                        await expect(
                            execute(
                                "VaultRegistry",
                                { from: actor, autoMine: true },
                                "adminApprove",
                                newAddress,
                                nft
                            )
                        ).to.be.revertedWith(Exceptions.ADMIN);
                    }
                }
            });
        });
    });

    describe("isLocked", () => {
        it("checks if token is locked", async () => {
            const { execute, read, get } = deployments;
            const { stranger, stranger2 } = await getNamedAccounts();
            const vault = randomAddress();
            const vaultGovernance = await get("ERC20VaultGovernance");
            await withSigner(vaultGovernance.address, async (s) => {
                const vaultRegistry = await ethers.getContract("VaultRegistry");
                await vaultRegistry.connect(s).registerVault(vault, stranger);
            });
            const nft = await read("VaultRegistry", "vaultsCount");
            expect(await read("VaultRegistry", "isLocked", nft)).to.be.false;
            await execute(
                "VaultRegistry",
                { from: stranger, autoMine: true },
                "lockNft",
                nft
            );
            expect(await read("VaultRegistry", "isLocked", nft)).to.be.true;
        });
    });

    describe("lockNft", () => {
        it("locks nft for any transfer", async () => {
            const { execute, read, get } = deployments;
            const { stranger, stranger2 } = await getNamedAccounts();
            const vault = randomAddress();
            const vaultGovernance = await get("ERC20VaultGovernance");
            await withSigner(vaultGovernance.address, async (s) => {
                const vaultRegistry = await ethers.getContract("VaultRegistry");
                await vaultRegistry.connect(s).registerVault(vault, stranger);
            });
            const nft = await read("VaultRegistry", "vaultsCount");
            await execute(
                "VaultRegistry",
                { from: stranger, autoMine: true },
                "lockNft",
                nft
            );
            await execute(
                "VaultRegistry",
                { from: stranger, autoMine: true },
                "approve",
                stranger2,
                nft
            );

            await expect(
                execute(
                    "VaultRegistry",
                    { from: stranger, autoMine: true },
                    "transferFrom",
                    stranger,
                    randomAddress(),
                    nft
                )
            ).to.be.revertedWith(Exceptions.LOCKED_NFT);
            await expect(
                execute(
                    "VaultRegistry",
                    { from: stranger2, autoMine: true },
                    "transferFrom",
                    stranger,
                    randomAddress(),
                    nft
                )
            ).to.be.revertedWith(Exceptions.LOCKED_NFT);
        });

        describe("when called not by owner", () => {
            it("reverts", async () => {
                const { execute, read, get } = deployments;
                const { stranger, stranger2, deployer } =
                    await getNamedAccounts();
                const vault = randomAddress();
                const vaultGovernance = await get("ERC20VaultGovernance");
                await withSigner(vaultGovernance.address, async (s) => {
                    const vaultRegistry = await ethers.getContract(
                        "VaultRegistry"
                    );
                    await vaultRegistry
                        .connect(s)
                        .registerVault(vault, stranger);
                });
                const nft = await read("VaultRegistry", "vaultsCount");
                await execute(
                    "VaultRegistry",
                    { from: stranger, autoMine: true },
                    "approve",
                    stranger2,
                    nft
                );

                for (const actor of [stranger2, deployer]) {
                    await expect(
                        execute(
                            "VaultRegistry",
                            { from: actor, autoMine: true },
                            "lockNft",
                            nft
                        )
                    ).to.be.revertedWith(Exceptions.TOKEN_OWNER);
                }
            });
        });
    });
});
