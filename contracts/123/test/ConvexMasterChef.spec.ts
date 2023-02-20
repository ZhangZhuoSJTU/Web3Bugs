import { expect } from "chai";
import { Signer } from "ethers";
import hre, { ethers } from "hardhat";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import {
    deployPhase1,
    deployPhase2,
    deployPhase3,
    deployPhase4,
    DistroList,
    SystemDeployed,
} from "../scripts/deploySystem";
import { deployContract } from "../tasks/utils";
import {
    advanceBlock,
    assertBNClosePercent,
    BN,
    increaseTime,
    ONE_DAY,
    ONE_WEEK,
    ONE_YEAR,
    simpleToExactAmount,
    ZERO_ADDRESS,
} from "../test-utils";
import { assertBNClose } from "../test-utils/assertions";
import { AuraToken, ConvexMasterChef, MockERC20, MockERC20__factory } from "../types/generated";

interface PoolInfo {
    lpToken: string;
    allocPoint: BN;
    lastRewardBlock: BN;
    accCvxPerShare: BN;
    rewarder: string;
}

interface UserInfo {
    amount: BN;
    rewardDebt: BN;
}
const blocksInDay = BN.from(7000);
const numberOfBlocksIn4Years = blocksInDay.mul(365).mul(4); // 4 years

describe("ConvexMasterChef", () => {
    let accounts: Signer[];
    let mocks: DeployMocksResult;
    let cvx: AuraToken;
    let chef: ConvexMasterChef;
    let alice: Signer;
    let aliceAddress: string;
    let bob: Signer;
    let bobAddress: string;
    let deployer: Signer;
    let daoMultisig: Signer;
    let distro: DistroList;
    let contracts: SystemDeployed;

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];

        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
        distro = getMockDistro();

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
        const phase3 = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);
        await phase3.poolManager.setProtectPool(false);
        contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        bob = accounts[2];
        bobAddress = await bob.getAddress();

        cvx = contracts.cvx;
        chef = contracts.chef;

        const initialBal = await mocks.crvBpt.balanceOf(await deployer.getAddress());
        await mocks.crvBpt.transfer(aliceAddress, initialBal.div(2));
        await mocks.crvBpt.transfer(bobAddress, initialBal.div(2));

        await mocks.crvBpt.connect(alice).approve(chef.address, initialBal);
        await mocks.crvBpt.connect(bob).approve(chef.address, initialBal);
    });
    describe("deployed ConvexMasterChef", () => {
        it("should properly store valid arguments", async () => {
            const currentBlock = await ethers.provider.getBlockNumber();
            const expectedStartBlock = BN.from(currentBlock).add(blocksInDay.mul(7)); // 7 days from now
            const startBlock = await chef.startBlock();
            const chefCvx = distro.lpIncentives;
            const rewardPerBlock = chefCvx.div(numberOfBlocksIn4Years);

            expect(await chef.cvx(), "cvx").to.eq(cvx.address);
            expect(await chef.rewardPerBlock(), "rewardPerBlock").to.eq(rewardPerBlock);
            //  Bonus multiplier is not used in chef, so it could be removed.
            expect(await chef.BONUS_MULTIPLIER(), "BONUS_MULTIPLIER").to.eq(2);
            assertBNClose(startBlock, expectedStartBlock, 30);
            expect(await chef.endBlock(), "endBlock").to.eq(startBlock.add(numberOfBlocksIn4Years));
        });
        it("validates deployment values", async () => {
            const poolInfo: PoolInfo = await chef.poolInfo(0);
            // only 100 cvxCrvBpt are added at deployment
            expect(await chef.totalAllocPoint(), "totalAllocPoint").to.eq(1000);
            // expect owner to be deployer
            expect(await chef.owner(), "owner").to.eq(await daoMultisig.getAddress());
            expect(await chef.poolLength(), "poolLength").to.eq(1);
            expect(poolInfo.accCvxPerShare, "userInfo accCvxPerShare").to.eq(0);
            expect(poolInfo.allocPoint, "userInfo allocPoint").to.eq(1000);
            expect(poolInfo.lpToken, "userInfo lpToken").to.eq(contracts.cvxCrvBpt.address);
            expect(poolInfo.rewarder, "userInfo rewarder").to.eq(ZERO_ADDRESS);
            expect(poolInfo.lastRewardBlock, "userInfo lastRewardBlock").to.gte(await chef.startBlock());
        });
    });
    describe("@getMultiplier", async () => {
        let startBlock: BN;
        let endBlock: BN;
        before(async () => {
            startBlock = await chef.startBlock();
            endBlock = await chef.endBlock();
        });
        it("when _from block and _to block smaller than endblock", async () => {
            const from = startBlock.add(BN.from(100));
            const to = endBlock.sub(BN.from(100));
            expect(await chef.getMultiplier(from, to), "multiplier not clamped").to.eq(to.sub(from));
        });
        it("when _from block is smaller than start block and _to block is smaller than end block ", async () => {
            const from = startBlock.sub(BN.from(100));
            const to = endBlock.sub(BN.from(100));
            expect(await chef.getMultiplier(from, to), "multiplier not clamped").to.eq(to.sub(from));
        });
        it("when _to block is greater than end block", async () => {
            const clampedMultiplier = await chef.getMultiplier(startBlock, endBlock);
            expect(await chef.getMultiplier(startBlock, endBlock.add(BN.from(100))), "multiplier").to.eq(
                clampedMultiplier,
            );
        });
        it("when _from and _to block are greater than end block", async () => {
            expect(
                await chef.getMultiplier(endBlock.add(BN.from(1)), endBlock.add(BN.from(100))),
                "zero multiplier",
            ).to.eq(0);
        });
    });
    describe("basic flow", async () => {
        const pidCvx = 0;
        const pidRtkn = 1;
        let randomToken: MockERC20;
        let cvxCrvBPT: MockERC20;
        /**
         * Verifies that a deposit to a given pool is correctly processed.
         *
         * @param {*} pid
         * @param {*} signer
         * @param {*} userAddress
         * @param {*} depositAmount
         */
        async function verifyDepositToPool(pid, signer, userAddress, depositAmount) {
            const poolInfoBefore: PoolInfo = await chef.poolInfo(pid);
            const userInfoBefore: UserInfo = await chef.userInfo(pid, userAddress);
            const userTokenBalance = await cvxCrvBPT.balanceOf(userAddress);

            // Test
            const tx = await chef.connect(signer).deposit(pid, depositAmount);
            await expect(tx).to.emit(chef, "Deposit").withArgs(userAddress, pid, depositAmount);
            // Then
            const userInfoAfter: UserInfo = await chef.userInfo(pid, userAddress);
            const userTokenBalanceAfter = await cvxCrvBPT.balanceOf(userAddress);

            expect(userTokenBalanceAfter, "user balance").to.eq(userTokenBalance.sub(depositAmount));
            expect(userInfoAfter.amount, "user info amount").to.eq(userInfoBefore.amount.add(depositAmount));

            // expect chef to receive the deposit;
            const poolInfoAfter: PoolInfo = await chef.poolInfo(pid);

            expect(poolInfoBefore.accCvxPerShare, "userInfo accCvxPerShare").to.eq(poolInfoAfter.accCvxPerShare);
            expect(poolInfoBefore.allocPoint, "userInfo allocPoint").to.eq(poolInfoAfter.allocPoint);
            expect(poolInfoBefore.lpToken, "userInfo lpToken").to.eq(poolInfoAfter.lpToken);
            expect(poolInfoBefore.rewarder, "userInfo rewarder").to.eq(poolInfoAfter.rewarder);
        }

        before(async () => {
            randomToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "RandomToken",
                ["randomToken", "randomToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );

            const poolInfo: PoolInfo = await chef.poolInfo(pidCvx);
            cvxCrvBPT = await new MockERC20__factory(deployer).attach(poolInfo.lpToken);

            const initialBal = await cvxCrvBPT.balanceOf(await deployer.getAddress());
            await cvxCrvBPT.transfer(aliceAddress, initialBal.div(2));
            await cvxCrvBPT.transfer(bobAddress, initialBal.div(2));

            await cvxCrvBPT.connect(alice).approve(chef.address, initialBal);
            await cvxCrvBPT.connect(bob).approve(chef.address, initialBal);
        });

        it("adds a new pool", async () => {
            await randomToken.transfer(chef.address, simpleToExactAmount(100000));

            // Test
            await chef.add(1000, randomToken.address, ZERO_ADDRESS, false);
            // Then
            const poolInfo: PoolInfo = await chef.poolInfo(pidRtkn);
            expect(await chef.totalAllocPoint(), "totalAllocPoint").to.eq(2000);
            expect(await chef.poolLength(), "poolLength").to.eq(2);

            expect(poolInfo.accCvxPerShare, "userInfo accCvxPerShare").to.eq(0);
            expect(poolInfo.allocPoint, "userInfo allocPoint").to.eq(1000);
            expect(poolInfo.lpToken, "userInfo lpToken").to.eq(randomToken.address);
            expect(poolInfo.rewarder, "userInfo rewarder").to.eq(ZERO_ADDRESS);
            // Verify the pool will not receive any reward until the start block
            expect(poolInfo.lastRewardBlock, "userInfo lastRewardBlock").to.gte(await chef.startBlock());
        });
        it("should not update pool if current block is lt last reward block", async () => {
            const currentBlock = await ethers.provider.getBlockNumber();
            const poolInfoBefore: PoolInfo = await chef.poolInfo(pidCvx);
            expect(currentBlock, "lastRewardBlock").to.lte(poolInfoBefore.lastRewardBlock);

            // Test
            await chef.updatePool(pidCvx);

            // Then no changes should be made
            const poolInfoAfter: PoolInfo = await chef.poolInfo(pidCvx);
            expect(poolInfoBefore.accCvxPerShare, "userInfo accCvxPerShare").to.eq(poolInfoAfter.accCvxPerShare);
            expect(poolInfoBefore.allocPoint, "userInfo allocPoint").to.eq(poolInfoAfter.allocPoint);
            expect(poolInfoBefore.lpToken, "userInfo lpToken").to.eq(poolInfoAfter.lpToken);
            expect(poolInfoBefore.rewarder, "userInfo rewarder").to.eq(poolInfoAfter.rewarder);
            expect(poolInfoBefore.lastRewardBlock, "userInfo lastRewardBlock").to.eq(poolInfoAfter.lastRewardBlock);
        });
        it("user deposits to pool", async () => {
            const depositAmount = simpleToExactAmount(100);
            await verifyDepositToPool(pidCvx, alice, aliceAddress, depositAmount);
            await verifyDepositToPool(pidCvx, bob, bobAddress, depositAmount);
        });
        it("users must not get cvx before start block", async () => {
            const currentBlock = await ethers.provider.getBlockNumber();
            const startBlock = await chef.startBlock();
            expect(currentBlock, "no rewards for current block").to.lt(startBlock);
            expect(await chef.pendingCvx(pidCvx, aliceAddress)).to.eq(0);
            expect(await chef.pendingCvx(pidCvx, bobAddress)).to.eq(0);
        });

        it("users may receive rewards after chef start block", async () => {
            await increaseTime(ONE_WEEK);
            await advanceBlock(BN.from(7).mul(blocksInDay));

            const currentBlock = await ethers.provider.getBlockNumber();
            const startBlock = await chef.startBlock();
            expect(currentBlock, "current block gt than start block").to.gt(startBlock);

            // Checks that the user has pending cvx
            const pendingCvxAlice = await chef.pendingCvx(pidCvx, aliceAddress);
            const pendingCvxBob = await chef.pendingCvx(pidCvx, bobAddress);
            expect(pendingCvxAlice, "pending cvx for alice").to.gt(0);
            expect(pendingCvxBob, "pending cvx for bob").to.gt(0);
        });
        it("users claims cvx", async () => {
            await increaseTime(ONE_WEEK);
            await advanceBlock(BN.from(7).mul(blocksInDay));
            const pendingCvxAlice = await chef.pendingCvx(pidCvx, aliceAddress);
            const userCvxBalanceBefore = await cvx.balanceOf(aliceAddress);

            // Test
            const tx = chef.claim(pidCvx, aliceAddress);
            const receipt = await (await tx).wait();
            expect(receipt.events[1].event).to.eq("RewardPaid");
            expect(receipt.events[1].args.user).to.eq(aliceAddress);
            expect(receipt.events[1].args.pid).to.eq(pidCvx);
            assertBNClosePercent(receipt.events[1].args.amount, pendingCvxAlice, "0.01");

            assertBNClosePercent(await cvx.balanceOf(aliceAddress), userCvxBalanceBefore.add(pendingCvxAlice), "0.01");

            // expect user to have 0 pending cvx
            expect(await chef.pendingCvx(pidCvx, aliceAddress)).to.eq(0);
        });
        it("users should not receive more rewards after endblock", async () => {
            await increaseTime(ONE_YEAR.mul(4));
            await advanceBlock(numberOfBlocksIn4Years);
            // claim all pending cvx
            await chef.claim(pidCvx, aliceAddress);

            // Deposit more to the pool
            await increaseTime(ONE_DAY);
            await advanceBlock(BN.from(7).mul(blocksInDay));
            const depositAmount = simpleToExactAmount(100);
            await verifyDepositToPool(pidCvx, alice, aliceAddress, depositAmount);

            // Check that the user has not pending cvx
            await increaseTime(ONE_DAY);
            await advanceBlock(BN.from(7).mul(blocksInDay));
            const pendingCvxAlice = await chef.pendingCvx(pidCvx, aliceAddress);
            expect(pendingCvxAlice, "pending cvx for alice").to.eq(0);

            const tx = chef.claim(pidCvx, aliceAddress);
            await expect(tx).to.emit(chef, "RewardPaid").withArgs(aliceAddress, pidCvx, 0);
        });
    });
});
