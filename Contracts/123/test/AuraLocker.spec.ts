import { expect } from "chai";
import { ContractTransaction, Signer } from "ethers";
import hre, { ethers } from "hardhat";
import { Account } from "types";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../scripts/deploySystem";
import { deployContract } from "../tasks/utils";
import {
    BN,
    getTimestamp,
    increaseTime,
    ONE_DAY,
    ONE_WEEK,
    simpleToExactAmount,
    ZERO,
    ZERO_ADDRESS,
} from "../test-utils";
import { impersonateAccount } from "../test-utils/fork";
import {
    AuraLocker,
    AuraStakingProxy,
    AuraToken,
    BaseRewardPool,
    Booster,
    CrvDepositor,
    CvxCrvToken,
    MockERC20,
    MockERC20__factory,
} from "../types/generated";
interface UserLock {
    amount: BN;
    unlockTime: number;
}
interface SnapshotData {
    account: {
        auraLockerBalance: BN;
        balances: { locked: BN; nextUnlockIndex: number };
        cvxBalance: BN;
        claimableRewards: Array<{ token: string; amount: BN }>;
        delegatee: string;
        locks: UserLock[];
        votes: BN;
    };
    delegatee: {
        checkpointedVotes: Array<{ votes: BN; epochStart: number }>;
        unlocks: BN[];
        votes: BN;
    };
    cvxBalance: BN;
    lockedSupply: BN;
    totalSupply: BN;
    epochs: Array<{ supply: BN; date: number }>;
}

// TODO -
// - [x] @AuraLocker.approveRewardDistributor
// - [x] @AuraLocker.setKickIncentive
// - [x] @AuraLocker.shutdown
// - [x] @AuraLocker.recoverERC20
// - [ ] @AuraLocker.getReward when _rewardsToken == cvxCrv && _stake
// - [ ] @AuraLocker._processExpiredLocks  when if (_checkDelay > 0)
// - [x] @AuraLocker.getPastTotalSupply
// - [ ] @AuraLocker.balanceOf when locks[i].unlockTime <= block.timestamp
// - [x] @AuraLocker.lockedBalances
// - [ ] @AuraLocker.totalSupply
// - [ ] @AuraLocker.totalSupplyAtEpoch
// - [x] @AuraLocker.findEpochId
// - [x] @AuraLocker.epochCount
// - [x] @AuraLocker.decimals()
// - [x] @AuraLocker.name()
// - [x] @AuraLocker.symbol()
// - [x] @AuraLocker.claimableRewards
// - [ ] @AuraLocker.queueNewRewards when NOT if(block.timestamp >= rdata.periodFinish)
// - [ ] @AuraLocker.notifyRewardAmount when NOT if (block.timestamp >= rdata.periodFinish)
// - [ ] Reward.rewardPerTokenStored changed from uint208=>uint96 , verify overflows
describe("AuraLocker", () => {
    let accounts: Signer[];
    let auraLocker: AuraLocker;
    let cvxStakingProxy: AuraStakingProxy;
    let cvxCrvRewards: BaseRewardPool;
    let booster: Booster;
    let cvx: AuraToken;
    let cvxCrv: CvxCrvToken;
    let crvDepositor: CrvDepositor;
    let mocks: DeployMocksResult;

    let deployer: Signer;

    let alice: Signer;
    let aliceInitialBalance: BN;
    let aliceAddress: string;
    let bob: Signer;
    let bobAddress: string;

    const boosterPoolId = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const logSnapShot = (data: SnapshotData, phase: string): SnapshotData => data;
    const getSnapShot = async (accountAddress: string, phase: string = "before"): Promise<SnapshotData> => {
        const delegateeAddress = await auraLocker.delegates(accountAddress);
        const locks = await getUserLocks(accountAddress, delegateeAddress);
        const checkpointedVotes = await getCheckpointedVotes(delegateeAddress);
        return logSnapShot(
            {
                account: {
                    balances: await auraLocker.balances(accountAddress),
                    auraLockerBalance: await auraLocker.balanceOf(accountAddress),
                    cvxBalance: await cvx.balanceOf(accountAddress),
                    delegatee: delegateeAddress,
                    // rewardData,
                    claimableRewards: await auraLocker.claimableRewards(accountAddress),
                    votes: await auraLocker.getVotes(accountAddress),
                    locks: locks.userLocks,
                },
                delegatee: {
                    unlocks: locks.delegateeUnlocks,
                    votes: await auraLocker.getVotes(delegateeAddress),
                    checkpointedVotes,
                },
                lockedSupply: await auraLocker.lockedSupply(),
                totalSupply: await auraLocker.totalSupply(),
                cvxBalance: await cvx.balanceOf(auraLocker.address),
                epochs: await getEpochs(),
            },
            phase,
        );
    };
    const getEpochs = async (): Promise<Array<{ supply: BN; date: number }>> => {
        const epochs = [];
        try {
            for (let i = 0; i < 128; i++) epochs.push(await auraLocker.epochs(i));
        } catch (error) {
            // do nothing
        }
        return epochs;
    };
    const getUserLocks = async (
        userAddress: string,
        delegateeAddress: string,
    ): Promise<{ userLocks: Array<UserLock>; delegateeUnlocks: Array<BN> }> => {
        const userLocks: Array<UserLock> = [];
        const delegateeUnlocks: Array<BN> = [];
        try {
            for (let i = 0; i < 128; i++) {
                const lock = await auraLocker.userLocks(userAddress, i);
                userLocks.push(lock);
                if (delegateeAddress !== ZERO_ADDRESS) {
                    delegateeUnlocks.push(await auraLocker.delegateeUnlocks(delegateeAddress, lock.unlockTime));
                }
            }
        } catch (error) {
            // do nothing
        }
        return { userLocks, delegateeUnlocks };
    };
    const getCheckpointedVotes = async (
        delegateeAddress: string,
    ): Promise<Array<{ votes: BN; epochStart: number }>> => {
        const checkpointedVotes: Array<{ votes: BN; epochStart: number }> = [];
        try {
            const len = await auraLocker.numCheckpoints(delegateeAddress);
            for (let i = 0; i < len; i++) checkpointedVotes.push(await auraLocker.checkpoints(delegateeAddress, i));
        } catch (error) {
            // do nothing
        }
        return checkpointedVotes;
    };
    const getCurrentEpoch = async (timeStamp?: BN) => {
        if (!timeStamp) {
            timeStamp = await getTimestamp();
        }
        const rewardsDuration = await auraLocker.rewardsDuration();
        return timeStamp.div(rewardsDuration).mul(rewardsDuration);
    };
    // ============================================================
    const verifyCheckpointDelegate = async (
        tx: ContractTransaction,
        dataBefore: SnapshotData,
        dataAfter: SnapshotData,
    ) => {
        await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(dataAfter.account.delegatee);
    };

    const verifyLock = async (
        tx: ContractTransaction,
        cvxAmount: BN,
        dataBefore: SnapshotData,
        dataAfter: SnapshotData,
    ) => {
        await expect(tx)
            .emit(auraLocker, "Staked")
            .withArgs(aliceAddress, simpleToExactAmount(10), simpleToExactAmount(10));
        expect(dataAfter.cvxBalance, "Staked CVX").to.equal(dataBefore.cvxBalance.add(cvxAmount));
        expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(dataBefore.lockedSupply.add(cvxAmount));
        expect(dataAfter.account.cvxBalance, "cvx balance").to.equal(dataBefore.account.cvxBalance.sub(cvxAmount));
        expect(dataAfter.account.balances.locked, "user cvx balances locked").to.equal(
            dataBefore.account.balances.locked.add(cvxAmount),
        );
        expect(dataAfter.account.balances.nextUnlockIndex, "user balances nextUnlockIndex").to.equal(
            dataBefore.account.balances.nextUnlockIndex,
        );

        const currentEpoch = await getCurrentEpoch();
        const lock = dataAfter.account.locks[dataAfter.account.locks.length - 1];
        const lockDuration = await auraLocker.lockDuration();
        const unlockTime = lockDuration.add(currentEpoch);
        expect(lock.amount, "user locked amount").to.equal(cvxAmount);
        expect(lock.unlockTime, "user unlockTime").to.equal(unlockTime);

        expect(dataAfter.account.delegatee, "user delegatee does not change").to.equal(dataBefore.account.delegatee);
        if (dataAfter.account.delegatee !== ZERO_ADDRESS) {
            const delegateeUnlocks = await auraLocker.delegateeUnlocks(dataAfter.account.delegatee, unlockTime);
            expect(delegateeUnlocks, "user unlockTime").to.equal(cvxAmount);
        }
    };

    const setup = async () => {
        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
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
        const phase3 = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);
        await phase3.poolManager.setProtectPool(false);
        const contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        bob = accounts[2];
        bobAddress = await bob.getAddress();

        booster = contracts.booster;
        auraLocker = contracts.cvxLocker;
        cvxStakingProxy = contracts.cvxStakingProxy;
        cvxCrvRewards = contracts.cvxCrvRewards;
        cvx = contracts.cvx;
        cvxCrv = contracts.cvxCrv;
        crvDepositor = contracts.crvDepositor;

        const operatorAccount = await impersonateAccount(booster.address);
        let tx = await cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await tx.wait();

        tx = await cvx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        await tx.wait();
        aliceInitialBalance = simpleToExactAmount(200);

        tx = await cvx.connect(operatorAccount.signer).transfer(bobAddress, simpleToExactAmount(100));
        await tx.wait();
    };
    async function distributeRewardsFromBooster(): Promise<BN> {
        await booster.earmarkRewards(boosterPoolId);
        await increaseTime(ONE_DAY);

        const incentive = await booster.stakerIncentive();
        const rate = await mocks.crvMinter.rate();
        const stakingCrvBalance = await mocks.crv.balanceOf(cvxStakingProxy.address);

        expect(stakingCrvBalance).to.equal(rate.mul(incentive).div(10000));

        const tx = await cvxStakingProxy.distribute();
        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === "RewardsDistributed");

        return event.args[1];
    }
    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        await setup();
    });

    it("checks all initial config", async () => {
        expect(await auraLocker.name(), "AuraLocker name").to.equal(mocks.namingConfig.vlCvxName);
        expect(await auraLocker.symbol(), "AuraLocker symbol").to.equal(mocks.namingConfig.vlCvxSymbol);
        // hardcoded on smart contract.
        expect(await auraLocker.decimals(), "AuraLocker decimals").to.equal(18);
        expect(await auraLocker.stakingToken(), "AuraLocker staking token").to.equal(cvx.address);
        expect(await auraLocker.cvxCrv(), "AuraLocker cvxCrv").to.equal(cvxCrv.address);
        expect(await auraLocker.cvxcrvStaking(), "AuraLocker cvxCrvStaking").to.equal(cvxCrvRewards.address);
        expect(await auraLocker.epochCount(), "AuraLocker epoch counts").to.equal(1);
        expect(await auraLocker.queuedCvxCrvRewards(), "AuraLocker lockDuration").to.equal(0);
        expect(await auraLocker.rewardPerToken(cvxCrv.address), "AuraLocker rewardPerToken").to.equal(0);
        expect(await auraLocker.lastTimeRewardApplicable(cvxCrv.address), "cvxCrv lastTimeRewardApplicable").to.gt(0);
        // expect(await auraLocker.rewardTokens(0),"AuraLocker lockDuration").to.equal( 86400 * 7 * 17);
        // constants
        expect(await auraLocker.newRewardRatio(), "AuraLocker newRewardRatio").to.equal(830);
        expect(await auraLocker.rewardsDuration(), "AuraLocker rewardsDuration").to.equal(86400 * 7);
        expect(await auraLocker.lockDuration(), "AuraLocker lockDuration").to.equal(86400 * 7 * 17);
    });

    context("performing basic flow", () => {
        before(async () => {
            await setup();
        });
        it("can't process locks if nothing has been locked", async () => {
            const resp = auraLocker.connect(alice).processExpiredLocks(false);
            await expect(resp).to.revertedWith("no locks");
        });

        it("lock CVX", async () => {
            const cvxAmount = simpleToExactAmount(100);
            let tx = await cvx.connect(alice).approve(auraLocker.address, cvxAmount);
            await tx.wait();
            const dataBefore = await getSnapShot(aliceAddress);
            tx = await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);

            await expect(tx).emit(auraLocker, "Staked").withArgs(aliceAddress, cvxAmount, cvxAmount);
            const dataAfter = await getSnapShot(aliceAddress);

            const lockResp = await tx.wait();
            const lockBlock = await ethers.provider.getBlock(lockResp.blockNumber);
            const lockTimestamp = ethers.BigNumber.from(lockBlock.timestamp);

            expect(dataAfter.cvxBalance, "Staked CVX").to.equal(dataBefore.cvxBalance.add(cvxAmount));
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(dataBefore.lockedSupply.add(cvxAmount));
            expect(dataAfter.account.cvxBalance, "cvx balance").to.equal(dataBefore.account.cvxBalance.sub(cvxAmount));

            expect(dataAfter.account.balances.locked, "user cvx balances locked").to.equal(
                dataBefore.account.balances.locked.add(cvxAmount),
            );
            expect(dataAfter.account.balances.nextUnlockIndex, "user balances nextUnlockIndex").to.equal(
                dataBefore.account.balances.nextUnlockIndex,
            );

            const currentEpoch = await getCurrentEpoch(lockTimestamp);
            const lock = await auraLocker.userLocks(aliceAddress, 0);
            const lockDuration = await auraLocker.lockDuration();

            const unlockTime = lockDuration.add(currentEpoch);
            expect(lock.amount, "user locked amount").to.equal(cvxAmount);
            expect(lock.unlockTime, "user unlockTime").to.equal(unlockTime);

            expect(dataAfter.account.delegatee, "user delegatee does not change").to.equal(
                dataBefore.account.delegatee,
            );
            if (dataAfter.account.delegatee !== ZERO_ADDRESS) {
                const delegateeUnlocks = await auraLocker.delegateeUnlocks(dataAfter.account.delegatee, unlockTime);
                expect(delegateeUnlocks, "user unlockTime").to.equal(cvxAmount);
            }
            // If the last epoch date is before the current epoch, the epoch index should not be updated.
            const lenA = dataAfter.epochs.length;
            const lenB = dataBefore.epochs.length;
            expect(dataAfter.epochs[lenA - 1].supply, "epoch date does not change").to.equal(
                dataBefore.epochs[lenB - 1].supply.add(cvxAmount),
            );
            expect(dataAfter.epochs[lenA - 1].date, "epoch date does not change").to.equal(
                dataBefore.epochs[lenB - 1].date,
            );
        });

        it("supports delegation", async () => {
            const dataBefore = await getSnapShot(aliceAddress);

            const tx = await auraLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(auraLocker, "DelegateChanged").withArgs(aliceAddress, ZERO_ADDRESS, bobAddress);

            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataBefore.account.delegatee).eq(ZERO_ADDRESS);
            expect(dataBefore.account.auraLockerBalance).eq(dataAfter.account.auraLockerBalance);
            expect(dataBefore.account.votes).eq(0);
            expect(dataBefore.delegatee.votes).eq(0);
            expect(dataBefore.delegatee.unlocks.length, "delegatee unlocks").eq(0);

            expect(dataAfter.account.delegatee).eq(bobAddress);
            expect(dataAfter.account.votes).eq(0);
            expect(dataAfter.delegatee.votes).eq(0);

            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
        });

        it("distribute rewards from the booster", async () => {
            await booster.earmarkRewards(boosterPoolId);
            await increaseTime(ONE_DAY);

            const incentive = await booster.stakerIncentive();
            const rate = await mocks.crvMinter.rate();
            const stakingCrvBalance = await mocks.crv.balanceOf(cvxStakingProxy.address);
            expect(stakingCrvBalance).to.equal(rate.mul(incentive).div(10000));

            const balBefore = await cvxCrv.balanceOf(auraLocker.address);
            const tx = await cvxStakingProxy.distribute();
            await tx.wait();

            const balAfter = await cvxCrv.balanceOf(auraLocker.address);
            expect(balAfter).gt(balBefore.add(stakingCrvBalance.div(3)));
        });

        it("can't process locks that haven't expired", async () => {
            const resp = auraLocker.connect(alice).processExpiredLocks(false);
            await expect(resp).to.revertedWith("no exp locks");
        });

        it("checkpoint CVX locker epoch", async () => {
            await auraLocker.checkpointEpoch();

            await increaseTime(ONE_DAY.mul(14));

            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await auraLocker.checkpointEpoch();
            await tx.wait();
            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataAfter.epochs.length, "new epochs added").to.equal(dataBefore.epochs.length + 2);

            const vlCVXBalance = await auraLocker.balanceAtEpochOf(0, aliceAddress);
            expect(vlCVXBalance, "vlCVXBalance at epoch is correct").to.equal(0);
            expect(
                await auraLocker.balanceAtEpochOf(dataAfter.epochs.length - 1, aliceAddress),
                "vlCVXBalance at epoch is correct",
            ).to.equal(simpleToExactAmount(100));
        });

        it("get rewards from CVX locker", async () => {
            await increaseTime(ONE_DAY.mul(105));
            const cvxCrvBefore = await cvxCrv.balanceOf(aliceAddress);
            const dataBefore = await getSnapShot(aliceAddress);

            expect(await auraLocker.rewardPerToken(cvxCrv.address), "rewardPerToken").to.equal(
                dataBefore.account.claimableRewards[0].amount.div(100),
            );

            const tx = await auraLocker["getReward(address)"](aliceAddress);
            const dataAfter = await getSnapShot(aliceAddress);

            await tx.wait();
            const cvxCrvAfter = await cvxCrv.balanceOf(aliceAddress);
            const cvxCrvBalance = cvxCrvAfter.sub(cvxCrvBefore);
            expect(cvxCrvBalance.gt("0")).to.equal(true);
            expect(cvxCrvBalance).to.equal(dataBefore.account.claimableRewards[0].amount);
            expect(dataAfter.account.claimableRewards[0].amount).to.equal(0);
            await expect(tx)
                .emit(auraLocker, "RewardPaid")
                .withArgs(aliceAddress, await auraLocker.rewardTokens(0), cvxCrvBalance);
        });

        it("process expired locks", async () => {
            const relock = false;
            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await auraLocker.connect(alice).processExpiredLocks(relock);
            await tx.wait();
            const dataAfter = await getSnapShot(aliceAddress);
            const balance = await cvx.balanceOf(aliceAddress);

            expect(dataAfter.account.balances.locked, "user cvx balances locked decreases").to.equal(0);
            expect(dataAfter.lockedSupply, "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance).to.equal(aliceInitialBalance);
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            await expect(tx)
                .emit(auraLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
        it("notify rewards ", async () => {
            const amount = simpleToExactAmount(100);
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), simpleToExactAmount(1000000)],
                {},
                false,
            );
            const distributor = accounts[3];
            const distributorAddress = await distributor.getAddress();

            await mockToken.connect(deployer).approve(distributorAddress, amount);
            await mockToken.connect(deployer).transfer(distributorAddress, amount);
            await mockToken.connect(distributor).approve(auraLocker.address, amount);

            await auraLocker.connect(deployer).addReward(mockToken.address, distributorAddress);
            await auraLocker.connect(deployer).approveRewardDistributor(mockToken.address, distributorAddress, true);

            const tx = await auraLocker.connect(distributor).notifyRewardAmount(mockToken.address, amount);
            await expect(tx).to.emit(auraLocker, "RewardAdded").withArgs(mockToken.address, amount);
            expect(await mockToken.balanceOf(auraLocker.address)).to.equal(amount);
        });
    });

    context("testing edge scenarios", () => {
        let dataBefore: SnapshotData;
        // t = 0.5, Lock, delegate to self, wait 15 weeks (1.5 weeks before lockup)
        beforeEach(async () => {
            await setup();
            // Given that alice locks cvx and delegates to herself
            await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await auraLocker.connect(alice).delegate(aliceAddress);

            await increaseTime(ONE_WEEK.mul(15));
            await auraLocker.checkpointEpoch();
            dataBefore = await getSnapShot(aliceAddress, "beforeEach");
        });

        it("gives a 0 balance one lock has expired", async () => {
            // it gets votes (past votes of current epoch)
            // let totalSupply  = await auraLocker.totalSupply();
            expect(await auraLocker.getVotes(aliceAddress)).eq(dataBefore.delegatee.unlocks[0]);
            await increaseTime(ONE_WEEK.mul(2));
            expect(await auraLocker.getVotes(aliceAddress)).eq(0);
        });
        // t = 15.5, Confirm lock hasn't yet expired. Then try to withdraw (fails)
        // t = 16.5, Confirm lock hasn't yet expired. Then try to withdraw without relock (fails)
        // t = 16.5, relock
        it("allows locks to be processed one week before they are expired ONLY if relocking", async () => {
            expect(dataBefore.account.locks[0].unlockTime).gt(await getTimestamp());

            await expect(auraLocker.connect(alice).processExpiredLocks(true)).to.be.revertedWith("no exp locks");
            await expect(auraLocker.connect(alice).processExpiredLocks(false)).to.be.revertedWith("no exp locks");

            await increaseTime(ONE_WEEK);

            expect((await auraLocker.userLocks(aliceAddress, 0)).unlockTime).gt(await getTimestamp());
            await expect(auraLocker.connect(alice).processExpiredLocks(false)).to.be.revertedWith("no exp locks");

            expect(await auraLocker.getVotes(aliceAddress)).eq(simpleToExactAmount(100));
            expect((await auraLocker.balances(aliceAddress)).locked).eq(simpleToExactAmount(100));
            dataBefore = await getSnapShot(aliceAddress);

            const tx = await auraLocker.connect(alice).processExpiredLocks(true);
            const dataAfter = await getSnapShot(aliceAddress);

            const timeBefore = await getTimestamp();
            await increaseTime(ONE_WEEK);
            // as it is re-lock the cvx should not change.
            expect(dataAfter.account.cvxBalance, "cvx balance does not change").eq(dataBefore.account.cvxBalance);
            expect(await auraLocker.getVotes(aliceAddress)).eq(simpleToExactAmount(100));
            expect(await auraLocker.getPastVotes(aliceAddress, timeBefore)).eq(simpleToExactAmount(100));
            expect((await auraLocker.balances(aliceAddress)).locked).eq(simpleToExactAmount(100));
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            await expect(tx)
                .emit(auraLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, true);
        });
        it("allows locks to be processed after they are expired", async () => {
            await increaseTime(ONE_WEEK);

            expect(dataBefore.account.locks[0].unlockTime).gt(await getTimestamp());
            await expect(auraLocker.connect(alice).processExpiredLocks(false)).to.be.revertedWith("no exp locks");

            await increaseTime(ONE_WEEK);

            await auraLocker.connect(alice).processExpiredLocks(false);

            expect(await auraLocker.getVotes(aliceAddress)).eq(0);
            expect((await auraLocker.balances(aliceAddress)).locked).eq(0);
            expect(await auraLocker.balanceOf(aliceAddress)).eq(0);
        });
        it("allows lock to be processed with other unexpired locks following", async () => {
            await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            // Lock 10 more cvx
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            expect(await auraLocker.totalSupply(), "totalSupply").to.eq(simpleToExactAmount(100));
            expect(
                await auraLocker.totalSupplyAtEpoch(await auraLocker.findEpochId(await getTimestamp())),
                "totalSupply",
            ).to.eq(simpleToExactAmount(100));

            await increaseTime(ONE_WEEK);
            // Lock 10 more cvx
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await increaseTime(ONE_WEEK);

            const beforeCvxBalance = await cvx.balanceOf(aliceAddress);
            await auraLocker.connect(alice).processExpiredLocks(true);
            expect(await cvx.balanceOf(aliceAddress), "relock - cvx balance does not change").eq(beforeCvxBalance);
            expect(await auraLocker.totalSupply()).eq(simpleToExactAmount(20));
            expect(
                await auraLocker.totalSupplyAtEpoch(await auraLocker.findEpochId(await getTimestamp())),
                "totalSupply",
            ).to.eq(simpleToExactAmount(20));
            // Lock 10 more cvx
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await increaseTime(ONE_WEEK);

            expect(await auraLocker.getVotes(aliceAddress)).eq(simpleToExactAmount(130));
            expect((await auraLocker.balances(aliceAddress)).locked).eq(simpleToExactAmount(130));
            expect(await auraLocker.totalSupply()).eq(simpleToExactAmount(130));
            expect(
                await auraLocker.totalSupplyAtEpoch(await auraLocker.findEpochId(await getTimestamp())),
                "totalSupply",
            ).to.eq(simpleToExactAmount(130));
        });
        it("doesn't allow processing of the same lock twice", async () => {
            await increaseTime(ONE_WEEK);

            const tx = await auraLocker.connect(alice).processExpiredLocks(true);
            await expect(tx)
                .emit(auraLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, true);

            await increaseTime(ONE_WEEK);

            await expect(auraLocker.connect(alice).processExpiredLocks(true)).to.be.revertedWith("no exp locks");
        });

        // e.g. unlockTime = 17, now = 15.5, kick > 20
        it("kicks user after sufficient time has elapsed", async () => {
            await increaseTime(ONE_WEEK.mul(4));

            // expect (17 + 3) > now
            const kickRewardEpochDelay = await auraLocker.kickRewardEpochDelay();
            expect(BN.from(dataBefore.account.locks[0].unlockTime).add(ONE_WEEK.mul(kickRewardEpochDelay))).gt(
                await getTimestamp(),
            );

            await expect(auraLocker.connect(alice).kickExpiredLocks(aliceAddress)).to.be.revertedWith("no exp locks");

            await increaseTime(ONE_WEEK);
            expect(dataBefore.lockedSupply, "Staked lockedSupply ").to.eq(simpleToExactAmount(100));

            const tx = await auraLocker.connect(alice).kickExpiredLocks(aliceAddress);
            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataAfter.account.cvxBalance, "cvx reward should be kicked").gt(dataBefore.account.cvxBalance);
            expect(dataAfter.account.cvxBalance, "cvx reward should be kicked").eq(
                dataBefore.account.cvxBalance.add(dataBefore.account.balances.locked),
            );
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.eq(0);
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            // Two events should be trigger, Withdrawn (locked amount) and KickReward (kick reward)
            // As the kicked user and lock user are the same, both amounts should be equal to the locked amount.
            await expect(tx)
                .emit(auraLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, false);
            await expect(tx)
                .emit(auraLocker, "KickReward")
                .withArgs(aliceAddress, aliceAddress, simpleToExactAmount(1));
        });

        const oneWeekInAdvance = async (): Promise<BN> => {
            const now = await getTimestamp();
            return now.add(ONE_WEEK);
        };
        const floorToWeek = t => Math.trunc(Math.trunc(t / ONE_WEEK.toNumber()) * ONE_WEEK.toNumber());

        // for example, delegate, then add a lock.. should keep the same checkpoint and update it
        it("combines multiple delegation checkpoints in the same epoch", async () => {
            // first lock
            await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            const nextEpoch = await floorToWeek(await oneWeekInAdvance());
            const checkpointCount0 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpoint0 = await auraLocker.checkpoints(aliceAddress, checkpointCount0 - 1);

            expect(checkpoint0.epochStart).eq(nextEpoch);
            expect(checkpoint0.votes).eq(simpleToExactAmount(110));

            // second lock - no need of a new checkpoint as it is  the same epoch.
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));

            const checkpointCount1 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpoint1 = await auraLocker.checkpoints(aliceAddress, checkpointCount1 - 1);

            expect(checkpointCount1).eq(checkpointCount0);
            expect(checkpoint1.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint1.votes, "votes increase").eq(simpleToExactAmount(130));

            const tx = await auraLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(auraLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(bobAddress);

            const checkpointCount2 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount2 = await auraLocker.numCheckpoints(bobAddress);
            const checkpoint2 = await auraLocker.checkpoints(aliceAddress, checkpointCount2 - 1);
            const checkpointDel2 = await auraLocker.checkpoints(bobAddress, checkpointBobCount2 - 1);

            expect(checkpointCount2, "number of alice checkpoints").eq(checkpointCount0);
            expect(checkpoint2.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint2.votes, "alice votes decrease").eq(0);
            expect(checkpointDel2.votes, "delegatee votes increase").eq(checkpoint1.votes);
        });
        it("allows for delegate checkpointing and balance lookup after 16 weeks have elapsed", async () => {
            // first lock
            const cvxAmount = simpleToExactAmount(10);
            const initialData = { ...dataBefore };

            await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            let tx = await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);
            let dataAfter = await getSnapShot(aliceAddress, "after lock week 1");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.auraLockerBalance, "user aura locker balanceOf").to.equal(
                simpleToExactAmount(100),
            );
            dataBefore = { ...dataAfter };
            // t = 15.5 -> 16.5
            await increaseTime(ONE_WEEK);
            tx = await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);
            dataAfter = await getSnapShot(aliceAddress, "after lock week 2");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.auraLockerBalance, "user aura locker balanceOf").to.equal(
                simpleToExactAmount(110),
            );
            dataBefore = { ...dataAfter };

            // t = 16.5 -> 17.5
            await increaseTime(ONE_WEEK);
            await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);
            dataAfter = await getSnapShot(aliceAddress, "after lock week 3");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.auraLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(20));
            dataBefore = { ...dataAfter };
            // 16 weeks
            // t = 17.5 -> 31.5
            await increaseTime(ONE_WEEK.mul(14));
            await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);
            dataAfter = await getSnapShot(aliceAddress, " after lock week 17");
            await verifyLock(tx, cvxAmount, dataBefore, dataAfter);
            expect(dataAfter.account.auraLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(30));
            dataBefore = { ...dataAfter };

            const pastVotesAlice0 = await auraLocker.getVotes(aliceAddress);
            const pastVotesBob0 = await auraLocker.getVotes(bobAddress);

            expect(pastVotesAlice0, "account votes").to.equal(simpleToExactAmount(30));
            expect(pastVotesBob0, "delegatee votes").to.equal(0);

            tx = await auraLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(auraLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(bobAddress);
            dataAfter = await getSnapShot(aliceAddress, "after delegate");
            dataBefore = { ...dataAfter };

            expect(dataAfter.account.delegatee, "new delegatee").to.equal(bobAddress);
            // Balances check after locking and delegation
            expect(dataAfter.account.auraLockerBalance, "user aura locker balanceOf").to.equal(simpleToExactAmount(30));
            expect(dataAfter.cvxBalance, "Staked CVX").to.equal(initialData.cvxBalance.add(simpleToExactAmount(40)));
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(
                initialData.lockedSupply.add(simpleToExactAmount(40)),
            );
            expect(dataAfter.account.cvxBalance, "cvx balance").to.equal(
                initialData.account.cvxBalance.sub(simpleToExactAmount(40)),
            );
            expect(dataAfter.account.balances.locked, "user cvx balances locked").to.equal(
                initialData.account.balances.locked.add(simpleToExactAmount(40)),
            );

            const pastVotesAlice1 = await auraLocker.getVotes(aliceAddress);
            const pastVotesBob1 = await auraLocker.getVotes(bobAddress);

            expect(pastVotesAlice1, "account votes").to.equal(pastVotesAlice0);
            expect(pastVotesBob1, "delegatee votes").to.equal(pastVotesBob0);

            // Verify it move past locks, as checkpoint is after next epoch, the `getPastVotes` does return the votes delegated.
            // t = 31.5 -> 32.5
            await increaseTime(ONE_WEEK);
            //
            const pastVotesAlice2 = await auraLocker.getVotes(aliceAddress);
            const pastVotesBob2 = await auraLocker.getVotes(bobAddress);
            expect(pastVotesAlice2, "account votes updated").to.equal(0);
            expect(pastVotesBob2, "delegatee votes updated").to.equal(simpleToExactAmount(30));

            expect(
                await auraLocker.getPastTotalSupply((await getTimestamp()).sub(ONE_DAY)),
                "past total supply",
            ).to.equal(simpleToExactAmount(30));
        });
        it("should allow re-delegating in the same period", async () => {
            const charlie = accounts[3];
            const charlieAddress = await charlie.getAddress();
            // first lock
            await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            const nextEpoch = await floorToWeek(await oneWeekInAdvance());
            const checkpointCount0 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpoint0 = await auraLocker.checkpoints(aliceAddress, checkpointCount0 - 1);

            expect(checkpoint0.epochStart).eq(nextEpoch);
            expect(checkpoint0.votes).eq(simpleToExactAmount(110));

            // second lock - no need of a new checkpoint as it is  the same epoch.
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));

            const checkpointCount1 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpoint1 = await auraLocker.checkpoints(aliceAddress, checkpointCount1 - 1);

            expect(checkpointCount1).eq(checkpointCount0);
            expect(checkpoint1.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint1.votes, "votes increase").eq(simpleToExactAmount(130));

            // First delegation
            let tx = await auraLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(auraLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(bobAddress);

            const checkpointCount2 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount2 = await auraLocker.numCheckpoints(bobAddress);
            const checkpoint2 = await auraLocker.checkpoints(aliceAddress, checkpointCount2 - 1);
            const checkpointBob2 = await auraLocker.checkpoints(bobAddress, checkpointBobCount2 - 1);

            expect(checkpointCount2, "number of alice checkpoints").eq(checkpointCount0);
            expect(checkpoint2.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint2.votes, "alice votes decrease").eq(0);
            expect(checkpointBob2.votes, "delegatee votes increase").eq(checkpoint1.votes);

            // Second delegation
            tx = await auraLocker.connect(alice).delegate(charlieAddress);
            await expect(tx).emit(auraLocker, "DelegateChanged").withArgs(aliceAddress, bobAddress, charlieAddress);
            // old delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(bobAddress);
            // new delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(charlieAddress);

            const checkpointCount3 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount3 = await auraLocker.numCheckpoints(bobAddress);
            const checkpointRobCount3 = await auraLocker.numCheckpoints(charlieAddress);

            const checkpoint3 = await auraLocker.checkpoints(aliceAddress, checkpointCount3 - 1);
            const checkpointBob3 = await auraLocker.checkpoints(bobAddress, checkpointBobCount3 - 1);
            const checkpointRob3 = await auraLocker.checkpoints(charlieAddress, checkpointRobCount3 - 1);

            expect(checkpointCount3, "number of alice checkpoints").eq(checkpointCount0);
            expect(checkpoint3.epochStart, "epoch is the same").eq(nextEpoch);
            expect(checkpoint3.votes, "alice votes decrease").eq(0);
            expect(checkpointBob3.votes, "old delegatee votes decrease").eq(0);
            expect(checkpointRob3.votes, "new delegatee votes increase").eq(checkpoint1.votes);

            //    Verify information matches with `lockedBalances`
            const aliceLockedBalances = await auraLocker.lockedBalances(aliceAddress);
            expect(aliceLockedBalances.total, "alice total balance").eq(simpleToExactAmount(130));
            expect(aliceLockedBalances.unlockable, "alice total balance").eq(0);
            expect(aliceLockedBalances.locked, "alice total balance").eq(simpleToExactAmount(130));
        });
        it("allows delegation even with 0 balance", async () => {
            // await getSnapShot(bobAddress, "beforeEach");
            expect(await auraLocker.getVotes(aliceAddress)).eq(dataBefore.delegatee.unlocks[0]);
            await increaseTime(ONE_WEEK.mul(2));
            expect(await auraLocker.getVotes(aliceAddress), "expect 0 balance").eq(0);
            const tx = await auraLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(auraLocker, "DelegateChanged").withArgs(aliceAddress, aliceAddress, bobAddress);
            // old delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(aliceAddress);
            // new delegatee
            await expect(tx).emit(auraLocker, "DelegateCheckpointed").withArgs(bobAddress);

            const checkpointCount2 = await auraLocker.numCheckpoints(aliceAddress);
            const checkpointBobCount2 = await auraLocker.numCheckpoints(bobAddress);
            const checkpoint2 = await auraLocker.checkpoints(aliceAddress, checkpointCount2 - 1);
            const checkpointBob2 = await auraLocker.checkpoints(bobAddress, checkpointBobCount2 - 1);
            expect(checkpoint2.votes, "alice votes").eq(0);
            expect(checkpointBob2.votes, "delegatee votes").eq(0);
        });
        it("retrieves balance at a given epoch", async () => {
            expect(await auraLocker.balanceAtEpochOf(0, aliceAddress), "account balance at epoch 0").to.equal(0);
            expect(await auraLocker.totalSupplyAtEpoch(0), "account balance at epoch 0").to.equal(0);
            expect(await auraLocker.balanceAtEpochOf(0, bobAddress), "account balance is zero").to.equal(0);
        });
    });

    context("queueing new rewards", () => {
        async function mockDepositCVRToStakeContract(amount: number) {
            const crvDepositorAccount = await impersonateAccount(crvDepositor.address);
            const cvxCrvConnected = await cvxCrv.connect(crvDepositorAccount.signer);
            await cvxCrvConnected.mint(cvxStakingProxyAccount.address, simpleToExactAmount(amount));
            await cvxCrvConnected.approve(cvxStakingProxyAccount.address, simpleToExactAmount(amount));
        }
        // let dataBefore: SnapshotData;
        let cvxStakingProxyAccount: Account;
        // t = 0.5, Lock, delegate to self, wait 15 weeks (1.5 weeks before lockup)
        beforeEach(async () => {
            await setup();
            cvxStakingProxyAccount = await impersonateAccount(cvxStakingProxy.address);
            // Given that cvxStakingProxyAccount holds cvxCrv (fake balance on staking proxy)
            await mockDepositCVRToStakeContract(1000);

            await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(1000));
        });
        it("fails if the sender is not rewardsDistributor", async () => {
            // Only the rewardsDistributor can queue cvxCRV rewards
            await expect(auraLocker.queueNewRewards(simpleToExactAmount(100))).revertedWith("!authorized");
        });
        it("fails if the amount of rewards is 0", async () => {
            // Only the rewardsDistributor can queue cvxCRV rewards
            await expect(
                auraLocker.connect(cvxStakingProxyAccount.signer).queueNewRewards(simpleToExactAmount(0)),
            ).revertedWith("No reward");
        });
        it("distribute rewards from the booster", async () => {
            await distributeRewardsFromBooster();
        });
        it("queues rewards when cvxCrv period is finished", async () => {
            // AuraStakingProxy.distribute(), faked by impersonating account
            let rewards = simpleToExactAmount(100);
            const rewardDistribution = await auraLocker.rewardsDuration();
            const cvxCrvLockerBalance0 = await cvxCrv.balanceOf(auraLocker.address);
            const queuedCvxCrvRewards0 = await auraLocker.queuedCvxCrvRewards();
            const rewardData0 = await auraLocker.rewardData(cvxCrv.address);
            const timeStamp = await getTimestamp();

            expect(timeStamp, "reward period finish").to.gte(rewardData0.periodFinish);
            expect(await cvxCrv.balanceOf(cvxStakingProxyAccount.address)).to.gt(rewards);

            //  test queuing rewards
            // await auraLocker.connect(cvxStakingProxyAccount.signer).queueNewRewards(rewards);
            rewards = await distributeRewardsFromBooster();
            // Validate
            const rewardData1 = await auraLocker.rewardData(cvxCrv.address);
            expect(await cvxCrv.balanceOf(auraLocker.address), "cvxCrv is transfer to locker").to.eq(
                cvxCrvLockerBalance0.add(rewards),
            );
            expect(await auraLocker.queuedCvxCrvRewards(), "queued cvxCrv rewards").to.eq(0);

            // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
            expect(rewardData1.lastUpdateTime, "cvxCrv reward last update time").to.gt(rewardData0.lastUpdateTime);
            expect(rewardData1.periodFinish, "cvxCrv reward period finish").to.gt(rewardData0.periodFinish);
            expect(rewardData1.rewardPerTokenStored, "cvxCrv reward per token stored").to.eq(
                rewardData0.rewardPerTokenStored,
            );
            expect(rewardData1.rewardRate, "cvxCrv rewards rate").to.eq(
                queuedCvxCrvRewards0.add(rewards).div(rewardDistribution),
            );
        });

        it("only starts distributing the rewards when the queued amount is over 83% of the remaining", async () => {
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            const cvxCrvLockerBalance0 = await cvxCrv.balanceOf(auraLocker.address);
            const rewardData0 = await auraLocker.rewardData(cvxCrv.address);
            const timeStamp = await getTimestamp();

            expect(timeStamp, "reward period finish").to.gte(rewardData0.periodFinish);
            expect(await cvxCrv.balanceOf(cvxStakingProxyAccount.address)).to.gt(0);

            // cvxStakingProxy.distribute();=>auraLocker.queueNewRewards()
            // First distribution to update the reward finish period.
            let rewards = await distributeRewardsFromBooster();
            // Validate
            const cvxCrvLockerBalance1 = await cvxCrv.balanceOf(auraLocker.address);
            const queuedCvxCrvRewards1 = await auraLocker.queuedCvxCrvRewards();
            const rewardData1 = await auraLocker.rewardData(cvxCrv.address);

            // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
            expect(rewardData1.lastUpdateTime, "cvxCrv reward last update time").to.gt(rewardData0.lastUpdateTime);
            expect(rewardData1.periodFinish, "cvxCrv reward period finish").to.gt(rewardData0.periodFinish);
            expect(rewardData1.rewardPerTokenStored, "cvxCrv reward per token stored").to.eq(
                rewardData0.rewardPerTokenStored,
            );
            expect(rewardData1.rewardRate, "cvxCrv rewards rate").to.gt(rewardData0.rewardRate);
            expect(cvxCrvLockerBalance1, "cvxCrv is transfer to locker").to.eq(cvxCrvLockerBalance0.add(rewards));
            expect(queuedCvxCrvRewards1, "queued cvxCrv rewards").to.eq(0);

            // Second distribution , without notification as the ratio is not reached.
            await increaseTime(ONE_DAY);
            rewards = await distributeRewardsFromBooster();

            const cvxCrvLockerBalance2 = await cvxCrv.balanceOf(auraLocker.address);
            const queuedCvxCrvRewards2 = await auraLocker.queuedCvxCrvRewards();
            const rewardData2 = await auraLocker.rewardData(cvxCrv.address);

            // Verify reward data is not updated, as ratio is not reached.
            expect(rewardData2.lastUpdateTime, "cvxCrv reward last update time").to.eq(rewardData1.lastUpdateTime);
            expect(rewardData2.periodFinish, "cvxCrv reward period finish").to.eq(rewardData1.periodFinish);
            expect(rewardData2.rewardPerTokenStored, "cvxCrv reward per token stored").to.eq(
                rewardData1.rewardPerTokenStored,
            );
            expect(rewardData2.rewardRate, "cvxCrv rewards rate").to.eq(rewardData1.rewardRate);
            expect(cvxCrvLockerBalance2, "cvxCrv is transfer to locker").to.eq(cvxCrvLockerBalance1.add(rewards));
            expect(queuedCvxCrvRewards2, "queued cvxCrv rewards").to.eq(queuedCvxCrvRewards1.add(rewards));

            // Third distribution the ratio is reached, the reward is distributed.
            await mockDepositCVRToStakeContract(1000);
            rewards = await distributeRewardsFromBooster();

            const cvxCrvLockerBalance3 = await cvxCrv.balanceOf(auraLocker.address);
            const queuedCvxCrvRewards3 = await auraLocker.queuedCvxCrvRewards();
            const rewardData3 = await auraLocker.rewardData(cvxCrv.address);

            // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
            expect(rewardData3.lastUpdateTime, "cvxCrv reward last update time").to.gt(rewardData2.lastUpdateTime);
            expect(rewardData3.periodFinish, "cvxCrv reward period finish").to.gt(rewardData2.periodFinish);
            expect(rewardData3.rewardPerTokenStored, "cvxCrv reward per token stored").to.gt(
                rewardData2.rewardPerTokenStored,
            );
            expect(rewardData3.rewardRate, "cvxCrv rewards rate").to.gt(rewardData2.rewardRate);
            expect(cvxCrvLockerBalance3, "cvxCrv is transfer to locker").to.eq(cvxCrvLockerBalance2.add(rewards));
            expect(queuedCvxCrvRewards3, "queued cvxCrv rewards").to.eq(0);

            // Process expired locks and claim rewards for user.
            await increaseTime(ONE_WEEK.mul(17));

            await auraLocker.connect(alice).processExpiredLocks(false);
            const userCvxCrvData = await auraLocker.userData(aliceAddress, cvxCrv.address);
            const cvxCrvAliceBalance3 = await cvxCrv.balanceOf(aliceAddress);

            const tx = await auraLocker["getReward(address)"](aliceAddress);
            await expect(tx)
                .to.emit(auraLocker, "RewardPaid")
                .withArgs(aliceAddress, cvxCrv.address, userCvxCrvData.rewards);
            const cvxCrvAliceBalance4 = await cvxCrv.balanceOf(aliceAddress);
            const cvxCrvLockerBalance4 = await cvxCrv.balanceOf(auraLocker.address);
            expect(cvxCrvAliceBalance4, "cvxCrv claimed").to.eq(cvxCrvAliceBalance3.add(userCvxCrvData.rewards));
            expect(cvxCrvLockerBalance4, "cvxCrv sent").to.eq(cvxCrvLockerBalance3.sub(userCvxCrvData.rewards));
        });
    });

    const checkBalances = async (
        user: string,
        epochId: number,
        expectedBalance: BN | number,
        expectedSupply: BN | number,
        prevEpochBal?: BN | number,
        prevEpochSupply?: BN | number,
    ) => {
        const balCur = await auraLocker.balanceOf(user);
        expect(balCur).eq(expectedBalance);
        const balAtEpoch = await auraLocker.balanceAtEpochOf(epochId, user);
        expect(balAtEpoch).eq(expectedBalance);
        if (prevEpochBal) {
            const balAtPrevEpoch = await auraLocker.balanceAtEpochOf(epochId - 1, user);
            expect(balAtPrevEpoch).eq(prevEpochBal);
        }
        const supplyCur = await auraLocker.totalSupply();
        expect(supplyCur).eq(expectedSupply);
        const supplAtEpoch = await auraLocker.totalSupplyAtEpoch(epochId);
        expect(supplAtEpoch).eq(expectedSupply);
        if (prevEpochSupply) {
            const supplAtPrevEpoch = await auraLocker.totalSupplyAtEpoch(epochId - 1);
            expect(supplAtPrevEpoch).eq(prevEpochSupply);
        }
    };

    const checkBalanceAtEpoch = async (
        user: string,
        epochId: number,
        expectedBalance: BN | number,
        expectedSupply: BN | number,
    ) => {
        const balAtEpoch = await auraLocker.balanceAtEpochOf(epochId, user);
        expect(balAtEpoch).eq(expectedBalance);
        const supplAtEpoch = await auraLocker.totalSupplyAtEpoch(epochId);
        expect(supplAtEpoch).eq(expectedSupply);
    };

    context("checking delegation timelines", () => {
        let delegate0, delegate1, delegate2;

        /*                                **
         *  0   1   2   3   8   9 ... 16  17  18 <-- Weeks
         * alice    alice    bob                 <-- Locking
         *    ^
         * +alice ^           ^                  <-- delegate 0
         *      +alice      +bob        ^        <-- delegate 1
         *                            +alice     <-- delegate 2
         *
         * delegate0 has balance of 100 in 1
         * delegate1 has balance of 100 from 2, 200 from 3-8, 300 from 9-16 & 100 from 17
         * delegate2 has balance of 100 from 17
         */
        before(async () => {
            await setup();
            delegate0 = await accounts[2].getAddress();
            delegate1 = await accounts[3].getAddress();
            delegate2 = await accounts[4].getAddress();

            // Mint some cvxCRV and add as the reward token manually
            let tx = await booster.earmarkRewards(boosterPoolId);
            await tx.wait();

            tx = await cvxStakingProxy.distribute();
            await tx.wait();

            tx = await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            await tx.wait();
            tx = await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await tx.wait();

            const lock = await auraLocker.userLocks(aliceAddress, 0);
            expect(lock.amount).to.equal(simpleToExactAmount(100));
        });
        it("has no delegation at the start", async () => {
            const delegate = await auraLocker.delegates(aliceAddress);
            expect(delegate).eq(ZERO_ADDRESS);

            expect((await auraLocker.rewardData(cvxCrv.address)).rewardRate).gt(0);
        });
        it("fails to delegate to 0", async () => {
            await expect(auraLocker.connect(alice).delegate(ZERO_ADDRESS)).to.be.revertedWith(
                "Must delegate to someone",
            );
        });
        it("fails when bob tries to delegate with no locks", async () => {
            await expect(auraLocker.connect(bob).delegate(delegate0)).to.be.revertedWith("Nothing to delegate");
        });
        // t = 0.5 -> 1.5
        it("delegates to 0", async () => {
            await checkBalances(aliceAddress, 0, 0, 0);

            const tx = await auraLocker.connect(alice).delegate(delegate0);
            await tx.wait();

            const aliceBal = (await auraLocker.balances(aliceAddress)).locked;
            const aliceVotes = await auraLocker.getVotes(aliceAddress);
            const delegatee = await auraLocker.delegates(aliceAddress);
            let delegateVotes = await auraLocker.getVotes(delegate0);
            expect(aliceBal).eq(simpleToExactAmount(100));
            expect(aliceVotes).eq(0);
            expect(delegatee).eq(delegate0);
            expect(delegateVotes).eq(0);

            await increaseTime(ONE_WEEK);

            await checkBalances(aliceAddress, 1, simpleToExactAmount(100), simpleToExactAmount(100), 0, 0);
            delegateVotes = await auraLocker.getVotes(delegate0);
            expect(delegateVotes).eq(simpleToExactAmount(100));
        });
        it("fails to delegate back to 0", async () => {
            await expect(auraLocker.connect(alice).delegate(ZERO_ADDRESS)).to.be.revertedWith(
                "Must delegate to someone",
            );
        });
        it("fails to delegate back to the same delegate", async () => {
            await expect(auraLocker.connect(alice).delegate(delegate0)).to.be.revertedWith("Must choose new delegatee");
        });
        // t = 1.5 -> 2.5
        it("changes delegation to delegate1", async () => {
            const tx = await auraLocker.connect(alice).delegate(delegate1);
            await tx.wait();

            const delegatee = await auraLocker.delegates(aliceAddress);
            let delegate0Votes = await auraLocker.getVotes(delegate0);
            let delegate1Votes = await auraLocker.getVotes(delegate1);
            expect(delegatee).eq(delegate1);
            expect(delegate0Votes).eq(simpleToExactAmount(100));
            expect(delegate1Votes).eq(0);

            const week1point5 = await getTimestamp();

            await increaseTime(ONE_WEEK);

            const week2point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                2,
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
            );

            delegate0Votes = await auraLocker.getVotes(delegate0);
            const delegate0Historic = await auraLocker.getPastVotes(delegate0, week1point5);
            const delegate0Now = await auraLocker.getPastVotes(delegate0, week2point5);
            delegate1Votes = await auraLocker.getVotes(delegate1);
            const delegate1Historic = await auraLocker.getPastVotes(delegate1, week1point5);
            const delegate1Now = await auraLocker.getPastVotes(delegate1, week2point5);

            expect(delegate0Votes).eq(0);
            expect(delegate0Historic).eq(simpleToExactAmount(100));
            expect(delegate0Now).eq(0);
            expect(delegate1Votes).eq(simpleToExactAmount(100));
            expect(delegate1Historic).eq(0);
            expect(delegate1Now).eq(simpleToExactAmount(100));
        });

        // t = 2.5 -> 8.5
        it("deposits more for alice", async () => {
            let tx = await cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(100));
            await tx.wait();
            tx = await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
            await tx.wait();

            await checkBalances(
                aliceAddress,
                2,
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
            );

            const week2point5 = await getTimestamp();

            await increaseTime(ONE_WEEK);

            const week3point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                3,
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(100),
                simpleToExactAmount(100),
            );

            const delegate1Historic = await auraLocker.getPastVotes(delegate1, week2point5);
            const delegate1Now = await auraLocker.getPastVotes(delegate1, week3point5);

            expect(delegate1Historic).eq(simpleToExactAmount(100));
            expect(delegate1Now).eq(simpleToExactAmount(200));

            await increaseTime(ONE_WEEK.mul(5));

            await checkBalances(
                aliceAddress,
                8,
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(200),
            );
        });
        // t = 8.5 -> 16.5
        it("deposits for bob and delegates", async () => {
            let tx = await cvx.connect(bob).approve(auraLocker.address, simpleToExactAmount(100));
            await tx.wait();
            tx = await auraLocker.connect(bob).lock(bobAddress, simpleToExactAmount(100));
            await tx.wait();
            tx = await auraLocker.connect(bob).delegate(delegate1);
            await tx.wait();

            const week8point5 = await getTimestamp();

            await increaseTime(ONE_WEEK);

            const week9point5 = await getTimestamp();

            const delegate1Historic = await auraLocker.getPastVotes(delegate1, week8point5);
            const delegate1Now = await auraLocker.getPastVotes(delegate1, week9point5);

            expect(delegate1Historic).eq(simpleToExactAmount(200));
            expect(delegate1Now).eq(simpleToExactAmount(300));

            await increaseTime(ONE_WEEK.mul(7));
        });

        // t = 16.5 -> 17.5
        it("delegates alice to 2 and omits upcoming release", async () => {
            const tx = await auraLocker.connect(alice).delegate(delegate2);
            await tx.wait();

            const week16point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                16,
                simpleToExactAmount(200),
                simpleToExactAmount(300),
                simpleToExactAmount(200),
                simpleToExactAmount(300),
            );

            await increaseTime(ONE_WEEK);

            const week17point5 = await getTimestamp();

            await checkBalances(
                aliceAddress,
                17,
                simpleToExactAmount(100),
                simpleToExactAmount(200),
                simpleToExactAmount(200),
                simpleToExactAmount(300),
            );
            await checkBalanceAtEpoch(aliceAddress, 0, simpleToExactAmount(0), simpleToExactAmount(0));
            await checkBalanceAtEpoch(aliceAddress, 1, simpleToExactAmount(100), simpleToExactAmount(100));
            await checkBalanceAtEpoch(aliceAddress, 2, simpleToExactAmount(100), simpleToExactAmount(100));
            await checkBalanceAtEpoch(aliceAddress, 3, simpleToExactAmount(200), simpleToExactAmount(200));

            const delegate1Historic = await auraLocker.getPastVotes(delegate1, week16point5);
            const delegate1Now = await auraLocker.getPastVotes(delegate1, week17point5);
            const delegate2Historic = await auraLocker.getPastVotes(delegate2, week16point5);
            const delegate2Now = await auraLocker.getPastVotes(delegate2, week17point5);

            expect(delegate1Historic).eq(simpleToExactAmount(300));
            expect(delegate1Now).eq(simpleToExactAmount(100));

            expect(delegate2Historic).eq(simpleToExactAmount(0));
            expect(delegate2Now).eq(simpleToExactAmount(100));
        });
    });

    context("fails if", () => {
        before(async () => {
            await setup();
        });
        it("@notifyRewardAmount adds cvxCrv", async () => {
            await expect(auraLocker.notifyRewardAmount(cvxCrv.address, 0)).revertedWith("Use queueNewRewards");
        });
        it("notifyRewardAmount sender is not a distributor", async () => {
            await expect(auraLocker.notifyRewardAmount(cvx.address, 0)).revertedWith("Must be rewardsDistributor");
        });
        it("@notifyRewardAmount sends wrong amount", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );
            const distributor = accounts[3];
            await auraLocker.connect(deployer).addReward(mockToken.address, await distributor.getAddress());
            await auraLocker
                .connect(deployer)
                .approveRewardDistributor(mockToken.address, await distributor.getAddress(), true);
            await expect(auraLocker.connect(distributor).notifyRewardAmount(mockToken.address, 0)).revertedWith(
                "No reward",
            );
        });
        it("@lock wrong amount of CVX", async () => {
            const cvxAmount = 0;
            await expect(auraLocker.connect(alice).lock(aliceAddress, cvxAmount)).revertedWith("Cannot stake 0");
        });
        it("get past supply before any lock.", async () => {
            await expect(auraLocker.connect(alice).getPastTotalSupply(await getTimestamp())).revertedWith(
                "ERC20Votes: block not yet mined",
            );
        });
        it("approves reward wrong arguments", async () => {
            const tx = auraLocker.approveRewardDistributor(ZERO_ADDRESS, ZERO_ADDRESS, false);
            await expect(tx).revertedWith("Reward does not exist");
        });
        it("non admin - shutdowns", async () => {
            await expect(auraLocker.connect(alice).shutdown()).revertedWith("Ownable: caller is not the owner");
        });
        it("non admin - add Reward", async () => {
            await expect(auraLocker.connect(alice).addReward(ZERO_ADDRESS, ZERO_ADDRESS)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("non admin - set Kick Incentive", async () => {
            await expect(auraLocker.connect(alice).setKickIncentive(ZERO, ZERO)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("non admin - approves reward distributor", async () => {
            await expect(
                auraLocker.connect(alice).approveRewardDistributor(ZERO_ADDRESS, ZERO_ADDRESS, false),
            ).revertedWith("Ownable: caller is not the owner");
        });
        it("non admin - recover ERC20", async () => {
            await expect(auraLocker.connect(alice).recoverERC20(ZERO_ADDRESS, ZERO)).revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("set Kick Incentive with wrong rate", async () => {
            await expect(auraLocker.setKickIncentive(501, ZERO)).revertedWith("over max rate");
        });
        it("set Kick Incentive with wrong delay", async () => {
            await expect(auraLocker.setKickIncentive(100, 1)).revertedWith("min delay");
        });
        it("recover ERC20 with wrong token address", async () => {
            await expect(auraLocker.recoverERC20(cvx.address, ZERO)).revertedWith("Cannot withdraw staking token");
        });
        it("recover ERC20 cannot withdraw reward", async () => {
            await auraLocker.addReward(cvxCrvRewards.address, cvxCrvRewards.address);
            expect((await auraLocker.rewardData(cvxCrvRewards.address)).lastUpdateTime).to.not.eq(0);
            await expect(auraLocker.recoverERC20(cvxCrvRewards.address, ZERO)).revertedWith(
                "Cannot withdraw reward token",
            );
        });
        it("emergency withdraw is call and it is not shutdown", async () => {
            await expect(auraLocker.emergencyWithdraw()).revertedWith("Must be shutdown");
        });
    });
    context("admin", () => {
        before(async () => {
            await setup();
        });
        it("approves reward distributor", async () => {
            const cvxAmount = simpleToExactAmount(100);
            await cvx.connect(alice).approve(auraLocker.address, cvxAmount);

            // approves  distributor
            await auraLocker.approveRewardDistributor(cvxCrv.address, cvxCrvRewards.address, true);
            await expect(await auraLocker.rewardDistributors(cvxCrv.address, cvxCrvRewards.address)).to.eq(true);

            // disapproves  distributor
            await auraLocker.approveRewardDistributor(cvxCrv.address, cvxCrvRewards.address, false);
            await expect(await auraLocker.rewardDistributors(cvxCrv.address, cvxCrvRewards.address)).to.eq(false);
        });
        it("set Kick Incentive", async () => {
            await expect(auraLocker.setKickIncentive(100, 3)).emit(auraLocker, "KickIncentiveSet").withArgs(100, 3);
            expect(await auraLocker.kickRewardPerEpoch()).to.eq(100);
            expect(await auraLocker.kickRewardEpochDelay()).to.eq(3);
        });
        it("recover ERC20", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );

            await mockToken.connect(deployer).approve(auraLocker.address, simpleToExactAmount(100));
            await mockToken.connect(deployer).transfer(auraLocker.address, simpleToExactAmount(10));

            const mockDeployerBalanceBefore = await mockToken.balanceOf(await deployer.getAddress());
            const mockLockerBalanceBefore = await mockToken.balanceOf(auraLocker.address);
            expect(mockLockerBalanceBefore, "locker external lp reward").to.eq(simpleToExactAmount(10));
            const tx = auraLocker.recoverERC20(mockToken.address, simpleToExactAmount(10));
            await expect(tx).emit(auraLocker, "Recovered").withArgs(mockToken.address, simpleToExactAmount(10));

            const mockDeployerBalanceAfter = await mockToken.balanceOf(await deployer.getAddress());
            const mockLockerBalanceAfter = await mockToken.balanceOf(auraLocker.address);

            expect(mockLockerBalanceAfter, "locker external lp reward").to.eq(0);
            expect(mockDeployerBalanceAfter, "owner external lp reward").to.eq(
                mockDeployerBalanceBefore.add(simpleToExactAmount(10)),
            );
        });
    });
    context("is shutdown", () => {
        beforeEach(async () => {
            await setup();
        });
        it("fails if lock", async () => {
            // Given that the aura locker is shutdown
            await auraLocker.connect(deployer).shutdown();
            expect(await auraLocker.isShutdown()).to.eq(true);
            // Then it should fail to lock
            const cvxAmount = simpleToExactAmount(100);
            await cvx.connect(alice).approve(auraLocker.address, cvxAmount);
            const tx = auraLocker.connect(alice).lock(aliceAddress, cvxAmount);
            await expect(tx).revertedWith("shutdown");
        });
        it("process un-expired locks", async () => {
            const cvxAmount = simpleToExactAmount(100);
            const relock = false;
            await cvx.connect(alice).approve(auraLocker.address, cvxAmount);
            let tx = await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);

            await expect(auraLocker.connect(alice).processExpiredLocks(relock)).revertedWith("no exp locks");

            // Given that the aura locker is shutdown
            await auraLocker.connect(deployer).shutdown();
            expect(await auraLocker.isShutdown()).to.eq(true);
            // Then it should be able to process unexpired locks

            const dataBefore = await getSnapShot(aliceAddress);
            tx = await auraLocker.connect(alice).processExpiredLocks(relock);

            const balance = await cvx.balanceOf(aliceAddress);
            expect(await auraLocker.balanceOf(aliceAddress), "auraLocker balance for user is zero").to.equal(0);
            expect(await auraLocker.lockedSupply(), "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance).to.equal(aliceInitialBalance);
            await expect(tx)
                .emit(auraLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
        it("emergencyWithdraw  when user has no locks", async () => {
            // Given that the aura locker is shutdown
            await auraLocker.connect(deployer).shutdown();
            expect(await auraLocker.isShutdown()).to.eq(true);
            // It fails if the user has no locks
            await expect(auraLocker.connect(alice).emergencyWithdraw()).revertedWith("Nothing locked");
        });
        it("emergencyWithdraw  when user has locks", async () => {
            const cvxAmount = simpleToExactAmount(100);
            const relock = false;
            await cvx.connect(alice).approve(auraLocker.address, cvxAmount);
            let tx = await auraLocker.connect(alice).lock(aliceAddress, cvxAmount);
            // Given that the aura locker is shutdown
            await auraLocker.connect(deployer).shutdown();
            expect(await auraLocker.isShutdown()).to.eq(true);
            // Then it should be able to withdraw in an emergency
            const dataBefore = await getSnapShot(aliceAddress);
            tx = await auraLocker.connect(alice).emergencyWithdraw();
            expect(await auraLocker.balanceOf(aliceAddress)).eq(0);
            const balance = await cvx.balanceOf(aliceAddress);

            expect(await auraLocker.lockedSupply(), "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance, "balance").to.equal(aliceInitialBalance);
            await expect(tx)
                .emit(auraLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
    });
});
