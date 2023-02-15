import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4, SystemDeployed } from "../scripts/deploySystem";
import { deployMocks, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { AuraLocker, MockERC20, MockERC20__factory, ExtraRewardsDistributor } from "../types/generated";
import { impersonateAccount } from "../test-utils/fork";
import { ONE_WEEK } from "../test-utils/constants";
import { increaseTime, getTimestamp } from "../test-utils/time";
import { simpleToExactAmount, BN } from "../test-utils/math";
import { Account } from "types";

describe("ExtraRewardsDistributor", () => {
    let accounts: Signer[];
    let operatorAccount: Account;

    let distributor: ExtraRewardsDistributor;
    let contracts: SystemDeployed;
    let mockErc20: MockERC20;
    let mockErc20X: MockERC20;
    let auraLocker: AuraLocker;

    let deployer: Signer;
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

        distributor = contracts.extraRewardsDistributor.connect(alice);
        auraLocker = contracts.cvxLocker.connect(alice);

        operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await contracts.cvx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        await contracts.cvx.connect(alice).approve(auraLocker.address, simpleToExactAmount(200));
        await auraLocker.lock(aliceAddress, simpleToExactAmount(1));

        mockErc20 = await new MockERC20__factory(alice).deploy("MockERC20", "mk20", 18, aliceAddress, 1000);
        await mockErc20.connect(alice).transfer(bobAddress, simpleToExactAmount(200));
        mockErc20X = await new MockERC20__factory(alice).deploy("MockERC20 X", "MKTX", 18, aliceAddress, 1000);
    });

    async function verifyAddRewards(sender: Signer, fundAmount: BN, epoch: number) {
        await mockErc20.connect(sender).approve(distributor.address, fundAmount);
        const senderBalanceBefore = await mockErc20.balanceOf(await sender.getAddress());
        const distributorBalanceBefore = await mockErc20.balanceOf(distributor.address);

        await expect(distributor.connect(sender).addReward(mockErc20.address, fundAmount))
            .to.emit(distributor, "RewardAdded")
            .withArgs(mockErc20.address, epoch, fundAmount);

        expect(await mockErc20.balanceOf(distributor.address), "distributor balance").to.eq(
            distributorBalanceBefore.add(fundAmount),
        );
        expect(await mockErc20.balanceOf(await sender.getAddress()), "sender balance").to.eq(
            senderBalanceBefore.sub(fundAmount),
        );
    }

    it("initial configuration is correct", async () => {
        expect(await distributor.auraLocker(), "auraLocker").to.eq(auraLocker.address);
    });

    it("add rewards", async () => {
        await increaseTime(ONE_WEEK);
        const fundAmount = simpleToExactAmount(1);
        await mockErc20.approve(distributor.address, fundAmount);
        const senderBalanceBefore = await mockErc20.balanceOf(aliceAddress);
        const distributorBalanceBefore = await mockErc20.balanceOf(distributor.address);
        await expect(distributor.addReward(mockErc20.address, fundAmount))
            .to.emit(distributor, "RewardAdded")
            .withArgs(mockErc20.address, 1, fundAmount);

        expect(await mockErc20.balanceOf(distributor.address), "distributor balance").to.eq(
            distributorBalanceBefore.add(fundAmount),
        );
        expect(await mockErc20.balanceOf(aliceAddress), "alice balance").to.eq(senderBalanceBefore.sub(fundAmount));
    });
    describe("adds rewards", async () => {
        it("allows anyone to fund", async () => {
            await increaseTime(ONE_WEEK);
            const epoch = 2;
            const fundAmount = simpleToExactAmount(1);
            await verifyAddRewards(bob, fundAmount, epoch);
        });
        it("adds multiple occurrences to same epoch", async () => {
            await increaseTime(ONE_WEEK); //  new epoch
            const epoch = 3;
            const fundAmount = simpleToExactAmount(1);
            const aliceLastClaim = await distributor.userClaims(mockErc20.address, aliceAddress);
            const bobLastClaim = await distributor.userClaims(mockErc20.address, bobAddress);
            const rewardData = await distributor.rewardData(mockErc20.address, epoch);

            await verifyAddRewards(alice, fundAmount, epoch);
            await verifyAddRewards(bob, fundAmount, epoch);
            await verifyAddRewards(alice, fundAmount, epoch);
            await verifyAddRewards(bob, fundAmount, epoch);

            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "last claim should not change").to.eq(
                aliceLastClaim,
            );
            expect(await distributor.userClaims(mockErc20.address, bobAddress), "last claim should not change").to.eq(
                bobLastClaim,
            );
            // add 2 zeros to match the reward per token rate
            expect(await distributor.rewardData(mockErc20.address, epoch), "rewards increased at given epoch").to.eq(
                rewardData.add(fundAmount.mul(4)).mul(100),
            );
        });
        it("adds to the current vlAURA epoch", async () => {
            // Simulates two more epochs and checkpoints locker.
            await increaseTime(ONE_WEEK); //  new epoch
            await increaseTime(ONE_WEEK); //  new epoch
            await auraLocker.checkpointEpoch();
            const epoch = (await auraLocker.findEpochId(await getTimestamp())).toNumber();

            // Then add a reward to the current epoch.
            // There is a gap of one epoch between distributor.rewardEpochs, distributor.rewardData and auraLocker

            const fundAmount = simpleToExactAmount(1);
            const aliceLastClaim = await distributor.userClaims(mockErc20.address, aliceAddress);
            const bobLastClaim = await distributor.userClaims(mockErc20.address, bobAddress);
            const rewardData = await distributor.rewardData(mockErc20.address, epoch);

            await verifyAddRewards(alice, fundAmount, epoch);
            await verifyAddRewards(bob, fundAmount, epoch);

            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "last claim should not change").to.eq(
                aliceLastClaim,
            );
            expect(await distributor.userClaims(mockErc20.address, bobAddress), "last claim should not change").to.eq(
                bobLastClaim,
            );
            // current reward data until now [100, 100, 400, 0 ,200]
            expect(await distributor.rewardData(mockErc20.address, epoch - 1), "no rewards at epoch 4").to.eq(0);
            // add 2 zeros to match the reward per token rate
            expect(await distributor.rewardData(mockErc20.address, epoch), "rewards increased at given epoch").to.eq(
                rewardData.add(fundAmount.mul(2)).mul(100),
            ); //epoch 5
            expect(await distributor.rewardEpochsCount(mockErc20.address), "reward epoch count").to.eq(4);
            // Expect the epoch gap.
            expect(await distributor.rewardEpochs(mockErc20.address, 2), "reward epoch at index").to.eq(3);
            expect(await distributor.rewardEpochs(mockErc20.address, 3), "reward epoch at index").to.eq(5);
        });
        it("fails if adds reward to a future epoch", async () => {
            const epoch = (await auraLocker.findEpochId(await getTimestamp())).toNumber();
            await expect(
                distributor.addRewardToEpoch(mockErc20.address, simpleToExactAmount(1), epoch + 1),
            ).revertedWith("Cannot assign to the future");
        });
        it("fails if cannot backdate a reward", async () => {
            const fundAmount = simpleToExactAmount(1);
            const latestEpoch = (await auraLocker.epochCount()).toNumber() - 1;
            const rewardCount = (await distributor.rewardEpochsCount(mockErc20.address)).toNumber();
            const backDatedEpoch = latestEpoch - 1;
            expect(backDatedEpoch, "back dated epoch is not in the future").to.lt(latestEpoch);
            expect(
                await distributor.rewardEpochs(mockErc20.address, rewardCount - 1),
                "latest reward epoch is greater that backdated epoch",
            ).to.gte(backDatedEpoch);
            await expect(distributor.addRewardToEpoch(mockErc20.address, fundAmount, backDatedEpoch)).revertedWith(
                "Cannot backdate to this epoch",
            );
        });
        it("does not allow claiming until the epoch has finished", async () => {
            const fundAmount = simpleToExactAmount(1);
            const lockDuration = await auraLocker.lockDuration();
            const timestamp0 = await getTimestamp();
            let epoch = (await auraLocker.findEpochId(timestamp0)).toNumber();

            // 1.- Verify there are no rewards to claim initially
            const claimableRewardStep0 = await distributor.claimableRewards(bobAddress, mockErc20.address);
            expect(claimableRewardStep0, "claimable rewards").to.eq(0);

            // 2.- Add to the current epoch, bob locks and more rewards.
            await contracts.cvx.connect(operatorAccount.signer).transfer(bobAddress, simpleToExactAmount(200));
            await contracts.cvx.connect(bob).approve(auraLocker.address, simpleToExactAmount(200));
            await auraLocker.connect(bob).lock(bobAddress, simpleToExactAmount(10));

            await verifyAddRewards(bob, fundAmount, epoch);

            // 3.- Verify there are no rewards to claim as it is in the current epoch.
            expect(
                await distributor.claimableRewards(bobAddress, mockErc20.address),
                "no rewards for current epoch",
            ).to.eq(0);

            // 4.- Advance to the next epoch.
            await increaseTime(ONE_WEEK); //  new epoch + rewards
            epoch = (await auraLocker.findEpochId(await getTimestamp())).toNumber();
            await verifyAddRewards(bob, fundAmount, epoch);

            // 5.- Verify there are no rewards to claim as the lock time has not being reached.
            expect(await getTimestamp(), "lock duration not reached yet").to.lt(timestamp0.add(lockDuration));
            expect(await distributor.claimableRewards(bobAddress, mockErc20.address), "no rewards yet").to.eq(0);
            const balanceBefore = await mockErc20.balanceOf(bobAddress);
            const tx = distributor["getReward(address,address)"](bobAddress, mockErc20.address);
            await expect(tx).not.to.emit(distributor, "RewardPaid");
            expect(await distributor.userClaims(mockErc20.address, bobAddress), "user claims not updated").to.eq(0);
            expect(await mockErc20.balanceOf(bobAddress), "balance of bob does not change").to.eq(balanceBefore);

            // 6.- Test there are rewards to claim after lock duration has been reached.
            await increaseTime(lockDuration); //  unlock rewards for bob
            await auraLocker.checkpointEpoch();

            // Verify there are rewards to claim!
            expect(await distributor.claimableRewards(bobAddress, mockErc20.address), "rewards available").to.gt(0);
        });
        it("adds reward backdate to a new token - epoch 1", async () => {
            // Given it is a new token and the epoch is 1.
            const epoch = 1;
            const fundAmount = simpleToExactAmount(10);
            await mockErc20X.connect(alice).approve(distributor.address, fundAmount);
            const senderBalanceBefore = await mockErc20X.balanceOf(aliceAddress);
            const distributorBalanceBefore = await mockErc20X.balanceOf(distributor.address);
            // Test add reward to epoch
            expect(await distributor.rewardEpochsCount(mockErc20X.address), "rewardEpochs count is 0").to.eq(0);

            await expect(distributor.connect(alice).addRewardToEpoch(mockErc20X.address, fundAmount, epoch))
                .to.emit(distributor, "RewardAdded")
                .withArgs(mockErc20X.address, epoch, fundAmount);
            // Then
            expect(await mockErc20X.balanceOf(distributor.address), "distributor balance").to.eq(
                distributorBalanceBefore.add(fundAmount),
            );
            expect(await mockErc20X.balanceOf(aliceAddress), "sender balance").to.eq(
                senderBalanceBefore.sub(fundAmount),
            );
        });
        it("adds reward backdate to existing token", async () => {
            // Given the token already received rewards
            const epoch = 2;
            const fundAmount = simpleToExactAmount(10);
            await mockErc20X.connect(alice).approve(distributor.address, fundAmount);
            const senderBalanceBefore = await mockErc20X.balanceOf(aliceAddress);
            const distributorBalanceBefore = await mockErc20X.balanceOf(distributor.address);

            expect(await distributor.rewardEpochsCount(mockErc20X.address), "rewardEpochs count").to.gt(0);
            await expect(distributor.connect(alice).addRewardToEpoch(mockErc20X.address, fundAmount, epoch))
                .to.emit(distributor, "RewardAdded")
                .withArgs(mockErc20X.address, epoch, fundAmount);

            expect(await mockErc20X.balanceOf(distributor.address), "distributor balance").to.eq(
                distributorBalanceBefore.add(fundAmount),
            );
            expect(await mockErc20X.balanceOf(aliceAddress), "sender balance").to.eq(
                senderBalanceBefore.sub(fundAmount),
            );
        });
        it("adds reward to the latest epoch", async () => {
            // Given the token already received rewards
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await increaseTime(ONE_WEEK);
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));

            const epoch = (await auraLocker.epochCount()).toNumber() - 1;
            const fundAmount = simpleToExactAmount(10);
            await mockErc20X.connect(alice).approve(distributor.address, fundAmount);
            const senderBalanceBefore = await mockErc20X.balanceOf(aliceAddress);
            const distributorBalanceBefore = await mockErc20X.balanceOf(distributor.address);

            expect(await distributor.rewardEpochsCount(mockErc20X.address), "rewardEpochs count").to.gt(0);
            await expect(distributor.connect(alice).addRewardToEpoch(mockErc20X.address, fundAmount, epoch))
                .to.emit(distributor, "RewardAdded")
                .withArgs(mockErc20X.address, epoch, fundAmount);

            expect(await mockErc20X.balanceOf(distributor.address), "distributor balance").to.eq(
                distributorBalanceBefore.add(fundAmount),
            );
            expect(await mockErc20X.balanceOf(aliceAddress), "sender balance").to.eq(
                senderBalanceBefore.sub(fundAmount),
            );
        });
    });

    // Up to this point, alice and bob can claim rewards.
    describe("claiming rewards", async () => {
        let aliceBalanceBefore: BN;
        let bobBalanceBefore: BN;
        beforeEach(async () => {
            aliceBalanceBefore = await mockErc20.balanceOf(aliceAddress);
            bobBalanceBefore = await mockErc20.balanceOf(bobAddress);
            // alice has rewards on the following epoch / rewards
            // claimableRewardsAtEpoch(1) 1000000000000000000 (index 0)
            // claimableRewardsAtEpoch(2) 1000000000000000000 (index 1)
            // claimableRewardsAtEpoch(3) 4000000000000000000 (index 2)
            // claimableRewardsAtEpoch(4) 0
            // claimableRewardsAtEpoch(5) 3000000000000000000 (index 3)
            // claimableRewardsAtEpoch(6)  909090909090909090 (index 4)

            // bob has rewards on the following epoch / rewards
            // 6 claimableRewardsAtEpoch 909090909090909090
        });
        // This is important logic as it basically combines forfeit rewards and claim into one to reduce gas
        it("allows users to specify a start index", async () => {
            // Given that bob has rewards on epoch 6 and has not claim yet.
            const epoch = 6;
            const epochIndex = 4; // epoch 6 is index 4 (there is a gap)
            const claimIndex = epochIndex + 1;
            const claimableRewardsAtLatestEpoch = await distributor.claimableRewardsAtEpoch(
                bobAddress,
                mockErc20.address,
                epoch,
            );
            expect(claimableRewardsAtLatestEpoch, "bob claimable rewards at given epoch").to.gt(0);
            expect(await distributor.userClaims(mockErc20.address, bobAddress), "user claims").to.eq(0);
            // When
            const tx = distributor
                .connect(bob)
                ["getReward(address,address,uint256)"](bobAddress, mockErc20.address, epochIndex);

            // Then
            await expect(tx)
                .to.emit(distributor, "RewardPaid")
                .withArgs(bobAddress, mockErc20.address, claimableRewardsAtLatestEpoch, claimIndex);
            expect(await mockErc20.balanceOf(bobAddress), "sends the token to the user").to.eq(
                bobBalanceBefore.add(claimableRewardsAtLatestEpoch),
            );
            expect((await mockErc20.balanceOf(bobAddress)).sub(bobBalanceBefore), "sends the token to the user").to.gt(
                0,
            );
            expect(await distributor.userClaims(mockErc20.address, bobAddress), "user claims index updated").to.eq(
                claimIndex,
            );
        });
        it("does not allow the same epoch to be claimed twice", async () => {
            // Given that bob has rewards on epoch 6 and has claimed
            const epoch = 6;
            const claimableRewardsAtLatestEpoch = await distributor.claimableRewardsAtEpoch(
                bobAddress,
                mockErc20.address,
                epoch,
            );
            expect(claimableRewardsAtLatestEpoch, "bob claimable rewards at given epoch").to.gt(0);
            expect(await distributor.userClaims(mockErc20.address, bobAddress), "user claims index updated").to.eq(
                epoch - 1,
            );
            // When
            const tx = distributor
                .connect(bob)
                ["getReward(address,address,uint256)"](bobAddress, mockErc20.address, epoch);
            // Then
            await expect(tx).not.to.emit(distributor, "RewardPaid");
            expect(await mockErc20.balanceOf(bobAddress), "bob balance").to.eq(bobBalanceBefore);
        });
        it.skip("allows users to specify a start index multiple times - backlog", async () => {
            // Claim rewards for epoch 5 so it includes as well epoch 6 , then rewards for epoch 3
            // Given that alice has rewards on epoch 6 and has not claim yet.
            let epoch = 5;
            let epochIndex = epoch - 2; // epoch 6 is index 4 (there is a gap)
            let claimIndex = 5; // Claiming epoch 5 (index 3) and 6 (index 4)  + 1
            const claimableRewardsAtEpoch5 = await distributor.claimableRewardsAtEpoch(
                aliceAddress,
                mockErc20.address,
                5,
            );
            const claimableRewardsAtEpoch6 = await distributor.claimableRewardsAtEpoch(
                aliceAddress,
                mockErc20.address,
                6,
            );
            const claimableRewards = claimableRewardsAtEpoch5.add(claimableRewardsAtEpoch6);

            expect(claimableRewardsAtEpoch5, "claimable rewards at given epoch").to.gt(0);
            expect(claimableRewardsAtEpoch6, "claimable rewards at given epoch").to.gt(0);
            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "user claims").to.eq(0);
            // When claiming rewards for epoch 5 (index 3)
            let tx = distributor
                .connect(alice)
                ["getReward(address,address,uint256)"](aliceAddress, mockErc20.address, epochIndex);

            // Then
            await expect(tx)
                .to.emit(distributor, "RewardPaid")
                .withArgs(aliceAddress, mockErc20.address, claimableRewards, claimIndex);
            expect(await mockErc20.balanceOf(aliceAddress), "reward balance").to.eq(
                aliceBalanceBefore.add(claimableRewards),
            );
            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "user claims index updated").to.eq(
                claimIndex,
            );

            // It should allow to claim rewards for epoch 3 (index 2)
            // Currently this behavior is not supported -  TODO //
            epoch = 3;
            epochIndex = epoch - 1; // epoch 3 is index 2
            claimIndex = epochIndex + 1; // index 2 + 1
            // When claiming rewards for epoch 3
            tx = distributor
                .connect(alice)
                ["getReward(address,address,uint256)"](aliceAddress, mockErc20.address, epochIndex);
            // Then
            await expect(tx)
                .to.emit(distributor, "RewardPaid")
                .withArgs(aliceAddress, mockErc20.address, claimableRewards, claimIndex);
            expect(await mockErc20.balanceOf(aliceAddress), "reward balance").to.eq(
                aliceBalanceBefore.add(claimableRewards),
            );
            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "user claims index updated").to.eq(
                claimIndex,
            );
        });
        it("allows users to claim all rewards", async () => {
            // Given a user that has not claim rewards
            const claimableRewards = await distributor.claimableRewards(aliceAddress, mockErc20.address);
            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "user claims").to.eq(0);
            const claimIndex = 4 + 1; // Up to this test, the latest index is 4

            // When it claim all rewards
            const tx = distributor.connect(alice)["getReward(address,address)"](aliceAddress, mockErc20.address);

            // Then
            await expect(tx)
                .to.emit(distributor, "RewardPaid")
                .withArgs(aliceAddress, mockErc20.address, claimableRewards, claimIndex);
            expect(await mockErc20.balanceOf(aliceAddress), "sends the token to the user").to.eq(
                aliceBalanceBefore.add(claimableRewards),
            );
            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "user claims index updated").to.eq(
                claimIndex,
            );
        });
    });
    describe("forfeiting rewards", () => {
        before(async () => {
            // Add some rewards to  be able to forfeit them later.
            await mockErc20.connect(alice).approve(distributor.address, simpleToExactAmount(100));
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));

            await increaseTime(ONE_WEEK);
            const fundAmount = simpleToExactAmount(1);
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            await distributor.connect(alice).addReward(mockErc20.address, fundAmount);
            let epoch = (await auraLocker.findEpochId(await getTimestamp())).toNumber();
            await verifyAddRewards(alice, fundAmount, epoch);

            await increaseTime(ONE_WEEK);
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            epoch = (await auraLocker.findEpochId(await getTimestamp())).toNumber();
            await verifyAddRewards(alice, fundAmount, epoch);

            await increaseTime(ONE_WEEK);
            await auraLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(10));
            epoch = (await auraLocker.findEpochId(await getTimestamp())).toNumber();
            await verifyAddRewards(alice, fundAmount, epoch);
        });
        it("fails if the index is in the past or the future", async () => {
            const rewardEpochsCount = await distributor.rewardEpochsCount(mockErc20.address);
            const userClaims = await distributor.userClaims(mockErc20.address, aliceAddress);
            await expect(distributor.connect(alice).forfeitRewards(mockErc20.address, 0)).revertedWith("!past");
            await expect(
                distributor.connect(alice).forfeitRewards(mockErc20.address, rewardEpochsCount.sub(1)),
            ).revertedWith("!past");
            await expect(distributor.connect(alice).forfeitRewards(mockErc20.address, userClaims.sub(1))).revertedWith(
                "already claimed",
            );
        });
        it("allows users to forfeit rewards", async () => {
            const userClaims = await distributor.userClaims(mockErc20.address, aliceAddress);
            const index = userClaims.add(1);
            const tx = distributor.connect(alice).forfeitRewards(mockErc20.address, index);
            await expect(tx).to.emit(distributor, "RewardForfeited").withArgs(aliceAddress, mockErc20.address, index);
            expect(await distributor.userClaims(mockErc20.address, aliceAddress), "user claims index updated").to.eq(
                index.add(1),
            );
        });
    });
});
