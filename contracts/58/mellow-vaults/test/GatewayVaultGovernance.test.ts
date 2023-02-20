import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { Signer } from "ethers";
import { VaultGovernance, ProtocolGovernance } from "./library/Types";
import {
    deployERC20Tokens,
    deploySubVaultsXGatewayVaultSystem,
} from "./library/Deployments";
import Exceptions from "./library/Exceptions";
import {
    randomAddress,
    setTokenWhitelist,
    sleep,
    toObject,
} from "./library/Helpers";
import { BigNumber } from "@ethersproject/bignumber";

describe("GatewayVaultGovernance", () => {
    let deployer: Signer;
    let admin: Signer;
    let treasury: Signer;
    let strategy: Signer;
    let gatewayVaultGovernance: VaultGovernance;
    let protocolGovernance: ProtocolGovernance;
    let gatewayNft: number;
    let deployment: Function;
    let nftERC20: number;

    before(async () => {
        [deployer, admin, treasury, strategy] = await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            ({
                gatewayVaultGovernance,
                gatewayNft,
                protocolGovernance,
                nftERC20,
            } = await deploySubVaultsXGatewayVaultSystem({
                adminSigner: admin,
                treasury: await treasury.getAddress(),
                vaultOwnerSigner: deployer,
                strategy: await strategy.getAddress(),
            }));
        });
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("constructor", () => {
        it("creates GatewayVaultGovernance", async () => {
            expect(
                await deployer.provider?.getCode(gatewayVaultGovernance.address)
            ).not.to.be.equal("0x");
        });
    });

    describe("stageDelayedStrategyParams", () => {
        describe("when redirects.length != vaultTokens.length and redirects.length > 0", () => {
            it("reverts", async () => {
                await expect(
                    gatewayVaultGovernance.stageDelayedStrategyParams(
                        gatewayNft,
                        {
                            redirects: [1, 2, 3],
                        }
                    )
                ).to.be.revertedWith(
                    Exceptions.REDIRECTS_AND_VAULT_TOKENS_LENGTH
                );
            });
        });

        it("sets stageDelayedStrategyParams and emits StageDelayedStrategyParams event", async () => {
            await expect(
                await gatewayVaultGovernance
                    .connect(admin)
                    .stageDelayedStrategyParams(gatewayNft, {
                        redirects: [],
                    })
            ).to.emit(gatewayVaultGovernance, "StageDelayedStrategyParams");

            expect(
                toObject(
                    await gatewayVaultGovernance.stagedDelayedStrategyParams(
                        gatewayNft
                    )
                )
            ).to.deep.equal({
                redirects: [],
            });
        });
    });

    describe("setStrategyParams", () => {
        it("sets strategy params and emits SetStrategyParams event", async () => {
            await expect(
                gatewayVaultGovernance
                    .connect(admin)
                    .setStrategyParams(gatewayNft, {
                        limits: [1, 2, 3],
                    })
            ).to.emit(gatewayVaultGovernance, "SetStrategyParams");

            expect(
                toObject(
                    await gatewayVaultGovernance
                        .connect(admin)
                        .strategyParams(gatewayNft)
                )
            ).to.deep.equal({
                limits: [
                    BigNumber.from(1),
                    BigNumber.from(2),
                    BigNumber.from(3),
                ],
            });
        });
    });

    describe("commitDelayedStrategyParams", () => {
        it("commits delayed strategy params and emits CommitDelayedStrategyParams event", async () => {
            await gatewayVaultGovernance
                .connect(admin)
                .stageDelayedStrategyParams(gatewayNft, {
                    redirects: [],
                });
            await sleep(Number(await protocolGovernance.governanceDelay()));
            await expect(
                gatewayVaultGovernance
                    .connect(admin)
                    .commitDelayedStrategyParams(gatewayNft)
            ).to.emit(gatewayVaultGovernance, "CommitDelayedStrategyParams");
            expect(
                toObject(
                    await gatewayVaultGovernance
                        .connect(admin)
                        .delayedStrategyParams(gatewayNft)
                )
            ).to.deep.equal({
                redirects: [],
            });
        });
    });

    describe("delayedStrategyParams", () => {
        describe("when passed unknown nft", () => {
            it("returns empty struct", async () => {
                expect(
                    await gatewayVaultGovernance.delayedStrategyParams(
                        gatewayNft + 42
                    )
                ).to.be.deep.equal([[]]);
            });
        });
    });

    describe("stagedDelayedStrategyParams", () => {
        it("returns params", async () => {
            await gatewayVaultGovernance
                .connect(admin)
                .stageDelayedStrategyParams(gatewayNft, {
                    redirects: [],
                });
            expect(
                await gatewayVaultGovernance.stagedDelayedStrategyParams(
                    gatewayNft
                )
            ).to.be.deep.equal([[]]);
        });

        describe("when passed unknown nft", () => {
            it("returns empty struct", async () => {
                expect(
                    toObject(
                        await gatewayVaultGovernance.stagedDelayedStrategyParams(
                            gatewayNft + 42
                        )
                    )
                ).to.be.deep.equal({ redirects: [] });
            });
        });
    });

    describe("strategyParams", () => {
        describe("when passed unknown nft", () => {
            it("returns empty struct", async () => {
                expect(
                    await gatewayVaultGovernance.strategyParams(gatewayNft + 42)
                ).to.be.deep.equal([[]]);
            });
        });
    });

    describe("deployVault", async () => {
        describe("when try to deploy sub vault with not valid tokens", () => {
            it("reverts", async () => {
                let disapprovedToken = (await deployERC20Tokens(1))[0];
                await expect(
                    gatewayVaultGovernance.deployVault(
                        [disapprovedToken.address],
                        [],
                        ethers.constants.AddressZero
                    )
                ).to.be.revertedWith(Exceptions.TOKEN_NOT_ALLOWED);
            });
        });

        describe("when only one token is disapproved", () => {
            it("reverts", async () => {
                let approvedTokens = await deployERC20Tokens(3);
                await setTokenWhitelist(
                    protocolGovernance,
                    approvedTokens,
                    admin
                );
                let disapprovedToken = (await deployERC20Tokens(1))[0];
                await expect(
                    gatewayVaultGovernance.deployVault(
                        [
                            approvedTokens[0].address,
                            approvedTokens[1].address,
                            disapprovedToken.address,
                            approvedTokens[2].address,
                        ],
                        [],
                        ethers.constants.AddressZero
                    )
                ).to.be.revertedWith(Exceptions.TOKEN_NOT_ALLOWED);
            });
        });
    });
});
