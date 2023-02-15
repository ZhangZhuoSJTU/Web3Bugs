import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { deployPhase1, deployPhase2, Phase2Deployed } from "../scripts/deploySystem";
import { deployMocks, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { AuraLocker, AuraVestedEscrow, AuraVestedEscrow__factory, ERC20 } from "../types/generated";
import { ONE_WEEK, ZERO_ADDRESS } from "../test-utils/constants";
import { getTimestamp, increaseTime } from "../test-utils/time";
import { BN, simpleToExactAmount } from "../test-utils/math";
import { impersonateAccount } from "../test-utils/fork";

describe("AuraVestedEscrow", () => {
    let accounts: Signer[];

    let contracts: Phase2Deployed;
    let aura: ERC20;
    let auraLocker: AuraLocker;
    let vestedEscrow: AuraVestedEscrow;

    let deployTime: BN;

    let deployer: Signer;
    let deployerAddress: string;

    let fundAdmin: Signer;
    let fundAdminAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    let bob: Signer;
    let bobAddress: string;

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        const mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();

        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        contracts = await deployPhase2(hre, deployer, phase1, distro, multisigs, mocks.namingConfig, mocks.addresses);

        deployerAddress = await deployer.getAddress();

        fundAdmin = accounts[1];
        fundAdminAddress = await fundAdmin.getAddress();

        alice = accounts[2];
        aliceAddress = await alice.getAddress();

        bob = accounts[3];
        bobAddress = await bob.getAddress();

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await contracts.cvx.connect(operatorAccount.signer).transfer(deployerAddress, simpleToExactAmount(1000));

        aura = contracts.cvx.connect(deployer) as ERC20;
        auraLocker = contracts.cvxLocker.connect(deployer);

        deployTime = await getTimestamp();
        vestedEscrow = await new AuraVestedEscrow__factory(deployer).deploy(
            aura.address,
            fundAdminAddress,
            auraLocker.address,
            deployTime.add(ONE_WEEK),
            deployTime.add(ONE_WEEK.mul(53)),
        );
    });

    it("initial configuration is correct", async () => {
        expect(await vestedEscrow.rewardToken()).eq(aura.address);
        expect(await vestedEscrow.admin()).eq(fundAdminAddress);
        expect(await vestedEscrow.auraLocker()).eq(auraLocker.address);
        expect(await vestedEscrow.startTime()).eq(deployTime.add(ONE_WEEK));
        expect(await vestedEscrow.endTime()).eq(deployTime.add(ONE_WEEK.mul(53)));
        expect(await vestedEscrow.totalTime()).eq(ONE_WEEK.mul(52));
        expect(await vestedEscrow.initialised()).eq(false);
    });
    // Funds Alice = 200 and Bob = 100
    it("funds an array of recipients", async () => {
        const balBefore = await aura.balanceOf(vestedEscrow.address);
        await aura.approve(vestedEscrow.address, simpleToExactAmount(300));
        await vestedEscrow.fund([aliceAddress, bobAddress], [simpleToExactAmount(200), simpleToExactAmount(100)]);

        const balAfter = await aura.balanceOf(vestedEscrow.address);
        expect(balAfter).eq(balBefore.add(simpleToExactAmount(300)));

        expect(await vestedEscrow.totalLocked(aliceAddress)).eq(simpleToExactAmount(200));
        expect(await vestedEscrow.available(aliceAddress)).lt(simpleToExactAmount(0.01));
        expect(await vestedEscrow.remaining(aliceAddress)).gt(simpleToExactAmount(199.99));
        expect(await vestedEscrow.totalLocked(bobAddress)).eq(simpleToExactAmount(100));
        expect(await vestedEscrow.available(bobAddress)).lt(simpleToExactAmount(0.01));
        expect(await vestedEscrow.remaining(bobAddress)).gt(simpleToExactAmount(99.99));
    });
    it("fails to fund again", async () => {
        expect(await vestedEscrow.initialised()).eq(true);
        await expect(vestedEscrow.fund([], [])).to.be.revertedWith("initialised already");
    });

    // fast forward 6 months, available balances should be visible
    it("vests over time", async () => {
        await increaseTime(ONE_WEEK.mul(27));

        let aliceAvailable = await vestedEscrow.available(aliceAddress);
        expect(aliceAvailable).gt(simpleToExactAmount(99));
        expect(aliceAvailable).lt(simpleToExactAmount(101));

        const balBefore = await aura.balanceOf(aliceAddress);
        const tx = await vestedEscrow.connect(alice).claim(false);
        const balAfter = await aura.balanceOf(aliceAddress);

        await expect(tx).to.emit(vestedEscrow, "Claim").withArgs(aliceAddress, balAfter.sub(balBefore), false);

        expect(await vestedEscrow.totalClaimed(aliceAddress)).eq(balAfter.sub(balBefore));

        aliceAvailable = await vestedEscrow.available(aliceAddress);
        expect(aliceAvailable).lt(simpleToExactAmount(0.01));

        await vestedEscrow.connect(alice).claim(false);
        const balEnd = await aura.balanceOf(aliceAddress);
        expect(balEnd.sub(balAfter)).lt(simpleToExactAmount(0.01));
    });
    it("fails to claim if the locker address is zero", async () => {
        await vestedEscrow.connect(fundAdmin).setLocker(ZERO_ADDRESS);
        expect(await vestedEscrow.auraLocker()).eq(ZERO_ADDRESS);
        await expect(vestedEscrow.connect(alice).claim(true)).to.be.revertedWith("!auraLocker");
        // return original value
        await vestedEscrow.connect(fundAdmin).setLocker(auraLocker.address);
    });
    // fast forward 1 month, lock in auraLocker
    it("allows claimers to lock in AuraLocker", async () => {
        await increaseTime(ONE_WEEK.mul(4));

        const aliceAvailable = await vestedEscrow.available(aliceAddress);
        expect(aliceAvailable).lt(simpleToExactAmount(16));
        expect(aliceAvailable).gt(simpleToExactAmount(15));

        const balBefore = await auraLocker.balances(aliceAddress);
        expect(balBefore.locked).eq(0);

        const tx = await vestedEscrow.connect(alice).claim(true);
        const balAfter = await auraLocker.balances(aliceAddress);

        await expect(tx).to.emit(vestedEscrow, "Claim").withArgs(aliceAddress, balAfter.locked, true);
    });
    it("fails to cancel if not admin", async () => {
        await expect(vestedEscrow.connect(alice).cancel(bobAddress)).to.be.revertedWith("!auth");
    });
    it("allows admin to cancel stream", async () => {
        const fundAdminBefore = await aura.balanceOf(fundAdminAddress);
        const bobBefore = await aura.balanceOf(bobAddress);

        // Bob has ~57 tokens available at this stage as 30 weeks have elapsed

        const tx = await vestedEscrow.connect(fundAdmin).cancel(bobAddress);
        await expect(tx).to.emit(vestedEscrow, "Cancelled").withArgs(bobAddress);

        const bobAfter = await aura.balanceOf(bobAddress);
        expect(bobAfter.sub(bobBefore)).gt(simpleToExactAmount(57));
        expect(bobAfter.sub(bobBefore)).lt(simpleToExactAmount(58));
        const fundAdminAfter = await aura.balanceOf(fundAdminAddress);
        expect(fundAdminAfter.sub(fundAdminBefore)).gt(simpleToExactAmount(42));
        expect(fundAdminAfter.sub(fundAdminBefore)).lt(simpleToExactAmount(43));

        await expect(vestedEscrow.connect(bob).claim(false)).to.be.revertedWith("Arithmetic operation underflowed");
        await expect(vestedEscrow.connect(bob).available(bobAddress)).to.be.revertedWith(
            "Arithmetic operation underflowed",
        );
        expect(await vestedEscrow.connect(bob).remaining(bobAddress)).eq(0);
    });
    it("fails to cancel stream if recipient has no lock", async () => {
        await expect(vestedEscrow.connect(fundAdmin).cancel(bobAddress)).to.be.revertedWith("!funding");
    });

    it("fails to set admin if not admin", async () => {
        await expect(vestedEscrow.connect(bob).setAdmin(bobAddress)).to.be.revertedWith("!auth");
    });
    it("fails to set locker if not admin", async () => {
        await expect(vestedEscrow.connect(bob).setLocker(bobAddress)).to.be.revertedWith("!auth");
    });
    it("allows admin to change admin", async () => {
        await vestedEscrow.connect(fundAdmin).setAdmin(bobAddress);
        expect(await vestedEscrow.admin()).eq(bobAddress);
    });
    it("allows admin to change locker", async () => {
        await vestedEscrow.connect(bob).setLocker(bobAddress);
        expect(await vestedEscrow.auraLocker()).eq(bobAddress);
    });

    describe("constructor fails", async () => {
        before(async () => {
            deployTime = await getTimestamp();
        });
        it("if start date is not in the future", async () => {
            await expect(
                new AuraVestedEscrow__factory(deployer).deploy(
                    aura.address,
                    fundAdminAddress,
                    auraLocker.address,
                    deployTime.sub(ONE_WEEK),
                    deployTime.add(ONE_WEEK.mul(53)),
                ),
            ).to.be.revertedWith("start must be future");
        });
        it("if end date is before the start date", async () => {
            await expect(
                new AuraVestedEscrow__factory(deployer).deploy(
                    aura.address,
                    fundAdminAddress,
                    auraLocker.address,
                    deployTime.add(ONE_WEEK),
                    deployTime.add(ONE_WEEK),
                ),
            ).to.be.revertedWith("end must be greater");
        });
        it("if the vested period is less than 16 weeks", async () => {
            await expect(
                new AuraVestedEscrow__factory(deployer).deploy(
                    aura.address,
                    fundAdminAddress,
                    auraLocker.address,
                    deployTime.add(ONE_WEEK),
                    deployTime.add(ONE_WEEK.mul(15)),
                ),
            ).to.be.revertedWith("!short");
        });
    });
});
