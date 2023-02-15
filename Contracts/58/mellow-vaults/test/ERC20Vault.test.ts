import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { BigNumber, Signer } from "ethers";
import {
    ERC20,
    ERC20Vault,
    VaultRegistry,
    ERC20VaultGovernance,
} from "./library/Types";
import { deployERC20Tokens, deploySubVaultSystem } from "./library/Deployments";
import Exceptions from "./library/Exceptions";

describe("ERC20Vault", function () {
    describe("when permissionless is set to true", () => {
        let deployer: Signer;
        let user: Signer;
        let stranger: Signer;
        let treasury: Signer;
        let protocolGovernanceAdmin: Signer;

        let tokens: ERC20[];
        let ERC20Vault: ERC20Vault;
        let ERC20VaultGovernance: ERC20VaultGovernance;
        let vaultRegistry: VaultRegistry;
        let nftERC20: number;
        let deployment: Function;

        before(async () => {
            [deployer, user, stranger, treasury, protocolGovernanceAdmin] =
                await ethers.getSigners();

            deployment = deployments.createFixture(async () => {
                await deployments.fixture();
                return await deploySubVaultSystem({
                    tokensCount: 2,
                    adminSigner: deployer,
                    treasury: await treasury.getAddress(),
                    vaultOwner: await deployer.getAddress(),
                });
            });
        });

        beforeEach(async () => {
            ({
                vaultRegistry,
                ERC20VaultGovernance,
                tokens,
                ERC20Vault,
                nftERC20,
            } = await deployment());
            // approve all tokens to the ERC20Vault
            for (let i: number = 0; i < tokens.length; ++i) {
                await tokens[i].connect(deployer).approve(
                    ERC20Vault.address,
                    BigNumber.from(10 ** 4)
                        .mul(BigNumber.from(10 ** 4))
                        .mul(BigNumber.from(10 ** 4))
                );
            }
            await vaultRegistry
                .connect(deployer)
                .approve(await protocolGovernanceAdmin.getAddress(), nftERC20);
        });

        describe("constructor", () => {
            it("has correct vaultGovernance address", async () => {
                expect(await ERC20Vault.vaultGovernance()).to.equal(
                    ERC20VaultGovernance.address
                );
            });

            it("has zero tvl", async () => {
                expect(await ERC20Vault.tvl()).to.deep.equal([
                    BigNumber.from(0),
                    BigNumber.from(0),
                ]);
            });

            it("has correct nftERC20 owner", async () => {
                expect(await vaultRegistry.ownerOf(nftERC20)).to.equals(
                    await deployer.getAddress()
                );
            });

            describe("when tokens are not sorted", () => {
                it("reverts", async () => {
                    const factory = await ethers.getContractFactory(
                        "ERC20Vault"
                    );
                    await expect(
                        factory.deploy(await stranger.getAddress(), [
                            tokens[1].address,
                            tokens[0].address,
                        ])
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                    await expect(
                        factory.deploy(await stranger.getAddress(), [
                            tokens[0].address,
                            tokens[0].address,
                        ])
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });
        });

        describe("push", () => {
            describe("when not approved not owner", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.connect(stranger).push(
                            [tokens[0].address],
                            [BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.APPROVED_OR_OWNER);
                });
            });

            describe("when tokens and tokenAmounts lengthes do not match", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.push(
                            [tokens[0].address],
                            [BigNumber.from(1), BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.INCONSISTENT_LENGTH);
                });
            });

            describe("when tokens are not sorted", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.push(
                            [tokens[1].address, tokens[0].address],
                            [BigNumber.from(1), BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });

            describe("when tokens are not unique", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.push(
                            [tokens[0].address, tokens[0].address],
                            [BigNumber.from(1), BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });

            describe("when tokens not sorted nor unique", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.push(
                            [
                                tokens[1].address,
                                tokens[0].address,
                                tokens[1].address,
                            ],
                            [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });

            // FIXME: Should NOT pass when amounts do not match actual balance!
            it("passes when no tokens transferred", async () => {
                const amounts = await ERC20Vault.callStatic.push(
                    [tokens[0].address],
                    [BigNumber.from(10 ** 4)],
                    []
                );
                expect(amounts).to.deep.equal([BigNumber.from(10 ** 4)]);
            });

            it("passes when tokens transferred", async () => {
                await tokens[1].transfer(
                    ERC20Vault.address,
                    BigNumber.from(100 * 10 ** 4)
                );
                const args = [
                    [tokens[1].address],
                    [BigNumber.from(100 * 10 ** 4)],
                    [],
                ];
                const amounts = await ERC20Vault.callStatic.push(...args);
                const tx = await ERC20Vault.push(...args);
                await tx.wait();
                expect(amounts).to.deep.equal([BigNumber.from(100 * 10 ** 4)]);
            });
        });

        describe("transferAndPush", () => {
            describe("when not approved nor owner", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.connect(stranger).transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address],
                            [BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.APPROVED_OR_OWNER);
                });
            });

            describe("when tokens and tokenAmounts lengthes do not match", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address],
                            [BigNumber.from(1), BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.INCONSISTENT_LENGTH);
                });
            });

            describe("when tokens are not sorted", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.transferAndPush(
                            await deployer.getAddress(),
                            [tokens[1].address, tokens[0].address],
                            [BigNumber.from(1), BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });

            describe("when tokens are not unique", () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address, tokens[0].address],
                            [BigNumber.from(1), BigNumber.from(1)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });

            describe("when tokens are not sorted nor unique", async () => {
                it("reverts", async () => {
                    await expect(
                        ERC20Vault.transferAndPush(
                            await deployer.getAddress(),
                            [
                                tokens[1].address,
                                tokens[0].address,
                                tokens[1].address,
                            ],
                            [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
                });
            });

            describe("when all tokenAmounts != 0", () => {
                it("passes", async () => {
                    expect(
                        await ERC20Vault.callStatic.transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address],
                            [BigNumber.from(10 ** 4)],
                            []
                        )
                    ).to.deep.equal([BigNumber.from(10 ** 4)]);
                });
            });

            describe("when not all tokenAmounts != 0", () => {
                it("passes", async () => {
                    expect(
                        await ERC20Vault.callStatic.transferAndPush(
                            await deployer.getAddress(),
                            [tokens[0].address, tokens[1].address],
                            [BigNumber.from(10 ** 4), BigNumber.from(0)],
                            []
                        )
                    ).to.deep.equal([
                        BigNumber.from(10 ** 4),
                        BigNumber.from(0),
                    ]);
                });
            });

            describe("when not enough balance", () => {
                it("reverts", async () => {
                    await tokens[0].transfer(
                        await user.getAddress(),
                        BigNumber.from(10 ** 3)
                    );
                    await tokens[0]
                        .connect(user)
                        .approve(ERC20Vault.address, BigNumber.from(10 ** 3));
                    await expect(
                        ERC20Vault.transferAndPush(
                            await user.getAddress(),
                            [tokens[0].address],
                            [BigNumber.from(10 ** 4)],
                            []
                        )
                    ).to.be.revertedWith(Exceptions.SAFE_ERC20);
                });
            });
        });

        describe("tvl", () => {
            before(async () => {
                for (let i: number = 0; i < tokens.length; ++i) {
                    await tokens[i].connect(deployer).approve(
                        ERC20Vault.address,
                        BigNumber.from(10 ** 4)
                            .mul(BigNumber.from(10 ** 4))
                            .mul(BigNumber.from(10 ** 4))
                    );
                }
            });

            it("passes", async () => {
                await ERC20Vault.transferAndPush(
                    await deployer.getAddress(),
                    [tokens[0].address],
                    [BigNumber.from(10 ** 4)],
                    []
                );

                expect(await ERC20Vault.tvl()).to.deep.equal([
                    BigNumber.from(10 ** 4),
                    BigNumber.from(0),
                ]);
            });
        });

        describe("reclaimTokens", () => {
            let anotherToken: ERC20;

            before(async () => {
                anotherToken = (await deployERC20Tokens(1))[0];
                await anotherToken
                    .connect(deployer)
                    .transfer(ERC20Vault.address, BigNumber.from(10 ** 4));
            });
        });

        describe("_postReclaimTokens", () => {
            it("passes", async () => {
                let anotherToken = (await deployERC20Tokens(1))[0];
                await expect(
                    ERC20Vault.__postReclaimTokens(
                        ethers.constants.AddressZero,
                        [anotherToken.address]
                    )
                ).to.not.be.reverted;
            });

            describe("passed some not vault tokens", () => {
                it("reverts", async () => {
                    let anotherToken = (await deployERC20Tokens(1))[0];
                    let arg = tokens.map((t) => t.address);
                    arg.push(anotherToken.address);
                    await expect(
                        ERC20Vault.__postReclaimTokens(
                            ethers.constants.AddressZero,
                            arg
                        )
                    ).to.be.revertedWith(Exceptions.OTHER_VAULT_TOKENS);
                });
            });
        });
    });
});
