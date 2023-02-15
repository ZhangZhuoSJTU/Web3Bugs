import { expect } from "chai";
import { deployments, getNamedAccounts, ethers } from "hardhat";
import { AaveVault } from "./types/AaveVault";
import { BigNumber } from "@ethersproject/bignumber";
import {
    withSigner,
    depositW9,
    depositWBTC,
    sleep,
    randomAddress,
} from "./library/Helpers";
import Exceptions from "./library/Exceptions";

describe("AaveVault", () => {
    const aaveVaultNft: number = 1;
    const erc20VaultNft: number = 2;
    const gatewayVaultNft: number = 4;
    let deploymentFixture: Function;
    let aaveVault: string;
    let erc20Vault: string;
    let gatewayVault: string;
    let wbtc: string;
    let weth: string;
    let aaveVaultContract: AaveVault;

    before(async () => {
        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();
            const { read } = deployments;
            aaveVault = await read(
                "VaultRegistry",
                "vaultForNft",
                aaveVaultNft
            );
            erc20Vault = await read(
                "VaultRegistry",
                "vaultForNft",
                erc20VaultNft
            );
            gatewayVault = await read(
                "VaultRegistry",
                "vaultForNft",
                gatewayVaultNft
            );
            aaveVaultContract = await ethers.getContractAt(
                "AaveVault",
                aaveVault
            );
            ({ wbtc, weth } = await getNamedAccounts());
        });
    });

    beforeEach(async () => {
        await deploymentFixture();
    });

    describe("#constructor", () => {
        it("creates a new contract", async () => {
            const { deploy, get } = deployments;
            const { deployer } = await getNamedAccounts();
            const vaultGovernance = await get("AaveVaultGovernance");
            await deploy("AaveVault", {
                from: deployer,
                autoMine: true,
                args: [vaultGovernance.address, [wbtc, weth]],
            });
        });

        describe("when passed invalid tokens", () => {
            it("reverts", async () => {
                const { deploy, get } = deployments;
                const { deployer } = await getNamedAccounts();
                const vaultGovernance = await get("AaveVaultGovernance");
                const tokens = [randomAddress(), randomAddress()]
                    .map((x) => x.toLowerCase())
                    .sort();
                await expect(
                    deploy("AaveVault", {
                        from: deployer,
                        args: [vaultGovernance.address, tokens],
                    })
                ).to.be.reverted;
            });
        });
    });

    describe("#tvl", () => {
        describe("when has not initial funds", () => {
            it("returns zero tvl", async () => {
                expect(await aaveVaultContract.tvl()).to.eql([
                    ethers.constants.Zero,
                    ethers.constants.Zero,
                ]);
            });
        });
    });

    describe("#updateTvls", () => {
        describe("when tvl had not change", () => {
            it("returns the same tvl", async () => {
                await expect(aaveVaultContract.updateTvls()).to.not.be.reverted;
                expect(await aaveVaultContract.tvl()).to.eql([
                    ethers.constants.Zero,
                    ethers.constants.Zero,
                ]);
            });
        });

        describe("when tvl changed by direct token transfer", () => {
            it("tvl remains unchanged before `updateTvls`", async () => {
                await depositW9(aaveVault, ethers.utils.parseEther("1"));
                expect(await aaveVaultContract.tvl()).to.eql([
                    ethers.constants.Zero,
                    ethers.constants.Zero,
                ]);
            });
        });
    });

    describe("#push", () => {
        describe("when pushed zeroes", () => {
            it("pushes", async () => {
                await withSigner(gatewayVault, async (signer) => {
                    const { weth, wbtc } = await getNamedAccounts();
                    const tokens = [weth, wbtc]
                        .map((t) => t.toLowerCase())
                        .sort();
                    await aaveVaultContract
                        .connect(signer)
                        .push(tokens, [0, 0], []);
                });
            });
        });

        describe("when pushed smth", () => {
            const amountWBTC = BigNumber.from(10).pow(9);
            const amount = BigNumber.from(ethers.utils.parseEther("1"));
            beforeEach(async () => {
                await depositW9(aaveVault, amount);
                await depositWBTC(aaveVault, amountWBTC.toString());
            });

            describe("happy case", () => {
                it("approves deposits to lendingPool and updates tvl", async () => {
                    await withSigner(gatewayVault, async (signer) => {
                        await expect(
                            aaveVaultContract
                                .connect(signer)
                                .push([wbtc, weth], [0, amount], [])
                        ).to.not.be.reverted;
                        expect(await aaveVaultContract.tvl()).to.eql([
                            ethers.constants.Zero,
                            amount,
                        ]);
                    });
                });

                it("tvl raises with time", async () => {
                    await withSigner(gatewayVault, async (signer) => {
                        await aaveVaultContract
                            .connect(signer)
                            .push([wbtc, weth], [amountWBTC, amount], []);
                        const [tvlWBTC, tvlWeth] =
                            await aaveVaultContract.tvl();
                        // check initial tvls
                        expect(tvlWBTC.toString()).to.be.equal(
                            amountWBTC.toString()
                        );
                        expect(tvlWeth.toString()).to.be.equal(
                            amount.toString()
                        );
                        // wait
                        await sleep(1000 * 1000 * 1000);
                        // update tvl
                        await aaveVaultContract.connect(signer).updateTvls();
                        const [newTvlWBTC, newTvlWeth] =
                            await aaveVaultContract.tvl();
                        expect(newTvlWeth.gt(amount)).to.be.true;
                        expect(newTvlWBTC.gt(amountWBTC)).to.be.true;
                    });
                });
            });

            describe("when called twice", () => {
                it("not performs approve the second time", async () => {
                    const amount = ethers.utils.parseEther("1");
                    await withSigner(gatewayVault, async (signer) => {
                        await expect(
                            aaveVaultContract
                                .connect(signer)
                                .push([wbtc, weth], [0, amount], [])
                        ).to.not.be.reverted;
                        const { aaveLendingPool } = await getNamedAccounts();
                        const wethContract = await ethers.getContractAt(
                            "WERC20Test",
                            weth
                        );
                        // allowance increased
                        expect(
                            await wethContract.allowance(
                                aaveVault,
                                aaveLendingPool
                            )
                        ).to.be.equal(ethers.constants.MaxUint256);
                        // insure coverage of _approveIfNessesary
                        await depositW9(aaveVault, amount);
                        await expect(
                            aaveVaultContract
                                .connect(signer)
                                .push([wbtc, weth], [0, amount], [])
                        ).to.not.be.reverted;
                    });
                });
            });
        });
    });

    describe("#pull", () => {
        const w9Amount = ethers.utils.parseEther("10");

        beforeEach(async () => {
            await deployments.fixture();
            await depositW9(aaveVault, w9Amount);
        });

        describe("when nothing is pushed", () => {
            it("nothing is pulled", async () => {
                await withSigner(gatewayVault, async (signer) => {
                    await expect(
                        aaveVaultContract
                            .connect(signer)
                            .pull(erc20Vault, [wbtc, weth], [0, 0], [])
                    ).to.not.be.reverted;
                    const wethContract = await ethers.getContractAt(
                        "WERC20Test",
                        weth
                    );
                    expect(await wethContract.balanceOf(aaveVault)).to.eql(
                        w9Amount
                    );
                });
            });
        });

        describe("when pushed smth", () => {
            const amount = ethers.utils.parseEther("1");

            beforeEach(async () => {
                await deployments.fixture();
                await depositW9(aaveVault, amount);
                await withSigner(gatewayVault, async (signer) => {
                    await expect(
                        aaveVaultContract
                            .connect(signer)
                            .push([wbtc, weth], [0, amount], [])
                    ).to.not.be.reverted;
                });
            });

            it("smth pulled", async () => {
                await withSigner(gatewayVault, async (signer) => {
                    await aaveVaultContract
                        .connect(signer)
                        .pull(erc20Vault, [wbtc, weth], [0, amount], []);
                    const wethContract = await ethers.getContractAt(
                        "WERC20Test",
                        weth
                    );
                    expect(await wethContract.balanceOf(erc20Vault)).to.eql(
                        amount
                    );
                });
            });

            describe("when pull amount is greater then actual balance", () => {
                it("executes", async () => {
                    await withSigner(gatewayVault, async (signer) => {
                        await expect(
                            aaveVaultContract
                                .connect(signer)
                                .pull(
                                    erc20Vault,
                                    [wbtc, weth],
                                    [0, amount.mul(2)],
                                    []
                                )
                        ).to.be.revertedWith("5"); // aave lending pool: insufficient balance
                    });
                });
            });
        });
    });
});
