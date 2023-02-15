import { LoadFixtureFunction } from "../types";
import { OperatorResolverFixture, operatorResolverFixture } from "../shared/fixtures";
import { createFixtureLoader, provider, expect } from "../shared/provider";
import { toBytes32 } from "../helpers";
import { ActorFixture } from "../shared/actors";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { TestableMixinResolver } from "../../typechain";

let loadFixture: LoadFixtureFunction;

describe("OperatorResolver", () => {
    let context: OperatorResolverFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    const randomDestination1: Wallet = Wallet.createRandom();
    const randomDestination2: Wallet = Wallet.createRandom();
    const randomDestination3: Wallet = Wallet.createRandom();
    const randomDestination4: Wallet = Wallet.createRandom();

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(operatorResolverFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.operatorResolver.address).to.be.a.string;
    });

    describe("importAddresses()", () => {
        it("can only be invoked by the owner", async () => {
            await expect(
                context.operatorResolver
                    .connect(actors.addressResolverOwner())
                    .importOperators([toBytes32("something")], [randomDestination1.address]),
            ).to.not.be.reverted;
        });

        it("cant be invoked by an user", async () => {
            await expect(
                context.operatorResolver
                    .connect(actors.user1())
                    .importOperators([toBytes32("something")], [randomDestination1.address]),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        describe("when a different number of names are given to addresses", () => {
            it("then it reverts", async () => {
                const revertReason: string = "OperatorResolver::importOperators: Input lengths must match";
                await expect(
                    context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators([], [randomDestination1.address]),
                ).to.be.revertedWith(revertReason);

                await expect(
                    context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators([toBytes32("something")], []),
                ).to.be.revertedWith(revertReason);

                await expect(
                    context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators(
                            [toBytes32("something")],
                            [randomDestination1.address, randomDestination2.address],
                        ),
                ).to.be.revertedWith(revertReason);
            });
        });

        describe("when three separate addresses are given", () => {
            beforeEach(async () => {
                await context.operatorResolver
                    .connect(actors.addressResolverOwner())
                    .importOperators(["first", "second", "third"].map(toBytes32), [
                        randomDestination1.address,
                        randomDestination2.address,
                        randomDestination3.address,
                    ]);
            });
            it("then it can verify the imported set of addresses", async () => {
                expect(
                    await context.operatorResolver.areAddressesImported(["first", "second", "third"].map(toBytes32), [
                        randomDestination1.address,
                        randomDestination2.address,
                        randomDestination3.address,
                    ]),
                ).to.be.true;

                expect(
                    await context.operatorResolver.areAddressesImported(["first", "second", "third"].map(toBytes32), [
                        randomDestination2.address,
                        randomDestination1.address,
                        randomDestination3.address,
                    ]),
                ).to.be.false;
            });
            it("then each can be looked up in turn", async () => {
                expect(await context.operatorResolver.getAddress(toBytes32("first"))).to.be.equal(
                    randomDestination1.address,
                );
                expect(await context.operatorResolver.getAddress(toBytes32("second"))).to.be.equal(
                    randomDestination2.address,
                );
                expect(await context.operatorResolver.getAddress(toBytes32("third"))).to.be.equal(
                    randomDestination3.address,
                );
            });

            describe("when two are overridden", () => {
                beforeEach(async () => {
                    await context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators(["second", "third"].map(toBytes32), [
                            randomDestination3.address,
                            randomDestination4.address,
                        ]);
                });
                it("then the first remains the same while the other two are updated", async () => {
                    expect(await context.operatorResolver.getAddress(toBytes32("first"))).to.be.equal(
                        randomDestination1.address,
                    );
                    expect(await context.operatorResolver.getAddress(toBytes32("second"))).to.be.equal(
                        randomDestination3.address,
                    );
                    expect(await context.operatorResolver.getAddress(toBytes32("third"))).to.be.equal(
                        randomDestination4.address,
                    );
                });
            });
        });
    });

    describe("getAddress()", () => {
        it("when invoked with no entries, returns 0 address", async () => {
            expect(await context.operatorResolver.getAddress(toBytes32("first"))).to.be.equal(
                ethers.constants.AddressZero,
            );
        });
        describe("when three separate addresses are given", () => {
            beforeEach(async () => {
                await context.operatorResolver
                    .connect(actors.addressResolverOwner())
                    .importOperators(["first", "second", "third"].map(toBytes32), [
                        randomDestination1.address,
                        randomDestination2.address,
                        randomDestination3.address,
                    ]);
            });
            it("then getAddress returns the same as the public mapping", async () => {
                expect(await context.operatorResolver.getAddress(toBytes32("third"))).to.be.equal(
                    randomDestination3.address,
                );
                expect(await context.operatorResolver.operators(toBytes32("first"))).to.be.equal(
                    randomDestination1.address,
                );
                expect(await context.operatorResolver.operators(toBytes32("third"))).to.be.equal(
                    randomDestination3.address,
                );
            });
        });
    });

    describe("requireAndGetAddress()", () => {
        const errorMessage: string = "Error !";
        it("when invoked with no entries, reverts", async () => {
            await expect(
                context.operatorResolver.requireAndGetAddress(toBytes32("first"), errorMessage),
            ).to.be.revertedWith(errorMessage);
        });
        describe("when three separate addresses are given", () => {
            beforeEach(async () => {
                await context.operatorResolver
                    .connect(actors.addressResolverOwner())
                    .importOperators(["first", "second", "third"].map(toBytes32), [
                        randomDestination1.address,
                        randomDestination2.address,
                        randomDestination3.address,
                    ]);
            });
            it("then requireAndGetAddress() returns the same as the public mapping", async () => {
                expect(
                    await context.operatorResolver.requireAndGetAddress(toBytes32("second"), errorMessage),
                ).to.be.equal(randomDestination2.address);
                expect(
                    await context.operatorResolver.requireAndGetAddress(toBytes32("third"), errorMessage),
                ).to.be.equal(randomDestination3.address);
            });
            it("when invoked with an unknown entry, reverts", async () => {
                await expect(
                    context.operatorResolver.requireAndGetAddress(toBytes32("other"), errorMessage),
                ).to.be.revertedWith(errorMessage);
            });
        });
    });

    describe("rebuildCaches()", () => {
        describe("when some MixinResolver contracts exist", () => {
            let mixinResolver1: FakeContract<TestableMixinResolver>;

            beforeEach("smock some MixinResolver contracts", async () => {
                mixinResolver1 = await smock.fake<TestableMixinResolver>("TestableMixinResolver");
            });

            describe("when some of these contracts are imported and caches are rebuilt", () => {
                beforeEach("import contracts and rebuild caches", async () => {
                    await context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators(["first", "second", "third"].map(toBytes32), [
                            mixinResolver1.address,
                            mixinResolver1.address,
                            mixinResolver1.address,
                        ]);

                    await context.operatorResolver.rebuildCaches([mixinResolver1.address, mixinResolver1.address]);
                });

                it("shows that rebuildCache() was called on imported addresses", async () => {
                    expect(mixinResolver1.rebuildCache).to.have.been.calledTwice;
                });
            });
        });
    });
});
