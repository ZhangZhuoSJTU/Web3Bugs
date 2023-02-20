import { assert, expect } from "chai";
import {
    ethers,
    deployments,
    getNamedAccounts,
    getExternalContract,
} from "hardhat";
import { now, randomAddress, sleepTo, withSigner } from "./library/Helpers";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { equals } from "ramda";
import Exceptions from "./library/Exceptions";

describe("YearnVault", () => {
    let deploymentFixture: Function;
    let deployer: string;
    let admin: string;
    let stranger: string;
    let yearnVaultRegistry: string;
    let protocolGovernance: string;
    let vaultRegistry: string;
    let yearnVaultGovernance: string;
    let startTimestamp: number;
    let yearnVault: Contract;
    let nft: number;
    let vaultOwner: string;
    let tokens: string[];

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

            const { execute, get, read } = deployments;
            protocolGovernance = (await get("ProtocolGovernance")).address;
            vaultRegistry = (await get("VaultRegistry")).address;
            yearnVaultGovernance = (await get("YearnVaultGovernance")).address;
            const { weth, usdc, wbtc, test } = await getNamedAccounts();
            vaultOwner = test;
            tokens = [weth, usdc, wbtc].map((t) => t.toLowerCase()).sort();
            await execute(
                "YearnVaultGovernance",
                {
                    from: deployer,
                    autoMine: true,
                },
                "deployVault",
                tokens,
                yearnVaultGovernance,
                vaultOwner
            );
            nft = (await read("VaultRegistry", "vaultsCount")).toNumber();
            await withSigner(yearnVaultGovernance, async (s) => {
                // this is a hack to avoid checking that the owner of vault NFT is a Vault
                // we're saying here that vaultOwner is a legal registered vault
                const vaultRegistryContract = await ethers.getContractAt(
                    "VaultRegistry",
                    vaultRegistry
                );
                await vaultRegistryContract
                    .connect(s)
                    .registerVault(vaultOwner, vaultOwner);
            });

            const address = await read("VaultRegistry", "vaultForNft", nft);

            const contracts: Contract[] = [];
            for (const token of tokens) {
                contracts.push(await getExternalContract(token));
            }
            yearnVault = await ethers.getContractAt("YearnVault", address);

            await withSigner(vaultOwner, async (s) => {
                for (const contract of contracts) {
                    await contract
                        .connect(s)
                        .approve(
                            yearnVault.address,
                            ethers.constants.MaxUint256
                        );
                }
            });
        });
    });

    beforeEach(async () => {
        await deploymentFixture();
        startTimestamp =
            (await ethers.provider.getBlock("latest")).timestamp + 1000;
        await sleepTo(startTimestamp);
    });

    describe("constructor", () => {
        it("creates a new contract", async () => {
            const { deploy, get } = deployments;
            const { deployer } = await getNamedAccounts();
            const vaultGovernance = await get("YearnVaultGovernance");
            await deploy("YearnVault", {
                from: deployer,
                autoMine: true,
                args: [vaultGovernance.address, tokens],
            });
        });
        describe("when one of tokens is missing in Yearn", () => {
            it("reverts", async () => {
                const { deploy, get } = deployments;
                const { deployer } = await getNamedAccounts();
                const vaultGovernance = await get("YearnVaultGovernance");
                const newTokens = [...tokens, randomAddress()]
                    .map((x) => x.toLowerCase())
                    .sort();
                await expect(
                    deploy("YearnVault", {
                        from: deployer,
                        autoMine: true,
                        args: [vaultGovernance.address, newTokens],
                    })
                ).to.be.revertedWith(Exceptions.YEARN_VAULTS);
            });
        });
    });

    describe("tvl", () => {
        it("retuns cached tvl", async () => {
            const amounts = [1000, 2000, 3000];
            await withSigner(vaultOwner, async (s) => {
                await yearnVault
                    .connect(s)
                    .transferAndPush(vaultOwner, tokens, amounts, []);
            });

            expect(
                (await yearnVault.tvl()).map((x: BigNumber) => x.toNumber())
            ).to.eql(amounts.map((x: number) => x - 1));
        });

        describe("when no deposits are made", () => {
            it("returns 0", async () => {
                expect(
                    (await yearnVault.tvl()).map((x: BigNumber) => x.toNumber())
                ).to.eql([0, 0, 0]);
            });
        });
    });

    describe("push", () => {
        let yTokenContracts: Contract[];
        beforeEach(async () => {
            assert(
                equals(
                    (await yearnVault.tvl()).map((x: any) => x.toNumber()),
                    [0, 0, 0]
                ),
                "Zero TVL"
            );
            const yTokens = await yearnVault.yTokens();
            yTokenContracts = [];
            for (const yToken of yTokens) {
                const contract = await ethers.getContractAt("LpIssuer", yToken); // just use ERC20 interface here
                yTokenContracts.push(contract);
                assert(
                    (
                        await contract.balanceOf(yearnVault.address)
                    ).toNumber() === 0,
                    "Zero balance"
                );
            }
        });
        it("pushes tokens into yearn", async () => {
            const amounts = [1000, 2000, 3000];
            await withSigner(vaultOwner, async (s) => {
                await yearnVault
                    .connect(s)
                    .transferAndPush(vaultOwner, tokens, amounts, []);
            });
            for (const yToken of yTokenContracts) {
                const balance = await yToken.balanceOf(yearnVault.address);
                expect(balance.toNumber()).to.gt(0);
            }
            const tvls = (await yearnVault.tvl()).map((x: BigNumber) =>
                x.toNumber()
            );
            for (const tvl of tvls) {
                expect(tvl).to.gt(0);
            }
        });

        describe("when one of pushed tokens equals 0", () => {
            it("doesn't push that token", async () => {
                const amounts = [1000, 0, 3000];
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault
                        .connect(s)
                        .transferAndPush(vaultOwner, tokens, amounts, []);
                });
                const balance = await yTokenContracts[1].balanceOf(
                    yearnVault.address
                );
                expect(balance.toNumber()).to.eq(0);
                const tvls = (await yearnVault.tvl()).map((x: BigNumber) =>
                    x.toNumber()
                );
                expect(tvls[1]).to.eq(0);
            });
        });

        describe("when pushed twice", () => {
            it("succeeds", async () => {
                const amounts = [1000, 2000, 3000];
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault
                        .connect(s)
                        .transferAndPush(vaultOwner, tokens, amounts, []);
                });
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault
                        .connect(s)
                        .transferAndPush(vaultOwner, tokens, amounts, []);
                });

                for (const yToken of yTokenContracts) {
                    const balance = await yToken.balanceOf(yearnVault.address);
                    expect(balance.toNumber()).to.gt(0);
                }
                const tvls = (await yearnVault.tvl()).map((x: BigNumber) =>
                    x.toNumber()
                );
                for (const tvl of tvls) {
                    expect(tvl).to.gt(0);
                }
            });
        });
    });

    describe("pull", () => {
        let yTokenContracts: Contract[];
        let setup: Function;
        let amounts: number[];

        before(async () => {
            setup = deployments.createFixture(async () => {
                assert(
                    equals(
                        (await yearnVault.tvl()).map((x: any) => x.toNumber()),
                        [0, 0, 0]
                    ),
                    "Zero TVL"
                );
                const yTokens = await yearnVault.yTokens();
                yTokenContracts = [];
                for (const yToken of yTokens) {
                    const contract = await ethers.getContractAt(
                        "LpIssuer",
                        yToken
                    ); // just using ERC20 interface here
                    yTokenContracts.push(contract);
                    assert(
                        (
                            await contract.balanceOf(yearnVault.address)
                        ).toNumber() === 0,
                        "Zero balance"
                    );
                }
                amounts = [1000000, 2000000, 3000000];
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault
                        .connect(s)
                        .transferAndPush(vaultOwner, tokens, amounts, []);
                });
            });
        });

        beforeEach(async () => {
            await setup();
        });

        it("pulls the fund to address", async () => {
            const { stranger } = await getNamedAccounts();
            for (const token of tokens) {
                const contract = await getExternalContract(token);
                assert(
                    (await contract.balanceOf(stranger)) == 0,
                    "Zero balance for stranger"
                );
            }
            await withSigner(vaultOwner, async (s) => {
                await yearnVault
                    .connect(s)
                    .pull(
                        stranger,
                        tokens,
                        amounts,
                        "0x0000000000000000000000000000000000000000000000000000000000001001"
                    );
            });
            const balances = [];
            for (const token of tokens) {
                const contract = await getExternalContract(token);
                balances.push((await contract.balanceOf(stranger)).toNumber());
            }
            expect(balances).to.eql(amounts.map((x) => x - 1));
        });

        describe("when the pull amounts are greater than balances", () => {
            it("pulls all tokens from balance", async () => {
                const { stranger } = await getNamedAccounts();
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    assert(
                        (await contract.balanceOf(stranger)) == 0,
                        "Zero balance for stranger"
                    );
                }
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault.connect(s).pull(
                        stranger,
                        tokens,
                        amounts.map((x) => x * 10),
                        "0x0000000000000000000000000000000000000000000000000000000000001001"
                    );
                });
                const balances = [];
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    balances.push(
                        (await contract.balanceOf(stranger)).toNumber()
                    );
                }
                expect(balances).to.eql(amounts.map((x) => x - 1));
                const tvls = (await yearnVault.tvl()).map((x: BigNumber) =>
                    x.toNumber()
                );
                expect(tvls).to.eql([0, 0, 0]);
            });
        });

        describe("when pulled twice", () => {
            it("succeeds", async () => {
                const { stranger } = await getNamedAccounts();
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    assert(
                        (await contract.balanceOf(stranger)) == 0,
                        "Zero balance for stranger"
                    );
                }
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault.connect(s).pull(
                        stranger,
                        tokens,
                        amounts.map((x) => x / 2),
                        "0x0000000000000000000000000000000000000000000000000000000000001001"
                    );
                    await yearnVault.connect(s).pull(
                        stranger,
                        tokens,
                        amounts.map((x) => x / 2 + 1),
                        "0x0000000000000000000000000000000000000000000000000000000000001001"
                    );
                });
                const balances = [];
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    balances.push(
                        (await contract.balanceOf(stranger)).toNumber()
                    );
                }
                for (let i = 0; i < balances.length; i++) {
                    expect(balances[i]).to.gte(amounts[i] - 2);
                }
                const tvls = (await yearnVault.tvl()).map((x: BigNumber) =>
                    x.toNumber()
                );
                expect(tvls).to.eql([0, 0, 0]);
            });
        });

        describe("when 0 is pulled", () => {
            it("nothing is pulled", async () => {
                const { stranger } = await getNamedAccounts();
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    assert(
                        (await contract.balanceOf(stranger)) == 0,
                        "Zero balance for stranger"
                    );
                }
                await withSigner(vaultOwner, async (s) => {
                    await yearnVault.connect(s).pull(
                        stranger,
                        tokens,
                        amounts.map((x) => 0),
                        "0x0000000000000000000000000000000000000000000000000000000000001001"
                    );
                });
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    expect(await contract.balanceOf(stranger)).to.eq(0);
                }
            });
        });

        describe("when contract has 0 balance", () => {
            it("nothing is pulled", async () => {
                const { stranger } = await getNamedAccounts();
                for (const token of tokens) {
                    const contract = await getExternalContract(token);
                    assert(
                        (await contract.balanceOf(stranger)) == 0,
                        "Zero balance for stranger"
                    );
                }
                await withSigner(vaultOwner, async (s) => {
                    // pull everything
                    await yearnVault
                        .connect(s)
                        .pull(
                            stranger,
                            tokens,
                            amounts,
                            "0x0000000000000000000000000000000000000000000000000000000000001001"
                        );
                });
                const tvls = (await yearnVault.tvl()).map((x: BigNumber) =>
                    x.toNumber()
                );
                assert(equals(tvls, [0, 0, 0]));
                await withSigner(vaultOwner, async (s) => {
                    // pull everything
                    await yearnVault
                        .connect(s)
                        .pull(
                            stranger,
                            tokens,
                            amounts,
                            "0x0000000000000000000000000000000000000000000000000000000000001001"
                        );
                });
                const tvlsAfter = (await yearnVault.tvl()).map((x: BigNumber) =>
                    x.toNumber()
                );
                assert(equals(tvlsAfter, [0, 0, 0]));
            });
        });
    });
});
