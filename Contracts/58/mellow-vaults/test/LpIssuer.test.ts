import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { BigNumber } from "ethers";
import Exceptions from "./library/Exceptions";
import { ERC20, LpIssuerGovernance } from "./library/Types";
import { LpIssuer, ProtocolGovernance, VaultRegistry } from "./library/Types";
import { deploySystem } from "./library/Deployments";
import { comparator } from "ramda";
import {
    now,
    randomAddress,
    sleep,
    sleepTo,
    toObject,
    withSigner,
} from "./library/Helpers";
import { read } from "fs";

describe("LpIssuer", () => {
    let deployer: SignerWithAddress;
    let admin: SignerWithAddress;
    let stranger: SignerWithAddress;
    let strategy: SignerWithAddress;
    let treasury: SignerWithAddress;
    let LpIssuer: LpIssuer;
    let vaultRegistry: VaultRegistry;
    let protocolGovernance: ProtocolGovernance;
    let LpIssuerGovernance: LpIssuerGovernance;
    let lpIssuerNft: number;
    let gatewayNft: number;
    let tokens: ERC20[];
    let reset: Function;

    before(async () => {
        [deployer, admin, stranger, treasury, strategy] =
            await ethers.getSigners();
        reset = deployments.createFixture(async () => {
            await deployments.fixture();
            ({
                protocolGovernance,
                LpIssuerGovernance,
                LpIssuer,
                tokens,
                gatewayNft,
                lpIssuerNft,
            } = await deploySystem({
                adminSigner: admin,
                treasury: await treasury.getAddress(),
                vaultOwnerSigner: deployer,
                strategy: await strategy.getAddress(),
            }));
        });
    });

    beforeEach(async () => {
        await reset();
        const startTimestamp = now();
        await sleepTo(startTimestamp);
    });

    describe("::constructor", () => {
        it("passes", async () => {
            expect(
                await deployer.provider?.getCode(LpIssuer.address)
            ).to.not.equal("0x");
        });

        describe("when tokens not sorted nor unique", () => {
            it("reverts", async () => {
                const contractFactory = await ethers.getContractFactory(
                    "LpIssuer"
                );
                await expect(
                    contractFactory.deploy(
                        ethers.constants.AddressZero,
                        [tokens[1].address, tokens[0].address],
                        "name",
                        "symbol"
                    )
                ).to.be.revertedWith(Exceptions.SORTED_AND_UNIQUE);
            });
        });
    });

    describe("::addSubvault", () => {
        describe("when called not by VaultGovernance", () => {
            it("reverts", async () => {
                await expect(
                    LpIssuer.connect(stranger).addSubvault(42)
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
            });
        });
    });

    describe("::vaultGovernance", () => {
        it("returns correct VaultGovernance", async () => {
            expect(await LpIssuer.vaultGovernance()).to.equal(
                LpIssuerGovernance.address
            );
        });
    });

    describe("::vaultTokens", () => {
        it("returns correct vaultTokens", async () => {
            expect(await LpIssuer.vaultTokens()).to.deep.equal(
                tokens.map((token) => token.address)
            );
        });
    });

    describe("::subvaultNft", () => {
        it("returns correct subvaultNft", async () => {
            expect(await LpIssuer.subvaultNft()).to.equal(gatewayNft);
        });
    });

    describe("::deposit", () => {
        beforeEach(async () => {
            for (let i: number = 0; i < tokens.length; i++) {
                await tokens[i].approve(
                    LpIssuer.address,
                    ethers.constants.MaxUint256
                );
            }
        });

        it("charges management, protocol fees and performance fees", async () => {
            const { execute, read, get } = deployments;
            const { test, mStrategyTreasury, protocolTreasury, admin } =
                await getNamedAccounts();
            const nft = 5; // LpIssuer nft in initial deployment
            const address = await read("VaultRegistry", "vaultForNft", nft);
            const lpIssuer = await ethers.getContractAt("LpIssuer", address);
            const tokens = await lpIssuer.vaultTokens();
            const protocolFee = 3 * 10 ** 9;
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "stageDelayedProtocolPerVaultParams",
                nft,
                { protocolFee }
            );
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "commitDelayedProtocolPerVaultParams",
                nft
            );
            const strategyParams = await read(
                "LpIssuerGovernance",
                "delayedStrategyParams",
                nft
            );
            const strategyPerformanceTreasury = randomAddress();
            const updatedParams = {
                ...toObject(strategyParams),
                strategyTreasury: mStrategyTreasury,
                strategyPerformanceTreasury,
            };
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "stageDelayedStrategyParams",
                nft,
                updatedParams
            );
            await sleep(86401);
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "commitDelayedStrategyParams",
                nft
            );

            // strategyPerformanceTreasury
            await withSigner(test, async (s) => {
                for (const token of tokens) {
                    const t = await ethers.getContractAt("LpIssuer", token);

                    t.connect(s).approve(
                        lpIssuer.address,
                        ethers.constants.MaxUint256
                    );
                }

                const { managementFee, strategyTreasury } = await read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );

                const deposits = [];
                for (const token of tokens) {
                    const c = await ethers.getContractAt("LpIssuer", token);
                    const decimals = await c.decimals();
                    deposits.push(10 ** (decimals / 2 + 1));
                }

                await lpIssuer.connect(s).deposit(deposits, []);
                await sleep(86000);
                await lpIssuer.connect(s).deposit(deposits, []);
                // doesn't charge fees before delay
                expect(await lpIssuer.balanceOf(strategyTreasury)).to.eq(0);
                expect(await lpIssuer.balanceOf(protocolTreasury)).to.eq(0);
                expect(
                    await lpIssuer.balanceOf(strategyPerformanceTreasury)
                ).to.eq(0);
                await sleep(401);
                // charge pre-deposit
                const balance = await lpIssuer.balanceOf(test);
                await lpIssuer.connect(s).deposit(
                    deposits.map((x) => x / 5),
                    []
                );
                let expected = (
                    await lpIssuer.balanceOf(strategyTreasury)
                ).toNumber();
                let diff =
                    expected -
                    balance
                        .mul(managementFee)
                        .div(10 ** 9)
                        .div(365)
                        .toNumber();
                expect(Math.abs(diff / expected)).to.lte(0.001);
                expected = (
                    await lpIssuer.balanceOf(protocolTreasury)
                ).toNumber();
                diff =
                    expected -
                    balance
                        .mul(protocolFee)
                        .div(10 ** 9)
                        .div(365)
                        .toNumber();
                expect(Math.abs(diff) / expected).to.lte(0.001);
                expect(
                    await lpIssuer.balanceOf(strategyPerformanceTreasury)
                ).to.eq(0);

                const erc20VaultNft = 3;
                const address = await read(
                    "VaultRegistry",
                    "vaultForNft",
                    erc20VaultNft
                );
                for (let i = 0; i < tokens.length; i++) {
                    const contract = await ethers.getContractAt(
                        "LpIssuer",
                        tokens[i]
                    );
                    await contract
                        .connect(s)
                        .transfer(address, deposits[i] / 10);
                }
                await sleep(86401);
                await lpIssuer.connect(s).deposit(
                    deposits.map((x) => x / 8),
                    []
                );

                expect(
                    (
                        await lpIssuer.balanceOf(strategyPerformanceTreasury)
                    ).toNumber()
                ).to.gt(0);
            });
        });

        describe("when not initialized", () => {
            it("passes", async () => {
                await expect(LpIssuer.deposit([10 ** 3, 10 ** 3], [])).to.not.be
                    .reverted;
                expect(
                    await LpIssuer.balanceOf(await deployer.getAddress())
                ).to.equal(10 ** 3);
            });
        });

        describe("when leftovers happen", () => {
            it("returns them", async () => {
                const token0initialBalance = BigNumber.from(
                    await tokens[0].balanceOf(await deployer.getAddress())
                );
                const token1initialBalance = BigNumber.from(
                    await tokens[1].balanceOf(await deployer.getAddress())
                );
                await LpIssuer.deposit([10 ** 3 + 1, 10 ** 3 + 1], []);
                expect(
                    await LpIssuer.balanceOf(await deployer.getAddress())
                ).to.equal(10 ** 3);
                expect(
                    await tokens[0].balanceOf(await deployer.getAddress())
                ).to.equal(token0initialBalance.sub(10 ** 3));
                expect(
                    await tokens[1].balanceOf(await deployer.getAddress())
                ).to.equal(token1initialBalance.sub(10 ** 3));
            });
        });
    });

    describe("::withdraw", () => {
        beforeEach(async () => {
            for (let i: number = 0; i < tokens.length; i++) {
                await tokens[i].approve(
                    LpIssuer.address,
                    ethers.constants.MaxUint256
                );
            }
        });

        it("charges management, protocol fees and performance fees", async () => {
            const { execute, read, get } = deployments;
            const { test, mStrategyTreasury, protocolTreasury, admin } =
                await getNamedAccounts();
            const vaultGovernance = await get("LpIssuerGovernance");
            const nft = 5; // LpIssuer nft in initial deployment
            const address = await read("VaultRegistry", "vaultForNft", nft);
            const lpIssuer = await ethers.getContractAt("LpIssuer", address);
            const tokens = await lpIssuer.vaultTokens();
            const protocolFee = 3 * 10 ** 3;
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "stageDelayedProtocolPerVaultParams",
                nft,
                { protocolFee }
            );
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "commitDelayedProtocolPerVaultParams",
                nft
            );
            const strategyParams = await read(
                "LpIssuerGovernance",
                "delayedStrategyParams",
                nft
            );
            const strategyPerformanceTreasury = randomAddress();
            const updatedParams = {
                ...toObject(strategyParams),
                strategyTreasury: mStrategyTreasury,
                strategyPerformanceTreasury,
            };
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "stageDelayedStrategyParams",
                nft,
                updatedParams
            );
            await sleep(86401);
            await execute(
                "LpIssuerGovernance",
                { from: admin, autoMine: true },
                "commitDelayedStrategyParams",
                nft
            );

            await withSigner(test, async (s) => {
                for (const token of tokens) {
                    const t = await ethers.getContractAt("LpIssuer", token);

                    t.connect(s).approve(
                        lpIssuer.address,
                        ethers.constants.MaxUint256
                    );
                }

                const { managementFee, strategyTreasury } = await read(
                    "LpIssuerGovernance",
                    "delayedStrategyParams",
                    nft
                );
                await lpIssuer.connect(s).deposit([10 ** 5, 10 ** 5], []);
                await sleep(86000);
                await lpIssuer.connect(s).withdraw(test, 10 ** 4 / 5, []);
                // doesn't charge fees before delay
                expect(await lpIssuer.balanceOf(strategyTreasury)).to.eq(0);
                expect(await lpIssuer.balanceOf(protocolTreasury)).to.eq(0);
                expect(
                    await lpIssuer.balanceOf(strategyPerformanceTreasury)
                ).to.eq(0);

                await sleep(401);
                await lpIssuer.connect(s).withdraw(test, 10 ** 4 / 5, []);
                const balance = await lpIssuer.balanceOf(test);
                // charge post-withdraw
                expect(await lpIssuer.balanceOf(strategyTreasury)).to.eq(
                    balance
                        .mul(managementFee)
                        .div(10 ** 9)
                        .div(365)
                );
                expect(await lpIssuer.balanceOf(protocolTreasury)).to.eq(
                    balance
                        .mul(protocolFee)
                        .div(10 ** 9)
                        .div(365)
                );

                expect(
                    await lpIssuer.balanceOf(strategyPerformanceTreasury)
                ).to.eq(0);

                const erc20VaultNft = 3;
                const address = await read(
                    "VaultRegistry",
                    "vaultForNft",
                    erc20VaultNft
                );
                for (const token of tokens) {
                    const contract = await ethers.getContractAt(
                        "LpIssuer",
                        token
                    );
                    await contract.connect(s).transfer(address, 10 ** 5);
                }
                await sleep(86400);
                await lpIssuer.connect(s).withdraw(test, 10 ** 4 / 5, []);
                expect(
                    (
                        await lpIssuer.balanceOf(strategyPerformanceTreasury)
                    ).toNumber()
                ).to.gt(0);
            });
        });

        describe("when totalSupply is 0", () => {
            it("reverts", async () => {
                await expect(
                    LpIssuer.withdraw(await deployer.getAddress(), 1, [])
                ).to.be.revertedWith(Exceptions.TOTAL_SUPPLY_IS_ZERO);
            });
        });

        describe("when totalSupply is greater then 0", () => {
            it("passes", async () => {
                await LpIssuer.deposit([10 ** 3, 10 ** 3], []);
                await expect(
                    LpIssuer.withdraw(await deployer.getAddress(), 1, [])
                ).to.not.be.reverted;
                expect(
                    await LpIssuer.balanceOf(await deployer.getAddress())
                ).to.equal(10 ** 3 - 1);

                await expect(
                    LpIssuer.withdraw(
                        await deployer.getAddress(),
                        10 ** 3 - 1,
                        []
                    )
                ).to.not.be.reverted;
                expect(
                    await LpIssuer.balanceOf(await deployer.getAddress())
                ).to.equal(0);
            });
        });
    });

    describe("::nft", () => {
        it("returns correct nft", async () => {
            expect(await LpIssuer.nft()).to.equal(lpIssuerNft);
        });
    });

    describe("::initialize", () => {
        describe("when sender is not VaultGovernance", () => {
            it("reverts", async () => {
                await expect(
                    LpIssuer.connect(stranger).initialize(42)
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
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
            const lpGovernance = await get("LpIssuerGovernance");
            const lp = await deploy("LpIssuer", {
                from: deployer,
                args: [lpGovernance.address, [weth], "test", "test"],
            });
            expect(await read("VaultRegistry", "isLocked", nft)).to.be.false;
            await execute(
                "VaultRegistry",
                { from: stranger, autoMine: true },
                "safeTransferFrom(address,address,uint256)",
                stranger,
                lp.address,
                nft
            );
            expect(await read("VaultRegistry", "isLocked", nft)).to.be.true;
        });
        describe("when called not by vault registry", async () => {
            it("reverts", async () => {
                await expect(
                    LpIssuer.onERC721Received(
                        ethers.constants.AddressZero,
                        ethers.constants.AddressZero,
                        1,
                        []
                    )
                ).to.be.revertedWith("NFTVR");
            });
        });
    });
});
