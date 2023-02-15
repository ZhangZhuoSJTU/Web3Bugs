import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { BigNumber, Signer } from "ethers";
import {
    ERC20,
    Vault,
    VaultRegistry,
    AaveVault,
    VaultGovernance,
    ProtocolGovernance,
} from "./library/Types";
import Exceptions from "./library/Exceptions";
import { deploySubVaultsXGatewayVaultSystem } from "./library/Deployments";
import {
    encodeToBytes,
    randomAddress,
    sleep,
    withSigner,
} from "./library/Helpers";

describe("GatewayVault", () => {
    let deployer: Signer;
    let admin: Signer;
    let stranger: Signer;
    let treasury: Signer;
    let strategy: Signer;
    let AaveVault: AaveVault;
    let vaultRegistry: VaultRegistry;
    let ERC20Vault: Vault;
    let AnotherERC20Vault: Vault;
    let nftERC20: number;
    let gatewayNft: number;
    let anotherNftERC20: number;
    let tokens: ERC20[];
    let gatewayVault: Vault;
    let gatewayVaultGovernance: VaultGovernance;
    let protocolGovernance: ProtocolGovernance;
    let deployment: Function;
    let anotherGatewayVault: Vault;
    let anotherVaultRegistry: VaultRegistry;
    let anotherGatewayNft: number;
    let anotherProtocolGovernance: ProtocolGovernance;
    let anotherGatewayVaultGovernance: VaultGovernance;

    before(async () => {
        [deployer, admin, stranger, treasury, strategy] =
            await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            ({
                gatewayVault,
                nftERC20,
                anotherNftERC20,
                tokens,
                ERC20Vault,
                AnotherERC20Vault,
                vaultRegistry,
                AaveVault,
                gatewayVaultGovernance,
                gatewayNft,
                protocolGovernance,
            } = await deploySubVaultsXGatewayVaultSystem({
                adminSigner: admin,
                treasury: await treasury.getAddress(),
                vaultOwnerSigner: deployer,
                strategy: await strategy.getAddress(),
            }));
            for (let i: number = 0; i < tokens.length; ++i) {
                await tokens[i].connect(deployer).approve(
                    gatewayVault.address,
                    BigNumber.from(10 ** 3)
                        .mul(BigNumber.from(10 ** 3))
                        .mul(BigNumber.from(10 ** 3))
                );
            }
            await vaultRegistry.approve(
                await strategy.getAddress(),
                gatewayNft
            );
        });
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("vaultTokens", () => {
        it("returns correct ERC20Vault tokens", async () => {
            expect(await ERC20Vault.vaultTokens()).to.deep.equal(
                tokens.map((token) => token.address)
            );
        });
    });

    xdescribe("setApprovalForAll", () => {
        describe("when called not by vault governance", () => {
            it("reverts", async () => {
                await expect(
                    gatewayVault
                        .connect(stranger)
                        .setApprovalForAll(await stranger.getAddress())
                ).to.be.revertedWith("VG");
            });
        });

        describe("when passing a zero address", () => {
            it("reverts", async () => {
                await gatewayVault.setVaultGovernance(
                    await deployer.getAddress()
                );
                await expect(
                    gatewayVault.setApprovalForAll(ethers.constants.AddressZero)
                ).to.be.revertedWith("ZS");
            });
        });
    });

    describe("onERC721Received", () => {
        it("locks the token for transfer", async () => {
            const { execute, read, get, deploy } = deployments;
            const { stranger, stranger2, weth, deployer } =
                await getNamedAccounts();
            const vault = randomAddress();
            const vaultGovernance = await get("ERC20VaultGovernance");
            await withSigner(vaultGovernance.address, async (s) => {
                const vaultRegistry = await ethers.getContract("VaultRegistry");
                await vaultRegistry.connect(s).registerVault(vault, stranger);
            });
            const nft = await read("VaultRegistry", "vaultsCount");
            const gwGovernance = await get("GatewayVaultGovernance");
            const gw = await deploy("GatewayVault", {
                from: deployer,
                args: [gwGovernance.address, [weth]],
            });
            expect(await read("VaultRegistry", "isLocked", nft)).to.be.false;
            await execute(
                "VaultRegistry",
                { from: stranger, autoMine: true },
                "safeTransferFrom(address,address,uint256)",
                stranger,
                gw.address,
                nft
            );
            expect(await read("VaultRegistry", "isLocked", nft)).to.be.true;
        });
        describe("when called not by vault registry", async () => {
            it("reverts", async () => {
                await expect(
                    gatewayVault.onERC721Received(
                        ethers.constants.AddressZero,
                        ethers.constants.AddressZero,
                        1,
                        []
                    )
                ).to.be.revertedWith("NFTVR");
            });
        });
    });

    describe("push", () => {
        it("when called by stranger", async () => {
            await expect(
                gatewayVault
                    .connect(stranger)
                    .push([tokens[0].address], [BigNumber.from(10 ** 3)], [])
            ).to.be.revertedWith(Exceptions.APPROVED_OR_OWNER);
        });

        describe("when not subvaultNfts length is zero", () => {
            it("reverts", async () => {
                await gatewayVault.setSubvaultNfts([]);
                await tokens[0]
                    .connect(deployer)
                    .approve(gatewayVault.address, BigNumber.from(10 ** 4));
                await expect(
                    gatewayVault.push(
                        [tokens[0].address],
                        [BigNumber.from(10 ** 3)],
                        []
                    )
                ).to.be.revertedWith("INIT");
            });
        });

        describe("when trying to push the limits", () => {
            it("reverts", async () => {
                const limits = (
                    await gatewayVaultGovernance.strategyParams(gatewayNft)
                ).limits;

                const amount = limits.map((x: BigNumber) => x.add(1))[0];
                await tokens[0]
                    .connect(deployer)
                    .transfer(gatewayVault.address, amount);
                await expect(
                    gatewayVault.push([tokens[0].address], [amount], [])
                ).to.be.revertedWith("L");
            });
        });

        describe("when leftovers happen", () => {
            it("returns them!", async () => {
                const amount = BigNumber.from(10 ** 3);
                expect(
                    BigNumber.from(
                        await tokens[0].balanceOf(await deployer.getAddress())
                    ).mod(2)
                ).to.equal(0);
                await tokens[0]
                    .connect(deployer)
                    .approve(
                        gatewayVault.address,
                        BigNumber.from(amount.mul(2).add(1))
                    );
                await expect(
                    gatewayVault
                        .connect(deployer)
                        .transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address],
                            [amount],
                            []
                        )
                ).to.emit(gatewayVault, "Push");
                await expect(
                    gatewayVault
                        .connect(deployer)
                        .transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address],
                            [amount.add(1)],
                            []
                        )
                ).to.emit(gatewayVault, "Push");
                expect(
                    BigNumber.from(
                        await tokens[0].balanceOf(await deployer.getAddress())
                    ).mod(2)
                ).to.equal(0);
            });
        });

        describe("when optimized", () => {
            it("passes", async () => {
                await gatewayVault.push(
                    [],
                    [],
                    encodeToBytes(["bool", "bytes[]"], [true, []])
                );
            });
        });

        describe("when optimized and redirects contains zero", () => {
            it("passes", async () => {
                await gatewayVaultGovernance
                    .connect(admin)
                    .stageDelayedStrategyParams(gatewayNft, {
                        strategyTreasury: await treasury.getAddress(),
                        redirects: [1, 0],
                    });
                await sleep(
                    Number(
                        BigNumber.from(
                            await protocolGovernance.governanceDelay()
                        )
                    )
                );
                await gatewayVaultGovernance
                    .connect(admin)
                    .commitDelayedStrategyParams(gatewayNft);
                await gatewayVault.push(
                    [],
                    [],
                    encodeToBytes(["bool", "bytes[]"], [true, [[], []]])
                );
            });
        });

        it("emits Push", async () => {
            await tokens[0]
                .connect(deployer)
                .transfer(gatewayVault.address, BigNumber.from(10 ** 4));
            await expect(
                gatewayVault
                    .connect(deployer)
                    .push([tokens[0].address], [BigNumber.from(10 ** 3)], [])
            ).to.emit(gatewayVault, "Push");
        });
    });

    describe("pull", () => {
        describe("when optimized and redirects.length > 0", () => {
            it("passes", async () => {
                await tokens[0]
                    .connect(deployer)
                    .transfer(gatewayVault.address, BigNumber.from(10 ** 4));
                await gatewayVault
                    .connect(deployer)
                    .push([tokens[0].address], [BigNumber.from(10 ** 3)], []);
                await gatewayVaultGovernance
                    .connect(admin)
                    .stageDelayedStrategyParams(gatewayNft, {
                        strategyTreasury: await treasury.getAddress(),
                        redirects: [1, 0],
                    });
                await sleep(
                    Number(
                        BigNumber.from(
                            await protocolGovernance.governanceDelay()
                        )
                    )
                );
                await gatewayVaultGovernance
                    .connect(admin)
                    .commitDelayedStrategyParams(gatewayNft);
                expect(
                    await gatewayVault
                        .connect(deployer)
                        .pull(
                            await deployer.getAddress(),
                            [tokens[0].address],
                            [BigNumber.from(10 ** 3)],
                            encodeToBytes(["bool", "bytes[]"], [true, [[], []]])
                        )
                ).to.emit(gatewayVault, "Pull");
            });
        });

        it("emits Pull", async () => {
            await tokens[0]
                .connect(deployer)
                .transfer(gatewayVault.address, BigNumber.from(10 ** 4));
            await gatewayVault
                .connect(deployer)
                .push([tokens[0].address], [BigNumber.from(10 ** 3)], []);
            expect(
                await gatewayVault
                    .connect(deployer)
                    .pull(
                        await deployer.getAddress(),
                        [tokens[0].address],
                        [BigNumber.from(10 ** 3)],
                        []
                    )
            ).to.emit(gatewayVault, "Pull");
        });
    });

    describe("constructor", () => {
        it("creates GatewayVault", async () => {
            expect(
                await deployer.provider?.getCode(gatewayVault.address)
            ).not.to.be.equal("0x");
        });
    });

    describe("subvaultNfts", () => {
        it("returns nfts", async () => {
            expect(await gatewayVault.subvaultNfts()).to.be.deep.equal([
                nftERC20,
                anotherNftERC20,
            ]);
        });
    });

    describe("tvl", () => {
        it("when nothing yet pushed", async () => {
            expect(await gatewayVault.tvl()).to.deep.equal([
                BigNumber.from(0),
                BigNumber.from(0),
            ]);
        });
    });

    describe("subvaultTvl", () => {
        describe("when nothing pushed yet", () => {
            it("returns empty tvl", async () => {
                expect(await gatewayVault.subvaultTvl(0)).to.deep.equal([
                    BigNumber.from(0),
                    BigNumber.from(0),
                ]);
            });
        });
    });

    describe("subvaultsTvl", () => {
        describe("when nothing pushed yet", () => {
            it("returns empty tvl", async () => {
                expect(await gatewayVault.subvaultsTvl()).to.be.deep.equal([
                    [BigNumber.from(0), BigNumber.from(0)],
                    [BigNumber.from(0), BigNumber.from(0)],
                ]);
            });
        });
    });

    describe("hasSubvault", () => {
        describe("when passed actual ERC20Vault", () => {
            it("returns true", async () => {
                expect(await gatewayVault.hasSubvault(ERC20Vault.address)).to.be
                    .true;
                expect(
                    await gatewayVault.hasSubvault(AnotherERC20Vault.address)
                ).to.be.true;
            });
        });

        describe("when passed not subvault", () => {
            it("returns false", async () => {
                expect(
                    await gatewayVault.hasSubvault(await stranger.getAddress())
                ).to.be.false;
            });
        });
    });

    describe("addSubvaults", () => {
        describe("when called not by VaultGovernance", () => {
            it("reverts", async () => {
                await expect(
                    gatewayVault
                        .connect(strategy)
                        .addSubvaults([BigNumber.from(nftERC20)])
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
            });
        });

        describe("when already initialized", () => {
            it("reverts", async () => {
                await gatewayVault.setVaultGovernance(
                    await deployer.getAddress()
                );
                await expect(
                    gatewayVault.addSubvaults([BigNumber.from(nftERC20)])
                ).to.be.revertedWith(Exceptions.SUB_VAULT_INITIALIZED);
            });
        });

        describe("when passed zero sized list", () => {
            it("reverts", async () => {
                await gatewayVault.setVaultGovernance(
                    await deployer.getAddress()
                );
                await gatewayVault.setSubvaultNfts([]);
                await expect(gatewayVault.addSubvaults([])).to.be.revertedWith(
                    Exceptions.SUB_VAULT_LENGTH
                );
            });
        });

        describe("when passed nfts contains zero", () => {
            it("reverts", async () => {
                await gatewayVault.setSubvaultNfts([]);
                await withSigner(
                    gatewayVaultGovernance.address,
                    async (signer) => {
                        await expect(
                            gatewayVault.connect(signer).addSubvaults([0])
                        ).to.be.revertedWith("NFT0");
                    }
                );
            });
        });
    });

    describe("_isValidPullDestination", () => {
        describe("when passed some contract", () => {
            xit("returns false", async () => {
                expect(
                    await gatewayVault.isValidPullDestination(AaveVault.address)
                ).to.be.false;
            });
        });
    });

    describe("_isVaultToken", () => {
        describe("when passed not vault token", () => {
            it("returns false", async () => {
                expect(
                    await gatewayVault.isVaultToken(await stranger.getAddress())
                ).to.be.false;
            });
        });
    });
});
