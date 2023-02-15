import { assertBNClose } from "./../test-utils/assertions";
import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { MerkleTree } from "merkletreejs";
import { deployPhase1, deployPhase2, DistroList, Phase2Deployed } from "../scripts/deploySystem";
import { deployMocks, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { AuraLocker, ERC20, AuraMerkleDrop__factory, AuraMerkleDrop } from "../types/generated";
import { ONE_WEEK, ZERO_ADDRESS } from "../test-utils/constants";
import { getTimestamp, increaseTime } from "../test-utils/time";
import { BN, simpleToExactAmount } from "../test-utils/math";
import { impersonateAccount } from "../test-utils/fork";
import { createTreeWithAccounts, getAccountBalanceProof } from "../test-utils/merkle";

describe("AuraMerkleDrop", () => {
    let accounts: Signer[];

    let contracts: Phase2Deployed;
    let aura: ERC20;
    let auraLocker: AuraLocker;
    let merkleDrop: AuraMerkleDrop;
    let drops: AuraMerkleDrop[];

    let deployTime: BN;

    let deployer: Signer;
    let deployerAddress: string;

    let admin: Signer;
    let adminAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    let bob: Signer;
    let bobAddress: string;

    let distro: DistroList;

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        const mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        distro = getMockDistro();

        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        contracts = await deployPhase2(hre, deployer, phase1, distro, multisigs, mocks.namingConfig, mocks.addresses);

        deployerAddress = await deployer.getAddress();

        admin = accounts[1];
        adminAddress = await admin.getAddress();

        alice = accounts[2];
        aliceAddress = await alice.getAddress();

        bob = accounts[3];
        bobAddress = await bob.getAddress();

        aura = contracts.cvx.connect(deployer) as ERC20;
        auraLocker = contracts.cvxLocker.connect(deployer);
        drops = contracts.drops;

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await contracts.cvx.connect(operatorAccount.signer).transfer(deployerAddress, simpleToExactAmount(1000));

        deployTime = await getTimestamp();
    });
    describe("deployed MerkleDrops", () => {
        it("it is the correct amount of drops", async () => {
            expect(drops.length).to.equal(distro.airdrops.length);
        });
        it("each distro has correct config", async () => {
            for (let i = 0; i < drops.length; i++) {
                const airdrop = distro.airdrops[i];
                const drop = drops[i];
                const cvxBalance = await aura.balanceOf(drop.address);
                // constructor args
                expect(await drop.dao(), "dao").to.eq(deployerAddress);
                expect(await drop.merkleRoot(), "merkleRoot").to.eq(airdrop.merkleRoot);
                expect(await drop.aura(), "aura").to.eq(aura.address);
                expect(await drop.auraLocker(), "auraLocker").to.eq(auraLocker.address);
                expect(await drop.penaltyForwarder(), "penaltyForwarder").to.eq(contracts.penaltyForwarder.address);
                expect(await drop.startTime(), "startTime").to.gt(deployTime);
                expect(await drop.expiryTime(), "expiryTime").to.eq(airdrop.length.add(await drop.startTime()));
                expect(await drop.pendingPenalty(), "pendingPenalty").to.eq(0);
                // when deployed , some aura token must be transferred to the drop
                expect(cvxBalance, "aura balance").to.eq(airdrop.amount);
            }
        });
    });
    describe("constructor fails", async () => {
        let tree: MerkleTree;
        before(async () => {
            const amount = simpleToExactAmount(100);
            tree = createTreeWithAccounts({
                [aliceAddress]: amount,
                [bobAddress]: amount,
            });
        });
        it("if the expire date is less than 2 weeks", async () => {
            await expect(
                new AuraMerkleDrop__factory(deployer).deploy(
                    adminAddress,
                    tree.getHexRoot(),
                    aura.address,
                    auraLocker.address,
                    contracts.penaltyForwarder.address,
                    ONE_WEEK,
                    ONE_WEEK.mul(2),
                ),
            ).to.be.revertedWith("!expiry");
        });
    });
    describe("basic MerkleDrop interactions", () => {
        let tree: MerkleTree;
        let dropAmount: BN;
        before(async () => {
            dropAmount = simpleToExactAmount(200);
            const amount = simpleToExactAmount(100);
            tree = createTreeWithAccounts({
                [aliceAddress]: amount,
                [bobAddress]: amount,
            });
            merkleDrop = await new AuraMerkleDrop__factory(deployer).deploy(
                adminAddress,
                tree.getHexRoot(),
                aura.address,
                auraLocker.address,
                contracts.penaltyForwarder.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            await aura.transfer(merkleDrop.address, dropAmount);
        });
        it("initial configuration is correct", async () => {
            expect(await merkleDrop.aura()).eq(aura.address);
            expect(await merkleDrop.dao(), "dao").to.eq(adminAddress);
            expect(await merkleDrop.merkleRoot(), "merkleRoot").to.eq(tree.getHexRoot());
            expect(await merkleDrop.aura(), "aura").to.eq(aura.address);
            expect(await merkleDrop.auraLocker(), "auraLocker").to.eq(auraLocker.address);
            expect(await merkleDrop.penaltyForwarder(), "penaltyForwarder").to.eq(contracts.penaltyForwarder.address);
            assertBNClose(await merkleDrop.startTime(), deployTime.add(ONE_WEEK), 5);
            assertBNClose(await merkleDrop.expiryTime(), deployTime.add(ONE_WEEK.mul(17)), 5);
            expect(await merkleDrop.pendingPenalty(), "pendingPenalty").to.eq(0);
            expect(await aura.balanceOf(merkleDrop.address), "aura balance").to.eq(dropAmount);
        });
        it("allows claiming and locking ", async () => {
            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(100);
            const lock = true;
            const aliceAuraBalanceBefore = await aura.balanceOf(aliceAddress);
            const aliceBalanceBefore = await auraLocker.balances(aliceAddress);
            const pendingPenaltyBefore = await merkleDrop.pendingPenalty();
            expect(await merkleDrop.hasClaimed(aliceAddress), "user  has not claimed").to.eq(false);
            const tx = merkleDrop
                .connect(alice)
                .claim(getAccountBalanceProof(tree, aliceAddress, amount), amount, lock);
            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(aliceAddress, amount, lock);
            expect(await aura.balanceOf(aliceAddress), "alice aura balance").to.eq(aliceAuraBalanceBefore);
            expect((await auraLocker.balances(aliceAddress)).locked, "alice aura locked balance").to.eq(
                aliceBalanceBefore.locked.add(amount),
            );
            expect(await merkleDrop.hasClaimed(aliceAddress), "user claimed").to.eq(true);
            expect(await merkleDrop.pendingPenalty(), "pendingPenalty").to.eq(pendingPenaltyBefore);
        });
        it("allows claiming no lock with penalty ", async () => {
            const amount = simpleToExactAmount(100);
            const lock = false;
            const userAuraBalanceBefore = await aura.balanceOf(bobAddress);
            const userBalanceBefore = await auraLocker.balances(bobAddress);
            const pendingPenaltyBefore = await merkleDrop.pendingPenalty();
            const penalty = amount.mul(2).div(10);
            expect(await merkleDrop.hasClaimed(bobAddress), "user  has not claimed").to.eq(false);
            // test
            const tx = merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock);
            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(bobAddress, amount, lock);
            expect(await aura.balanceOf(bobAddress), "user aura balance").to.eq(
                userAuraBalanceBefore.add(amount.sub(penalty)),
            );
            expect((await auraLocker.balances(bobAddress)).locked, "user aura locked balance").to.eq(
                userBalanceBefore.locked,
            );
            expect(await merkleDrop.hasClaimed(bobAddress), "user claimed").to.eq(true);
            expect(await merkleDrop.pendingPenalty(), "pendingPenalty").to.eq(pendingPenaltyBefore.add(penalty));
        });
        it("allows anyone to forward penalty ", async () => {
            const pendingPenalty = await merkleDrop.pendingPenalty();
            const auraBalance = await aura.balanceOf(contracts.penaltyForwarder.address);
            // Test
            const tx = merkleDrop.forwardPenalty();
            await expect(tx).to.emit(merkleDrop, "PenaltyForwarded").withArgs(pendingPenalty);
            expect(await merkleDrop.pendingPenalty(), "pendingPenalty").to.eq(0);
            expect(await aura.balanceOf(contracts.penaltyForwarder.address), "aura balance").to.eq(
                auraBalance.add(pendingPenalty),
            );
        });
    });
    describe("edge MerkleDrop interactions", () => {
        let tree: MerkleTree;
        let dropAmount: BN;
        before(async () => {
            dropAmount = simpleToExactAmount(200);
            const amount = simpleToExactAmount(100);
            tree = createTreeWithAccounts({
                [aliceAddress]: amount,
                [bobAddress]: amount,
            });
            merkleDrop = await new AuraMerkleDrop__factory(deployer).deploy(
                adminAddress,
                ethers.constants.HashZero,
                aura.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            await aura.transfer(merkleDrop.address, dropAmount);
        });
        it("fails claiming drop without a root", async () => {
            const amount = simpleToExactAmount(100);
            const lock = false;
            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("!root");
        });
        it("fails claiming a drop that has not started", async () => {
            await merkleDrop.connect(admin).setRoot(tree.getHexRoot());

            const amount = simpleToExactAmount(100);
            const lock = false;
            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("!started");
        });
        it("fails claiming a drop when amount is zero", async () => {
            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(0);
            const lock = false;
            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("!amount");
        });
        it("fails claiming with an invalid proof", async () => {
            const amount = simpleToExactAmount(100);
            const lock = false;
            await expect(
                merkleDrop.connect(alice).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("invalid proof");
        });
        it("allows claiming no lock without penalty ", async () => {
            const amount = simpleToExactAmount(100);
            const lock = false;
            const userAuraBalanceBefore = await aura.balanceOf(bobAddress);
            const userBalanceBefore = await auraLocker.balances(bobAddress);
            const pendingPenaltyBefore = await merkleDrop.pendingPenalty();
            const penalty = 0;
            expect(await merkleDrop.hasClaimed(bobAddress), "user  has not claimed").to.eq(false);
            expect(await merkleDrop.auraLocker(), "auraLocker not set").to.eq(ZERO_ADDRESS);
            // test
            const tx = merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock);
            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(bobAddress, amount, lock);
            expect(await aura.balanceOf(bobAddress), "user aura balance").to.eq(
                userAuraBalanceBefore.add(amount.sub(penalty)),
            );
            expect((await auraLocker.balances(bobAddress)).locked, "user aura locked balance").to.eq(
                userBalanceBefore.locked,
            );
            expect(await merkleDrop.hasClaimed(bobAddress), "user claimed").to.eq(true);
            expect(await merkleDrop.pendingPenalty(), "pendingPenalty").to.eq(pendingPenaltyBefore.add(penalty));
        });
        it("fails claiming drop more than once", async () => {
            const amount = simpleToExactAmount(100);
            const lock = false;
            expect(await merkleDrop.hasClaimed(bobAddress), "user has claimed").to.eq(true);

            await expect(
                merkleDrop.connect(bob).claim(getAccountBalanceProof(tree, bobAddress, amount), amount, lock),
            ).to.be.revertedWith("already claimed");
        });
        it("fails claiming a drop that is expired", async () => {
            await increaseTime(ONE_WEEK.mul(17));
            const amount = simpleToExactAmount(100);
            const lock = false;
            await expect(
                merkleDrop.connect(alice).claim(getAccountBalanceProof(tree, aliceAddress, amount), amount, lock),
            ).to.be.revertedWith("!active");
        });
        it("forward penalty fails if penaltyForwarder is not set", async () => {
            expect(await merkleDrop.penaltyForwarder(), "penaltyForwarder").to.eq(ZERO_ADDRESS);
            // Test
            await expect(merkleDrop.forwardPenalty()).to.be.revertedWith("!forwarder");
        });
    });
    describe("admin", () => {
        let tree: MerkleTree;
        let dropAmount: BN;
        before(async () => {
            dropAmount = simpleToExactAmount(200);
            const amount = simpleToExactAmount(100);
            tree = createTreeWithAccounts({
                [aliceAddress]: amount,
                [bobAddress]: amount,
            });
            merkleDrop = await new AuraMerkleDrop__factory(deployer).deploy(
                adminAddress,
                tree.getHexRoot(),
                aura.address,
                auraLocker.address,
                contracts.penaltyForwarder.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            await aura.transfer(merkleDrop.address, dropAmount);
        });
        it("sets a new dao ", async () => {
            const tx = await merkleDrop.connect(admin).setDao(bobAddress);
            // expect to emit event DaoSet
            await expect(tx).to.emit(merkleDrop, "DaoSet").withArgs(bobAddress);
            expect(await merkleDrop.dao()).to.eq(bobAddress);

            // revert to original admin dao
            await merkleDrop.connect(bob).setDao(adminAddress);
        });
        it("sets a new root if it was not previously set ", async () => {
            merkleDrop = await new AuraMerkleDrop__factory(deployer).deploy(
                adminAddress,
                ethers.constants.HashZero,
                aura.address,
                auraLocker.address,
                contracts.penaltyForwarder.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            const newRoot = tree.getHexRoot();
            const tx = await merkleDrop.connect(admin).setRoot(newRoot);
            // expect to emit event RootSet
            await expect(tx).to.emit(merkleDrop, "RootSet").withArgs(newRoot);
            expect(await merkleDrop.merkleRoot()).to.eq(newRoot);
        });
        it("starts early the drop ", async () => {
            const timestamp = await getTimestamp();
            const tx = await merkleDrop.connect(admin).startEarly();
            // expect to emit event StartEarly
            await expect(tx).to.emit(merkleDrop, "StartedEarly");
            assertBNClose(await merkleDrop.startTime(), timestamp, 5);
        });
        it("fails to withdraw expired if the expire time has not been reached", async () => {
            await expect(merkleDrop.connect(admin).withdrawExpired()).to.be.revertedWith("!expired");
        });
        it("withdraw expired", async () => {
            // move forward to expiry time
            await increaseTime(ONE_WEEK.mul(17));
            // get aura balance before withdraw
            const dropBalance = await aura.balanceOf(merkleDrop.address);
            const daoBalance = await aura.balanceOf(adminAddress);
            const tx = await merkleDrop.connect(admin).withdrawExpired();
            await expect(tx).to.emit(merkleDrop, "ExpiredWithdrawn").withArgs(dropBalance);
            expect(await aura.balanceOf(merkleDrop.address)).to.eq(0);
            expect(await aura.balanceOf(adminAddress)).to.eq(daoBalance.add(dropBalance));
        });
        it("set a new locker", async () => {
            const tx = await merkleDrop.connect(admin).setLocker(bobAddress);
            await expect(tx).to.emit(merkleDrop, "LockerSet").withArgs(bobAddress);
            expect(await merkleDrop.auraLocker()).to.eq(bobAddress);
        });
        it("fails if admin is not the sender", async () => {
            await expect(merkleDrop.connect(bob).setDao(bobAddress)).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).setRoot(ethers.constants.HashZero)).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).startEarly()).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).withdrawExpired()).to.be.revertedWith("!auth");
            await expect(merkleDrop.connect(bob).setLocker(bobAddress)).to.be.revertedWith("!auth");
        });
        it("fails to set a new root if it was previously set ", async () => {
            await expect(merkleDrop.connect(admin).setRoot(tree.getHexRoot())).to.be.revertedWith("already set");
        });
    });
});
