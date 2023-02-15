import { LoadFixtureFunction } from "../types";
import { zeroExOperatorFixture, ZeroExOperatorFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";

let loadFixture: LoadFixtureFunction;

/*
 * The operator's in-depth tests are in the factory tests.
 */
describe("ZeroExOperator", () => {
    let context: ZeroExOperatorFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(zeroExOperatorFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.zeroExOperator.address).to.be.a.string;
        expect(context.dummyRouter.address).to.be.a.string;
    });

    it("has swapTarget (storage)", async () => {
        expect(context.zeroExOperator.storageAddress(context.zeroExOperator.address)).to.be.a.string;
    });

    describe("commitAndRevert()", async () => {
        const initDaiBalance = await context.mockDAI.balanceOf(context.testableOperatorCaller.address);
        const initUniBalance = await context.mockUNI.balanceOf(context.testableOperatorCaller.address);
        it("Swap tokens", async () => {
            const amount = 1000;
            // Calldata swap 1000 DAI against 1000 UNI
            let calldata = context.dummyRouterInterface.encodeFunctionData("dummyswapToken", [
                context.mockDAI.address,
                context.mockUNI.address,
                amount,
            ]);

            // Run swap
            await context.testableOperatorCaller
                .connect(actors.user1())
                .zeroExCommitAndRevert(
                    context.zeroExOperator.address,
                    context.mockDAI.address,
                    context.mockUNI.address,
                    calldata,
                );

            expect(await context.mockDAI.balanceOf(context.testableOperatorCaller.address)).to.be.equal(
                initDaiBalance.sub(BigNumber.from(amount)),
            );
            expect(await context.mockUNI.balanceOf(context.testableOperatorCaller.address)).to.be.equal(
                initUniBalance.add(BigNumber.from(amount)),
            );
        });

        it("Can't swap 0 tokens", async () => {
            const amount = 0;

            // Calldata swap 1000 DAI against 1000 UNI
            let calldata = context.dummyRouterInterface.encodeFunctionData("dummyswapToken", [
                context.mockDAI.address,
                context.mockUNI.address,
                amount,
            ]);

            // Run swap
            await expect(
                context.testableOperatorCaller
                    .connect(actors.user1())
                    .zeroExCommitAndRevert(
                        context.zeroExOperator.address,
                        context.mockDAI.address,
                        context.mockUNI.address,
                        calldata,
                    ),
            ).to.be.revertedWith("TestableOperatorCaller::zeroExCommitAndRevert: Error");
        });
    });
});
