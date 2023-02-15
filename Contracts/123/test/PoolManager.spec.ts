import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3 } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockMultisigs, getMockDistro } from "../scripts/deployMocks";
import { Booster, MockCurveGauge__factory, PoolManagerV3, MockCurveGauge } from "../types/generated";
import { deployContract } from "../tasks/utils";
import { Signer } from "ethers";

describe("PoolManagerV3", () => {
    let booster: Booster;
    let poolManager: PoolManagerV3;
    let mocks: DeployMocksResult;
    let accounts: Signer[];

    let alice: Signer;

    before(async () => {
        accounts = await ethers.getSigners();

        mocks = await deployMocks(hre, accounts[0]);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();

        alice = accounts[5];

        const phase1 = await deployPhase1(hre, accounts[0], mocks.addresses);
        const phase2 = await deployPhase2(
            hre,
            accounts[0],
            phase1,
            distro,
            multisigs,
            mocks.namingConfig,
            mocks.addresses,
        );
        const contracts = await deployPhase3(hre, accounts[0], phase2, multisigs, mocks.addresses);

        booster = contracts.booster;
        poolManager = contracts.poolManager;
    });

    describe("@method addPool", async () => {
        let badGauge: MockCurveGauge;

        before(async () => {
            const badLptoken = "0x0000000000000000000000000000000000000000";
            badGauge = await deployContract<MockCurveGauge>(
                hre,
                new MockCurveGauge__factory(accounts[0]),
                "MockCurveGauge",
                ["BadGauge", "badGauge", badLptoken, []],
                {},
                false,
            );
        });

        it("addPool called by operator", async () => {
            const gauge = mocks.gauges[0];
            const tx = await poolManager["addPool(address)"](gauge.address);
            await tx.wait();

            const lptoken = await gauge.lp_token();
            const pool = await booster.poolInfo(0);
            expect(pool.lptoken).to.equal(lptoken);
        });

        it("reverts if pool weight is 0", async () => {
            const failedTx = poolManager["addPool(address)"](badGauge.address);
            await expect(failedTx).to.revertedWith("must have weight");
        });

        it("reverts if lptoken address is 0", async () => {
            const tx = await mocks.voting.vote_for_gauge_weights(badGauge.address, 1);
            await tx.wait();

            const failedTx = poolManager["addPool(address)"](badGauge.address);
            await expect(failedTx).to.revertedWith("lp token is 0");
        });

        it("reverts if gauge has already been added", async () => {
            const failedTx = poolManager["addPool(address)"](mocks.gauges[0].address);
            await expect(failedTx).to.revertedWith("already registered gauge");
        });
    });

    describe("@method shutdownPool", () => {
        it("reverts if not called by operator", async () => {
            const failedTx = poolManager.connect(accounts[2]).shutdownPool(0);
            await expect(failedTx).to.revertedWith("!auth");
        });

        it("happy path", async () => {
            const tx = await poolManager.shutdownPool(0);
            await tx.wait();

            const pool = await booster.poolInfo(0);
            expect(pool.shutdown).to.equal(true);
        });
    });

    describe("@method setProtectPool", () => {
        it("protectPool defaults to true", async () => {
            const startValue = await poolManager.protectAddPool();
            expect(startValue).to.equal(true);
        });

        it("reverts if addPool is protected and caller is not operator", async () => {
            const resp = poolManager.connect(alice)["addPool(address)"](mocks.gauges[1].address);
            await expect(resp).to.be.revertedWith("!auth");
        });

        it("reverts if setProtectPool caller is not operator", async () => {
            const resp = poolManager.connect(alice).setProtectPool(false);
            await expect(resp).to.be.revertedWith("!auth");
        });

        it("setProtectPool update protectAddPool", async () => {
            await poolManager.setProtectPool(false);
            const newValue = await poolManager.protectAddPool();
            expect(newValue).to.equal(false);
        });

        it("addPool can be called by anyone", async () => {
            const gauge = mocks.gauges[1];
            await poolManager.connect(alice)["addPool(address)"](gauge.address);

            const lptoken = await gauge.lp_token();
            const pool = await booster.poolInfo(1);
            expect(pool.lptoken).to.equal(lptoken);
        });
    });
});
