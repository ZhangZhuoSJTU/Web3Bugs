import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "ethers";
import { deployPhase1, deployPhase2, deployPhase3, MultisigConfig } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import {
    CrvDepositor,
    VoterProxy,
    CvxCrvToken,
    ERC20__factory,
    ERC20,
    CrvDepositorWrapper,
    BaseRewardPool,
} from "../types/generated";
import { getTimestamp, increaseTime } from "../test-utils/time";
import { ONE_WEEK, ZERO_ADDRESS } from "../test-utils/constants";
import { simpleToExactAmount } from "./../test-utils/math";

describe("CrvDepositor", () => {
    let accounts: Signer[];
    let mocks: DeployMocksResult;
    let crvDepositor: CrvDepositor;
    let cvxCrv: CvxCrvToken;
    let voterProxy: VoterProxy;
    let deployer: Signer;
    let deployerAddress: string;
    let alice: Signer;
    let aliceAddress: string;
    let multisigs: MultisigConfig;
    let crv: ERC20;
    let crvDepositorWrapper: CrvDepositorWrapper;
    let cvxCrvStaking: BaseRewardPool;

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];
        deployerAddress = await deployer.getAddress();

        mocks = await deployMocks(hre, deployer);
        multisigs = await getMockMultisigs(accounts[1], accounts[2], accounts[3]);
        const distro = getMockDistro();

        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        const phase2 = await deployPhase2(
            hre,
            deployer,
            phase1,
            distro,
            multisigs,
            mocks.namingConfig,
            mocks.addresses,
        );
        const contracts = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);

        alice = accounts[0];
        aliceAddress = await alice.getAddress();

        crvDepositor = contracts.crvDepositor.connect(alice);
        cvxCrv = contracts.cvxCrv.connect(alice);
        crv = mocks.crv.connect(alice);
        voterProxy = contracts.voterProxy;
        crvDepositorWrapper = contracts.crvDepositorWrapper.connect(alice);
        cvxCrvStaking = contracts.cvxCrvRewards;

        const tx = await mocks.crvBpt.connect(alice).approve(crvDepositor.address, ethers.constants.MaxUint256);
        await tx.wait();

        const crvBalance = await mocks.crvBpt.balanceOf(deployerAddress);

        const calls = [await mocks.crvBpt.transfer(aliceAddress, crvBalance.mul(90).div(100))];

        await Promise.all(calls.map(tx => tx.wait()));
    });

    describe("basic flow of locking", () => {
        it("locks up for a year initially", async () => {
            const unlockTime = await mocks.votingEscrow.lockTimes(voterProxy.address);
            const now = await getTimestamp();
            expect(unlockTime).gt(now.add(ONE_WEEK.mul(51)));
            expect(unlockTime).lt(now.add(ONE_WEEK.mul(53)));
        });

        it("deposit", async () => {
            const lock = true;
            const stakeAddress = "0x0000000000000000000000000000000000000000";
            const crvBalance = await mocks.crvBpt.balanceOf(aliceAddress);
            const amount = crvBalance.mul(10).div(100);
            const cvxCrvBefore = await cvxCrv.balanceOf(aliceAddress);

            const tx = await crvDepositor["deposit(uint256,bool,address)"](amount, lock, stakeAddress);
            await tx.wait();

            const cvxCrvAfter = await cvxCrv.balanceOf(aliceAddress);
            expect(cvxCrvAfter.sub(cvxCrvBefore)).to.equal(amount);
        });
        it("increases lock to a year again", async () => {
            const unlockTimeBefore = await mocks.votingEscrow.lockTimes(voterProxy.address);

            await increaseTime(ONE_WEEK.mul(2));

            const tx = await crvDepositor["deposit(uint256,bool,address)"](simpleToExactAmount(1), true, ZERO_ADDRESS);
            await tx.wait();

            const unlockTimeAfter = await mocks.votingEscrow.lockTimes(voterProxy.address);
            expect(unlockTimeAfter).gt(unlockTimeBefore);

            const after = await getTimestamp();
            expect(unlockTimeAfter).gt(after.add(ONE_WEEK.mul(51)));
            expect(unlockTimeAfter).lt(after.add(ONE_WEEK.mul(53)));
        });
    });

    describe("depositing via wrapper", () => {
        it("allows the sender to deposit crv, wrap to crvBpt and deposit", async () => {
            const lock = true;
            const stakeAddress = "0x0000000000000000000000000000000000000000";
            const balance = await crv.balanceOf(aliceAddress);
            const amount = balance.mul(10).div(100);

            const cvxCrvBalanceBefore = await cvxCrv.balanceOf(aliceAddress);

            const minOut = await crvDepositorWrapper.getMinOut(amount, "10000");
            await crv.approve(crvDepositorWrapper.address, amount);
            await crvDepositorWrapper.deposit(amount, minOut, lock, stakeAddress);

            const cvxCrvBalanceAfter = await cvxCrv.balanceOf(aliceAddress);
            const cvxCrvBalanceDelta = cvxCrvBalanceAfter.sub(cvxCrvBalanceBefore);
            expect(cvxCrvBalanceDelta).to.equal(minOut);
        });

        it("stakes on behalf of user", async () => {
            const lock = true;
            const stakeAddress = cvxCrvStaking.address;
            const balance = await crv.balanceOf(aliceAddress);
            const amount = balance.mul(10).div(100);

            const stakedBalanceBefore = await cvxCrvStaking.balanceOf(aliceAddress);

            const minOut = await crvDepositorWrapper.getMinOut(amount, "10000");
            await crv.approve(crvDepositorWrapper.address, amount);
            await crvDepositorWrapper.deposit(amount, minOut, lock, stakeAddress);

            const stakedBalanceAfter = await cvxCrvStaking.balanceOf(aliceAddress);
            expect(stakedBalanceAfter.sub(stakedBalanceBefore)).to.equal(minOut);
        });
    });
    describe("calling depositFor", () => {
        it("allows deposits on behalf of another user", async () => {
            const user = accounts[7];
            const userAddress = await user.getAddress();

            const lock = true;
            const stakeAddress = "0x0000000000000000000000000000000000000000";
            const crvBalance = await mocks.crvBpt.balanceOf(aliceAddress);
            const amount = crvBalance.mul(10).div(100);

            const cvxCrvBalanceBefore = await cvxCrv.balanceOf(userAddress);

            await crvDepositor.connect(alice).depositFor(userAddress, amount, lock, stakeAddress);

            const cvxCrvBalanceAfter = await cvxCrv.balanceOf(userAddress);
            const cvxCrvBalanceDelta = cvxCrvBalanceAfter.sub(cvxCrvBalanceBefore);
            expect(cvxCrvBalanceDelta).to.equal(amount);
        });
    });

    describe("system cool down", () => {
        it("setCooldown only callable by dao", async () => {
            const tx = crvDepositor.connect(accounts[5]).setCooldown(true);
            await expect(tx).to.revertedWith("!auth");
        });

        it("setCooldown called", async () => {
            const daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
            const tx = await crvDepositor.connect(daoMultisig).setCooldown(true);
            await tx.wait();
            const cooldown = await crvDepositor.cooldown();
            expect(cooldown).to.equal(true);
        });

        it("lock reverts", async () => {
            const tx = crvDepositor.lockCurve();
            await expect(tx).to.revertedWith("cooldown");
        });

        it("deposit skips lock", async () => {
            const lock = true;
            const stakeAddress = "0x0000000000000000000000000000000000000000";
            const crvBalance = await mocks.crvBpt.balanceOf(aliceAddress);
            const amount = crvBalance.mul(10).div(100);

            const beforeLockTime = await mocks.votingEscrow.lockTimes(voterProxy.address);
            const beforeLockAmount = await mocks.votingEscrow.lockAmounts(voterProxy.address);
            const cvxCrvBalanceBefore = await cvxCrv.balanceOf(aliceAddress);

            const tx = await crvDepositor["deposit(uint256,bool,address)"](amount, lock, stakeAddress);
            await tx.wait();

            const cvxCrvBalanceAfter = await cvxCrv.balanceOf(aliceAddress);
            const cvxCrvBalanceDelta = cvxCrvBalanceAfter.sub(cvxCrvBalanceBefore);
            expect(cvxCrvBalanceDelta).to.equal(amount);

            const afterLockTime = await mocks.votingEscrow.lockTimes(voterProxy.address);
            const afterLockAmount = await mocks.votingEscrow.lockAmounts(voterProxy.address);

            const lockTimeDelta = afterLockTime.sub(beforeLockTime);
            const lockAmountDelta = afterLockAmount.sub(beforeLockAmount);

            expect(lockTimeDelta.toString()).to.equal("0");
            expect(lockAmountDelta.toString()).to.equal("0");
        });
    });
    describe("setting setters", () => {
        it("allows daoOperator to set daoOperator", async () => {
            expect(await crvDepositor.daoOperator()).eq(multisigs.daoMultisig);
            const daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
            await crvDepositor.connect(daoMultisig).setDaoOperator(multisigs.treasuryMultisig);
            expect(await crvDepositor.daoOperator()).eq(multisigs.treasuryMultisig);
        });
        it("allows fails to set daoOperator if not daoOperator", async () => {
            const daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
            const tx = crvDepositor.connect(daoMultisig).setDaoOperator(multisigs.treasuryMultisig);
            await expect(tx).to.revertedWith("!auth");
        });
        it("allows feeManager to set feeManager", async () => {
            expect(await crvDepositor.feeManager()).eq(multisigs.daoMultisig);
            const daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
            await crvDepositor.connect(daoMultisig).setFeeManager(multisigs.treasuryMultisig);
            expect(await crvDepositor.feeManager()).eq(multisigs.treasuryMultisig);
        });
        it("allows fails to set feeManager if not feeManager", async () => {
            const daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
            const tx = crvDepositor.connect(daoMultisig).setFeeManager(multisigs.treasuryMultisig);
            await expect(tx).to.revertedWith("!auth");
        });
    });
});
