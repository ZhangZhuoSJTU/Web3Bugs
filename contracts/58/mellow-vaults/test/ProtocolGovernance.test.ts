import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { Contract, Signer } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import Exceptions from "./library/Exceptions";
import { ProtocolGovernance_Params } from "./library/Types";
import {
    deployVaultRegistryAndProtocolGovernance,
    deployERC20Tokens,
} from "./library/Deployments";
import { now, sleep, sleepTo, toObject } from "./library/Helpers";
import { ERC20 } from "./library/Types";

describe("ProtocolGovernance", () => {
    const SECONDS_PER_DAY = 60 * 60 * 24;

    let protocolGovernance: Contract;
    let deployer: Signer;
    let stranger: Signer;
    let user1: Signer;
    let user2: Signer;
    let user3: Signer;
    let protocolTreasury: Signer;
    let timestamp: number;
    let timeout: number;
    let timeShift: number;
    let params: ProtocolGovernance_Params;
    let initialParams: ProtocolGovernance_Params;
    let paramsZero: ProtocolGovernance_Params;
    let paramsTimeout: ProtocolGovernance_Params;
    let paramsEmpty: ProtocolGovernance_Params;
    let paramsDefault: ProtocolGovernance_Params;
    let defaultGovernanceDelay: number;
    let deploymentFixture: Function;
    let tokens: ERC20[];

    before(async () => {
        [deployer, stranger, user1, user2, user3, protocolTreasury] =
            await ethers.getSigners();
        timeout = 10 ** 4;
        defaultGovernanceDelay = 1;
        timeShift = 10 ** 10;
        timestamp = now() + timeShift;

        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();

            const { vaultRegistry, protocolGovernance } =
                await deployVaultRegistryAndProtocolGovernance({
                    name: "VaultRegistry",
                    symbol: "MVR",
                    adminSigner: deployer,
                    treasury: await protocolTreasury.getAddress(),
                });

            params = {
                permissionless: false,
                maxTokensPerVault: BigNumber.from(20),
                governanceDelay: BigNumber.from(100),
                protocolTreasury: await protocolTreasury.getAddress(),
            };

            initialParams = {
                permissionless: true,
                maxTokensPerVault: BigNumber.from(10),
                governanceDelay: BigNumber.from(SECONDS_PER_DAY), // 1 day
                protocolTreasury: await protocolTreasury.getAddress(),
            };

            paramsZero = {
                permissionless: false,
                maxTokensPerVault: BigNumber.from(1),
                governanceDelay: BigNumber.from(0),
                protocolTreasury: await protocolTreasury.getAddress(),
            };

            paramsEmpty = {
                permissionless: true,
                maxTokensPerVault: BigNumber.from(0),
                governanceDelay: BigNumber.from(0),
                protocolTreasury: await protocolTreasury.getAddress(),
            };

            paramsDefault = {
                permissionless: false,
                maxTokensPerVault: BigNumber.from(0),
                governanceDelay: BigNumber.from(0),
                protocolTreasury: ethers.constants.AddressZero,
            };

            paramsTimeout = {
                permissionless: true,
                maxTokensPerVault: BigNumber.from(1),
                governanceDelay: BigNumber.from(timeout),
                protocolTreasury: await protocolTreasury.getAddress(),
            };

            tokens = await deployERC20Tokens(3);

            return {
                protocolGovernance: protocolGovernance,
                vaultRegistry: vaultRegistry,
            };
        });
    });

    beforeEach(async () => {
        const protocolGovernanceSystem = await deploymentFixture();
        protocolGovernance = protocolGovernanceSystem.protocolGovernance;
        sleep(defaultGovernanceDelay);
    });

    describe("constructor", () => {
        it("has empty pending claim allow list", async () => {
            expect(await protocolGovernance.claimAllowlist()).to.be.empty;
        });

        it("has no vault governances", async () => {
            expect(await protocolGovernance.vaultGovernances()).to.be.empty;
        });

        it("has no allowed tokens", async () => {
            expect(await protocolGovernance.tokenWhitelist()).to.be.empty;
        });

        it("has empty pending claim allow list add", async () => {
            expect(await protocolGovernance.pendingClaimAllowlistAdd()).to.be
                .empty;
        });

        it("has empty pending token whitelist add", async () => {
            expect(await protocolGovernance.pendingTokenWhitelistAdd()).to.be
                .empty;
        });

        it("has empty pending vault governances add", async () => {
            expect(await protocolGovernance.pendingVaultGovernancesAdd()).to.be
                .empty;
        });

        it("has no pending params", async () => {
            expect(
                toObject(await protocolGovernance.pendingParams())
            ).to.deep.equal(paramsDefault);
        });

        it("deployer and stranger are not vault governances", async () => {
            expect(
                await protocolGovernance.isVaultGovernance(
                    await deployer.getAddress()
                )
            ).to.be.equal(false);

            expect(
                await protocolGovernance.isVaultGovernance(
                    await stranger.getAddress()
                )
            ).to.be.equal(false);
        });

        it("does not allow deployer to claim", async () => {
            expect(
                await protocolGovernance.isAllowedToClaim(deployer.getAddress())
            ).to.be.equal(false);
        });

        it("does not allow stranger to claim", async () => {
            expect(
                await protocolGovernance.isAllowedToClaim(stranger.getAddress())
            ).to.be.equal(false);
        });

        it("all tokens are not in whitelist by default", async () => {
            expect(
                await protocolGovernance.isAllowedToken(tokens[0].address)
            ).to.be.equal(false);
            expect(
                await protocolGovernance.isAllowedToken(tokens[1].address)
            ).to.be.equal(false);
        });

        describe("initial params struct values", () => {
            it("has initial params struct", async () => {
                expect(
                    toObject(await protocolGovernance.params())
                ).to.deep.equal(initialParams);
            });

            it("by default permissionless == true", async () => {
                expect(await protocolGovernance.permissionless()).to.be.equal(
                    initialParams.permissionless
                );
            });

            it("has max tokens per vault", async () => {
                expect(
                    await protocolGovernance.maxTokensPerVault()
                ).to.be.equal(initialParams.maxTokensPerVault);
            });

            it("has governance delay", async () => {
                expect(await protocolGovernance.governanceDelay()).to.be.equal(
                    initialParams.governanceDelay
                );
            });
        });
    });

    describe("setPendingParams", () => {
        describe("when called once", () => {
            it("sets the params", async () => {
                await protocolGovernance.setPendingParams(params);

                expect(
                    toObject(await protocolGovernance.functions.pendingParams())
                ).to.deep.equal(params);
            });
        });

        describe("when called twice", () => {
            it("sets the params", async () => {
                await protocolGovernance.setPendingParams(paramsTimeout);
                await protocolGovernance.setPendingParams(paramsZero);

                expect(
                    toObject(await protocolGovernance.functions.pendingParams())
                ).to.deep.equal(paramsZero);
            });
        });
    });

    it("sets governance delay", async () => {
        sleepTo(timestamp);
        await protocolGovernance.setPendingParams(params);
        expect(
            Math.abs(
                (await protocolGovernance.pendingParamsTimestamp()) - timestamp
            )
        ).to.be.equal(SECONDS_PER_DAY);
    });

    describe("when callen by not admin", () => {
        it("reverts", async () => {
            await expect(
                protocolGovernance.connect(stranger).setPendingParams(params)
            ).to.be.revertedWith(Exceptions.ADMIN);
        });
    });

    describe("commitParams", () => {
        describe("when callen by not admin", () => {
            it("reverts", async () => {
                await protocolGovernance.setPendingParams(paramsZero);

                await expect(
                    protocolGovernance.connect(stranger).commitParams()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when governance delay has not passed", () => {
            describe("when call immediately", () => {
                it("reverts", async () => {
                    await protocolGovernance.setPendingParams(paramsTimeout);

                    sleep(100 * 1000);

                    await protocolGovernance.commitParams();

                    await protocolGovernance.setPendingParams(paramsZero);
                    await expect(
                        protocolGovernance.commitParams()
                    ).to.be.revertedWith(Exceptions.TIMESTAMP);
                });
            });

            describe("when delay has almost passed", () => {
                it("reverts", async () => {
                    await protocolGovernance.setPendingParams(paramsTimeout);

                    sleep(100 * 1000);

                    await protocolGovernance.commitParams();

                    sleep(timeout - 2);

                    await protocolGovernance.setPendingParams(paramsZero);
                    await expect(
                        protocolGovernance.commitParams()
                    ).to.be.revertedWith(Exceptions.TIMESTAMP);
                });
            });
        });

        describe("when governanceDelay is 0 and maxTokensPerVault is 0", () => {
            it("reverts", async () => {
                await protocolGovernance.setPendingParams(paramsEmpty);

                sleep(100 * 1000);

                await expect(
                    protocolGovernance.commitParams()
                ).to.be.revertedWith(Exceptions.EMPTY_PARAMS);
            });
        });

        it("commits params", async () => {
            await protocolGovernance.setPendingParams(paramsZero);

            sleep(100 * 1000);

            await protocolGovernance.commitParams();
            expect(toObject(await protocolGovernance.params())).to.deep.equal(
                paramsZero
            );
        });

        it("deletes pending params", async () => {
            await protocolGovernance.setPendingParams(paramsZero);

            sleep(100 * 1000);

            await protocolGovernance.commitParams();
            expect(
                toObject(await protocolGovernance.pendingParams())
            ).to.deep.equal(paramsDefault);
        });

        describe("when commited twice", () => {
            it("reverts", async () => {
                await protocolGovernance.setPendingParams(paramsZero);

                sleep(100 * 1000);

                await protocolGovernance.commitParams();

                await expect(
                    protocolGovernance.commitParams()
                ).to.be.revertedWith(Exceptions.EMPTY_PARAMS);
            });
        });

        it("deletes pending params timestamp", async () => {
            timestamp += 10 ** 6;

            sleepTo(timestamp);

            await protocolGovernance.setPendingParams(paramsTimeout);

            timestamp += 10 ** 6;
            sleepTo(timestamp);
            await protocolGovernance.commitParams();

            expect(
                await protocolGovernance.pendingParamsTimestamp()
            ).to.be.equal(BigNumber.from(0));
        });
    });

    describe("setPendingClaimAllowlistAdd", () => {
        it("sets pending list", async () => {
            await protocolGovernance.setPendingClaimAllowlistAdd([
                user1.getAddress(),
                user2.getAddress(),
            ]);

            expect(
                await protocolGovernance.pendingClaimAllowlistAdd()
            ).to.deep.equal([
                await user1.getAddress(),
                await user2.getAddress(),
            ]);
        });

        it("sets correct pending timestamp with zero gonernance delay", async () => {
            timestamp += 10 ** 6;
            sleepTo(timestamp);
            await protocolGovernance.setPendingParams(paramsZero);

            timestamp += 10 ** 6;
            sleepTo(timestamp);
            await protocolGovernance.commitParams();

            await protocolGovernance.setPendingClaimAllowlistAdd([
                user1.getAddress(),
                user2.getAddress(),
            ]);

            expect(
                Math.abs(
                    (await protocolGovernance.pendingClaimAllowlistAddTimestamp()) -
                        timestamp
                )
            ).to.be.lessThanOrEqual(SECONDS_PER_DAY + 1);
        });

        it("sets correct pending timestamp with non-zero governance delay", async () => {
            timestamp += 10 ** 6;
            sleepTo(timestamp);
            await protocolGovernance.setPendingParams(paramsTimeout);

            timestamp += 10 ** 6;
            sleepTo(timestamp);
            await protocolGovernance.commitParams();

            await protocolGovernance.setPendingClaimAllowlistAdd([
                user1.getAddress(),
                user2.getAddress(),
            ]);

            expect(
                Math.abs(
                    (await protocolGovernance.pendingClaimAllowlistAddTimestamp()) -
                        (timestamp + timeout)
                )
            ).to.be.lessThanOrEqual(SECONDS_PER_DAY + 1);
        });

        describe("when callen by not admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .setPendingClaimAllowlistAdd([])
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });
    });

    describe("setPendingVaultGovernancesAdd", () => {
        describe("sets pending vault governances", () => {
            describe("when there are no repeating addresses", () => {
                it("sets", async () => {
                    await protocolGovernance.setPendingVaultGovernancesAdd([
                        await user1.getAddress(),
                        await user2.getAddress(),
                    ]);

                    expect(
                        await protocolGovernance.pendingVaultGovernancesAdd()
                    ).to.deep.equal([
                        await user1.getAddress(),
                        await user2.getAddress(),
                    ]);
                });
            });

            describe("when there are repeating addresses", () => {
                it("sets", async () => {
                    await protocolGovernance.setPendingVaultGovernancesAdd([
                        await user1.getAddress(),
                        await user2.getAddress(),
                        await user2.getAddress(),
                        await user1.getAddress(),
                    ]);

                    expect(
                        await protocolGovernance.pendingVaultGovernancesAdd()
                    ).to.deep.equal([
                        await user1.getAddress(),
                        await user2.getAddress(),
                        await user2.getAddress(),
                        await user1.getAddress(),
                    ]);
                });
            });

            it("sets pendingVaultGovernancesAddTimestamp", async () => {
                timestamp += timeShift;
                sleepTo(timestamp);

                await protocolGovernance.setPendingVaultGovernancesAdd([
                    await user1.getAddress(),
                    await user2.getAddress(),
                ]);

                expect(
                    Math.abs(
                        (await protocolGovernance.pendingVaultGovernancesAddTimestamp()) -
                            timestamp
                    )
                ).to.be.lessThanOrEqual(SECONDS_PER_DAY + 1);
            });
        });

        describe("when callen by not admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .setPendingVaultGovernancesAdd([
                            await user1.getAddress(),
                            await user2.getAddress(),
                        ])
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });
    });

    describe("commitVaultGovernancesAdd", () => {
        describe("when there are no repeating addresses", () => {
            it("sets vault governance add", async () => {
                await protocolGovernance.setPendingVaultGovernancesAdd([
                    await user1.getAddress(),
                    await user2.getAddress(),
                    await user3.getAddress(),
                ]);

                await sleep(SECONDS_PER_DAY);

                await protocolGovernance.commitVaultGovernancesAdd();

                expect(
                    await protocolGovernance.isVaultGovernance(
                        await user1.getAddress()
                    )
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isVaultGovernance(
                        await user2.getAddress()
                    )
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isVaultGovernance(
                        await user3.getAddress()
                    )
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isVaultGovernance(
                        await stranger.getAddress()
                    )
                ).to.be.equal(false);
            });
        });

        describe("when there are repeating addresses", () => {
            it("sets vault governance add", async () => {
                await protocolGovernance.setPendingVaultGovernancesAdd([
                    await user1.getAddress(),
                    await user2.getAddress(),
                    await user2.getAddress(),
                    await user1.getAddress(),
                    await user3.getAddress(),
                ]);

                await sleep(SECONDS_PER_DAY);

                await protocolGovernance.commitVaultGovernancesAdd();

                expect(
                    await protocolGovernance.isVaultGovernance(
                        await user1.getAddress()
                    )
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isVaultGovernance(
                        await user2.getAddress()
                    )
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isVaultGovernance(
                        await user3.getAddress()
                    )
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isVaultGovernance(
                        await stranger.getAddress()
                    )
                ).to.be.equal(false);
            });
        });

        describe("when callen by not admin", () => {
            it("reverts", async () => {
                await protocolGovernance.setPendingVaultGovernancesAdd([
                    await user1.getAddress(),
                    await user2.getAddress(),
                ]);

                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .commitVaultGovernancesAdd()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when pendingVaultGovernancesAddTimestamp has not passed or has almost passed", () => {
            it("reverts", async () => {
                await protocolGovernance.setPendingParams(params);
                await sleep(SECONDS_PER_DAY + 1);
                await protocolGovernance.commitParams();
                timestamp += timeShift;
                await sleepTo(timestamp);
                await protocolGovernance.setPendingVaultGovernancesAdd([
                    await user1.getAddress(),
                    await user2.getAddress(),
                ]);

                await expect(
                    protocolGovernance.commitVaultGovernancesAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);

                await sleep(1);
                await expect(
                    protocolGovernance.commitVaultGovernancesAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });

        describe("when pendingVaultGovernancesAddTimestamp has not been set", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance.commitVaultGovernancesAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });
    });

    describe("commitClaimAllowlistAdd", () => {
        describe("appends zero address to list", () => {
            it("appends", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();
                expect(await protocolGovernance.claimAllowlist()).to.deep.equal(
                    []
                );
            });
        });

        describe("appends one address to list", () => {
            it("appends", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([
                    user1.getAddress(),
                ]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();
                expect(await protocolGovernance.claimAllowlist()).to.deep.equal(
                    [await user1.getAddress()]
                );
            });
        });

        describe("appends multiple addresses to list", () => {
            it("appends", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([
                    deployer.getAddress(),
                ]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();

                await protocolGovernance.setPendingClaimAllowlistAdd([
                    user1.getAddress(),
                    user2.getAddress(),
                ]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();

                expect(await protocolGovernance.claimAllowlist()).to.deep.equal(
                    [
                        await deployer.getAddress(),
                        await user1.getAddress(),
                        await user2.getAddress(),
                    ]
                );
            });
        });

        describe("when callen by not admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .commitClaimAllowlistAdd()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when does not have pre-set claim allow list add timestamp", () => {
            it("reverts", async () => {
                timestamp += 10 ** 6;
                sleepTo(timestamp);
                await expect(
                    protocolGovernance.commitClaimAllowlistAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });

        describe("when governance delay has not passed", () => {
            it("reverts", async () => {
                timestamp += 10 ** 6;
                sleepTo(timestamp);
                await protocolGovernance.setPendingParams(paramsTimeout);

                timestamp += 10 ** 6;
                sleepTo(timestamp);
                await protocolGovernance.commitParams();

                await protocolGovernance.setPendingClaimAllowlistAdd([
                    user1.getAddress(),
                    user2.getAddress(),
                ]);

                await expect(
                    protocolGovernance.commitClaimAllowlistAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });
    });

    describe("removeFromClaimAllowlist", async () => {
        describe("when removing non-existing address", () => {
            it("does nothing", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([
                    user1.getAddress(),
                    user2.getAddress(),
                ]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();
                await protocolGovernance.removeFromClaimAllowlist(
                    stranger.getAddress()
                );
                expect(await protocolGovernance.claimAllowlist()).to.deep.equal(
                    [await user1.getAddress(), await user2.getAddress()]
                );
            });
        });

        describe("when remove called once", () => {
            it("removes the address", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([
                    deployer.getAddress(),
                    user1.getAddress(),
                    user2.getAddress(),
                ]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();
                await protocolGovernance.removeFromClaimAllowlist(
                    user1.getAddress()
                );
                expect([
                    (await protocolGovernance.isAllowedToClaim(
                        await deployer.getAddress()
                    )) &&
                        (await protocolGovernance.isAllowedToClaim(
                            await user2.getAddress()
                        )),
                    await protocolGovernance.isAllowedToClaim(
                        await user1.getAddress()
                    ),
                ]).to.deep.equal([true, false]);
            });
        });

        describe("when remove called twice", () => {
            it("removes the addresses", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([
                    deployer.getAddress(),
                    user1.getAddress(),
                    user2.getAddress(),
                ]);
                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();
                await protocolGovernance.removeFromClaimAllowlist(
                    user1.getAddress()
                );
                await protocolGovernance.removeFromClaimAllowlist(
                    user2.getAddress()
                );
                expect([
                    await protocolGovernance.isAllowedToClaim(
                        await deployer.getAddress()
                    ),
                    (await protocolGovernance.isAllowedToClaim(
                        await user1.getAddress()
                    )) &&
                        (await protocolGovernance.isAllowedToClaim(
                            await user2.getAddress()
                        )),
                ]).to.deep.equal([true, false]);
            });
        });

        describe("when remove called twice on the same address", () => {
            it("removes the address and does not fail then", async () => {
                await protocolGovernance.setPendingClaimAllowlistAdd([
                    deployer.getAddress(),
                    user1.getAddress(),
                    user2.getAddress(),
                ]);

                sleep(100 * 1000);

                await protocolGovernance.commitClaimAllowlistAdd();
                await protocolGovernance.removeFromClaimAllowlist(
                    user2.getAddress()
                );
                await protocolGovernance.removeFromClaimAllowlist(
                    user2.getAddress()
                );
                expect([
                    (await protocolGovernance.isAllowedToClaim(
                        await deployer.getAddress()
                    )) &&
                        (await protocolGovernance.isAllowedToClaim(
                            await user1.getAddress()
                        )),
                    await protocolGovernance.isAllowedToClaim(
                        await user2.getAddress()
                    ),
                ]).to.deep.equal([true, false]);
            });
        });

        describe("when callen by not admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .removeFromClaimAllowlist(deployer.getAddress())
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });
    });

    describe("removeFromVaultGovernances", () => {
        describe("when called by not admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .removeFromVaultGovernances(await user1.getAddress())
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when address is not in vault governances", () => {
            it("does not fail", async () => {
                await protocolGovernance.setPendingVaultGovernancesAdd([
                    await user1.getAddress(),
                    await user2.getAddress(),
                ]);
                await sleep(SECONDS_PER_DAY);
                await protocolGovernance.commitVaultGovernancesAdd();

                await expect(
                    protocolGovernance.removeFromVaultGovernances(
                        await user3.getAddress()
                    )
                ).to.not.be.reverted;

                expect(
                    (await protocolGovernance.vaultGovernances()).length
                ).to.be.equal(2);
            });
        });

        describe("when address is a vault governance", () => {
            describe("when attempt to remove one address", () => {
                it("removes", async () => {
                    await protocolGovernance.setPendingVaultGovernancesAdd([
                        await user1.getAddress(),
                        await user2.getAddress(),
                        await user3.getAddress(),
                    ]);
                    await sleep(SECONDS_PER_DAY);
                    await protocolGovernance.commitVaultGovernancesAdd();

                    await expect(
                        protocolGovernance.removeFromVaultGovernances(
                            await user3.getAddress()
                        )
                    ).to.not.be.reverted;
                    expect(
                        await protocolGovernance.isVaultGovernance(
                            await user3.getAddress()
                        )
                    ).to.be.equal(false);
                    expect(
                        await protocolGovernance.isVaultGovernance(
                            await user2.getAddress()
                        )
                    ).to.be.equal(true);
                    expect(
                        await protocolGovernance.isVaultGovernance(
                            await user1.getAddress()
                        )
                    ).to.be.equal(true);
                });
            });
            describe("when attempt to remove multiple addresses", () => {
                it("removes", async () => {
                    await protocolGovernance.setPendingVaultGovernancesAdd([
                        await user1.getAddress(),
                        await user2.getAddress(),
                        await user3.getAddress(),
                    ]);
                    await sleep(SECONDS_PER_DAY);
                    await protocolGovernance.commitVaultGovernancesAdd();

                    await expect(
                        protocolGovernance.removeFromVaultGovernances(
                            await user3.getAddress()
                        )
                    ).to.not.be.reverted;
                    await expect(
                        protocolGovernance.removeFromVaultGovernances(
                            await user2.getAddress()
                        )
                    ).to.not.be.reverted;
                    await expect(
                        protocolGovernance.removeFromVaultGovernances(
                            await user3.getAddress()
                        )
                    ).to.not.be.reverted;

                    expect(
                        await protocolGovernance.isVaultGovernance(
                            await user3.getAddress()
                        )
                    ).to.be.equal(false);
                    expect(
                        await protocolGovernance.isVaultGovernance(
                            await user2.getAddress()
                        )
                    ).to.be.equal(false);
                    expect(
                        await protocolGovernance.isVaultGovernance(
                            await user1.getAddress()
                        )
                    ).to.be.equal(true);
                });
            });
        });
    });

    describe("setPendingTokenWhitelistAdd", () => {
        it("does not allow stranger to set pending token whitelist", async () => {
            await expect(
                protocolGovernance
                    .connect(stranger)
                    .setPendingTokenWhitelistAdd([])
            ).to.be.revertedWith(Exceptions.ADMIN);
        });

        it("sets pending token whitelist add and timestamp", async () => {
            timestamp += timeout;
            sleepTo(timestamp);
            await protocolGovernance.setPendingTokenWhitelistAdd([
                tokens[0].address,
                tokens[1].address,
            ]);
            expect(
                await protocolGovernance.pendingTokenWhitelistAdd()
            ).to.deep.equal([tokens[0].address, tokens[1].address]);
            expect(
                Math.abs(
                    (await protocolGovernance.pendingTokenWhitelistAddTimestamp()) -
                        (await protocolGovernance.governanceDelay()) -
                        timestamp
                )
            ).to.be.lessThanOrEqual(10);
        });
    });

    describe("commitTokenWhitelistAdd", () => {
        it("commits pending token whitelist", async () => {
            timestamp += timeout;
            sleepTo(timestamp);
            await protocolGovernance.setPendingTokenWhitelistAdd([
                tokens[0].address,
                tokens[1].address,
            ]);
            expect(
                await protocolGovernance.pendingTokenWhitelistAdd()
            ).to.deep.equal([tokens[0].address, tokens[1].address]);
            await sleep(Number(await protocolGovernance.governanceDelay()));
            await protocolGovernance.commitTokenWhitelistAdd();
            expect(
                await protocolGovernance.pendingTokenWhitelistAddTimestamp()
            ).to.be.equal(BigNumber.from(0));
            expect(await protocolGovernance.pendingTokenWhitelistAdd()).to.be
                .empty;
        });

        describe("when called noy by admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .commitTokenWhitelistAdd()
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when setPendingTokenWhitelistAdd has not been called", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance.commitTokenWhitelistAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });

        describe("when governance delay has not passed or has almost passed", () => {
            it("reverts", async () => {
                await protocolGovernance.setPendingTokenWhitelistAdd([
                    tokens[0].address,
                    tokens[1].address,
                ]);
                await expect(
                    protocolGovernance.commitTokenWhitelistAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
                await sleep(
                    Number(await protocolGovernance.governanceDelay()) - 5
                );
                await expect(
                    protocolGovernance.commitTokenWhitelistAdd()
                ).to.be.revertedWith(Exceptions.TIMESTAMP);
            });
        });

        describe("when setting to identic addresses", () => {
            it("passes", async () => {
                await protocolGovernance.setPendingTokenWhitelistAdd([
                    tokens[0].address,
                    tokens[1].address,
                    tokens[0].address,
                ]);
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await protocolGovernance.commitTokenWhitelistAdd();
                expect(await protocolGovernance.tokenWhitelist()).to.deep.equal(
                    [tokens[0].address, tokens[1].address]
                );
            });
        });
    });

    describe("removeFromTokenWhitelist", () => {
        describe("when called not by admin", () => {
            it("reverts", async () => {
                await expect(
                    protocolGovernance
                        .connect(stranger)
                        .removeFromTokenWhitelist(tokens[0].address)
                ).to.be.revertedWith(Exceptions.ADMIN);
            });
        });

        describe("when passed an address which is not in token whitelist", () => {
            it("passes", async () => {
                await protocolGovernance.setPendingTokenWhitelistAdd([
                    tokens[0].address,
                    tokens[1].address,
                ]);
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await protocolGovernance.commitTokenWhitelistAdd();
                await protocolGovernance.removeFromTokenWhitelist(
                    tokens[2].address
                );
                expect(
                    await protocolGovernance.isAllowedToken(tokens[1].address)
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isAllowedToken(tokens[0].address)
                ).to.be.equal(true);
            });
        });

        it("removes", async () => {
            await protocolGovernance.setPendingTokenWhitelistAdd([
                tokens[0].address,
                tokens[1].address,
            ]);
            await sleep(Number(await protocolGovernance.governanceDelay()));
            await protocolGovernance.commitTokenWhitelistAdd();
            await protocolGovernance.removeFromTokenWhitelist(
                tokens[0].address
            );
            expect(
                await protocolGovernance.isAllowedToken(tokens[1].address)
            ).to.be.equal(true);
            expect(
                await protocolGovernance.isAllowedToken(tokens[0].address)
            ).to.be.equal(false);
            expect(await protocolGovernance.tokenWhitelist()).to.deep.equal([
                tokens[1].address,
            ]);
        });

        describe("when call commit on removed token", () => {
            it("passes", async () => {
                await protocolGovernance.setPendingTokenWhitelistAdd([
                    tokens[0].address,
                    tokens[1].address,
                ]);
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await protocolGovernance.commitTokenWhitelistAdd();
                await protocolGovernance.removeFromTokenWhitelist(
                    tokens[0].address
                );
                await protocolGovernance.setPendingTokenWhitelistAdd([
                    tokens[0].address,
                    tokens[1].address,
                ]);
                await sleep(Number(await protocolGovernance.governanceDelay()));
                await protocolGovernance.commitTokenWhitelistAdd();
                expect(
                    await protocolGovernance.isAllowedToken(tokens[1].address)
                ).to.be.equal(true);
                expect(
                    await protocolGovernance.isAllowedToken(tokens[0].address)
                ).to.be.equal(true);
            });
        });
    });
});
