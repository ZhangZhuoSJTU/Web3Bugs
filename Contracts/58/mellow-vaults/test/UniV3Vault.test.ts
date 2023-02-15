import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { deployments, getNamedAccounts, ethers } from "hardhat";
import { UniV3Vault } from "./types/UniV3Vault";
import { WERC20Test } from "./types/WERC20Test";
import {
    withSigner,
    depositW9,
    sortAddresses,
    encodeToBytes,
    now,
    depositWBTC,
} from "./library/Helpers";

describe("UniV3Vault", () => {
    const aaveVaultNft: number = 1;
    const uniV3VaultNft: number = 2;
    const erc20VaultNft: number = 3;
    const gatewayVaultNft: number = 4;
    const uniV3Fee: number = 3000;
    const amountWBTC = BigNumber.from(10).pow(9);
    const amount = BigNumber.from(ethers.utils.parseEther("1"));

    let deploymentFixture: Function;
    let aaveVault: string;
    let erc20Vault: string;
    let uniV3Vault: string;
    let gatewayVault: string;
    let uniV3VaultGovernance: string;
    let uniV3VaultContract: UniV3Vault;
    let wbtc: string;
    let weth: string;
    let startTimestamp: number;

    before(async () => {
        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();
            const { read, get } = deployments;
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
            uniV3Vault = await read(
                "VaultRegistry",
                "vaultForNft",
                uniV3VaultNft
            );
            uniV3VaultGovernance = (await get("UniV3VaultGovernance")).address;
            gatewayVault = await read(
                "VaultRegistry",
                "vaultForNft",
                gatewayVaultNft
            );
            uniV3VaultContract = await ethers.getContractAt(
                "UniV3Vault",
                uniV3Vault
            );
            ({ wbtc, weth } = await getNamedAccounts());
            await depositW9(uniV3Vault, amount);
            await depositWBTC(uniV3Vault, amountWBTC);
            startTimestamp = now();
        });
    });

    beforeEach(async () => {
        await deploymentFixture();
    });

    describe("#constructor", () => {
        describe("when passed more than 2 tokens", () => {
            it("reverts", async () => {
                const factory = await ethers.getContractFactory("UniV3Vault");
                const { weth, wbtc, usdc } = await getNamedAccounts();
                await expect(
                    factory.deploy(
                        uniV3VaultGovernance,
                        sortAddresses([weth, wbtc, usdc]),
                        uniV3Fee
                    )
                ).to.be.revertedWith("TL");
            });
        });
    });

    describe("#tvl", () => {
        describe("when has not initial funds", () => {
            it("returns zero tvl", async () => {
                expect(await uniV3VaultContract.tvl()).to.eql([
                    ethers.constants.Zero,
                    ethers.constants.Zero,
                ]);
            });
        });

        describe("when has assets", () => {
            it("returns correct tvl", async () => {});
        });
    });

    describe("#push", () => {
        describe("when has not uniV3 position open", () => {
            it("reverts", async () => {
                const options = encodeToBytes(
                    [
                        "tuple(uint256 amount0Min, uint256 amount1Min, uint256 deadline)",
                    ],
                    [
                        {
                            amount0Min: 10,
                            amount1Min: 10,
                            deadline: startTimestamp + 1000,
                        },
                    ]
                );
                await withSigner(gatewayVault, async (signer) => {
                    await expect(
                        uniV3VaultContract
                            .connect(signer)
                            .push([wbtc, weth], [amountWBTC, amount], options)
                    ).to.not.be.reverted;
                    expect(await uniV3VaultContract.tvl()).to.deep.equal([
                        ethers.constants.Zero,
                        ethers.constants.Zero,
                    ]);
                });
            });
        });
    });
});
