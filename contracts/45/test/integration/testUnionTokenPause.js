const {ethers} = require("hardhat");
const {expect} = require("chai");

require("chai").should();

const {deployFullSuite} = require("../../utils/deployer");
const {waitNBlocks} = require("../../utils");

// Alice, Bob and Charlie are lenders
// David is a borrower
// Union tokens are transfered to Ethan for testing

describe("Test Union token transfer pause", () => {
    let ADMIN, ALICE, BOB, CHARLIE, DAVID, ETHAN;
    let dai, assetManager, unionToken, comptroller, uToken, userManager;

    const mintDAIAmount = ethers.utils.parseEther("10000");
    const stakeDAIAmount = ethers.utils.parseEther("1000");
    const vouchDAIAmount = ethers.utils.parseEther("100");
    const comptrollerUnionAmount = ethers.utils.parseEther("1000");
    const transferUnionAmount = ethers.utils.parseEther("10");

    let borrowDAIAmount;
    let newMemberFeeUnion;

    const deployAndInitialize = async () => {
        ({dai, unionToken, comptroller, assetManager, uToken, userManager} = await deployFullSuite());
        await dai.mint(assetManager.address, mintDAIAmount);
        await dai.mint(ALICE.getAddress(), mintDAIAmount);
        await dai.mint(BOB.getAddress(), mintDAIAmount);
        await dai.mint(CHARLIE.getAddress(), mintDAIAmount);
        await dai.mint(DAVID.getAddress(), mintDAIAmount);

        newMemberFeeUnion = await userManager.newMemberFee();
        await unionToken.transfer(DAVID.getAddress(), newMemberFeeUnion);
        await unionToken.transfer(comptroller.address, comptrollerUnionAmount);
    };

    before(async () => {
        [ADMIN, ALICE, BOB, CHARLIE, DAVID, ETHAN] = await ethers.getSigners();
    });

    describe("Enable whitelist and try user actions", () => {
        before(deployAndInitialize);

        it("Union token whitelist should be enabled", async () => {
            await unionToken.enableWhitelist();
            const whitelistEnabled = await unionToken.whitelistEnabled();
            whitelistEnabled.should.equal(true);
        });

        it("Admin should be whitelisted", async () => {
            const isWhitelisted = await unionToken.isWhitelisted(ADMIN.getAddress());
            isWhitelisted.should.eq(true);
        });

        it("Comptroller should be whitelisted", async () => {
            const isWhitelisted = await unionToken.isWhitelisted(comptroller.address);
            isWhitelisted.should.eq(true);
        });

        it("Alice, Bob and Charlie should be able to stake", async () => {
            await dai.connect(ALICE).approve(userManager.address, stakeDAIAmount);
            await userManager.connect(ALICE).stake(stakeDAIAmount);

            await dai.connect(BOB).approve(userManager.address, stakeDAIAmount);
            await userManager.connect(BOB).stake(stakeDAIAmount);

            await dai.connect(CHARLIE).approve(userManager.address, stakeDAIAmount);
            await userManager.connect(CHARLIE).stake(stakeDAIAmount);
        });

        it("Admin should be able to add Alice, Bob and Charlie", async () => {
            await userManager.addMember(ALICE.getAddress());
            await userManager.addMember(BOB.getAddress());
            await userManager.addMember(CHARLIE.getAddress());
        });

        it("Alice, Bob and Charlie should be able to vouch for David", async () => {
            await userManager.connect(ALICE).updateTrust(DAVID.getAddress(), vouchDAIAmount);
            await userManager.connect(BOB).updateTrust(DAVID.getAddress(), vouchDAIAmount);
            await userManager.connect(CHARLIE).updateTrust(DAVID.getAddress(), vouchDAIAmount);
        });

        it("David should be able to register", async () => {
            await unionToken.connect(DAVID).approve(userManager.address, newMemberFeeUnion);
            await userManager.connect(DAVID).registerMember(DAVID.getAddress());
        });

        it("David should be able to borrow", async () => {
            const davidCreditLimit = await userManager.getCreditLimit(DAVID.getAddress());
            const fee = await uToken.calculatingFee(davidCreditLimit);
            borrowDAIAmount = davidCreditLimit.sub(fee);
            await uToken.connect(DAVID).borrow(borrowDAIAmount);
        });

        it("David should wait for 100 blocks and repay with interest", async () => {
            await waitNBlocks(100);
            const borrowBalanceView = await uToken.borrowBalanceView(DAVID.getAddress());
            await dai.connect(DAVID).approve(uToken.address, borrowBalanceView);
            await uToken.connect(DAVID).repayBorrow(borrowBalanceView);
        });

        it("Alice, Bob and Charlie should be able to withdraw rewards", async () => {
            await userManager.connect(ALICE).withdrawRewards();
            await userManager.connect(BOB).withdrawRewards();
            await userManager.connect(CHARLIE).withdrawRewards();
        });

        it("Alice, Bob and Charlie should be able to unstake", async () => {
            let stakeAmount = await userManager.stakers(ALICE.getAddress());
            let lockedAmount = await userManager.getTotalLockedStake(ALICE.getAddress());
            await userManager.connect(ALICE).unstake(stakeAmount.sub(lockedAmount));

            stakeAmount = await userManager.stakers(BOB.getAddress());
            lockedAmount = await userManager.getTotalLockedStake(BOB.getAddress());
            await userManager.connect(BOB).unstake(stakeAmount.sub(lockedAmount));

            stakeAmount = await userManager.stakers(CHARLIE.getAddress());
            lockedAmount = await userManager.getTotalLockedStake(CHARLIE.getAddress());
            await userManager.connect(CHARLIE).unstake(stakeAmount.sub(lockedAmount));
        });

        describe("Alice transfers own Union tokens", () => {
            it("Alice should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(ALICE.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Alice should not be able to trasfer", async () => {
                await expect(
                    unionToken.connect(ALICE).transfer(ETHAN.getAddress(), transferUnionAmount)
                ).to.be.revertedWith("Whitelistable: address not whitelisted");
            });
        });

        describe("Charlie transfers Bob's Union tokens", () => {
            it("Bob should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(BOB.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Bob should approve Charlie to transfer", async () => {
                await unionToken.connect(BOB).approve(CHARLIE.getAddress(), transferUnionAmount);
            });

            it("Charlie should not be able to transfer", async () => {
                await expect(
                    unionToken.connect(CHARLIE).transferFrom(BOB.getAddress(), ETHAN.getAddress(), transferUnionAmount)
                ).to.be.revertedWith("Whitelistable: address not whitelisted");
            });
        });

        describe("Admin transfers own Union tokens", () => {
            it("Admin should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(ADMIN.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Admin should be able to transfer Union tokens", async () => {
                await unionToken.transfer(ETHAN.getAddress(), transferUnionAmount);
            });
        });

        describe("Admin transfers Bob's Union tokens", () => {
            it("Bob should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(BOB.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Bob should approve Admin to transfer", async () => {
                await unionToken.connect(BOB).approve(ADMIN.getAddress(), transferUnionAmount);
            });

            it("Admin should be able to transfer", async () => {
                await unionToken.transferFrom(BOB.getAddress(), ETHAN.getAddress(), transferUnionAmount);
            });
        });
    });

    describe("Disable whitelist and try user actions", () => {
        before(deployAndInitialize);

        it("Union token whitelist should be disabled", async () => {
            await unionToken.disableWhitelist();
            const whitelistEnabled = await unionToken.whitelistEnabled();
            whitelistEnabled.should.equal(false);
        });

        it("Alice, Bob and Charlie should be able to stake", async () => {
            await dai.connect(ALICE).approve(userManager.address, stakeDAIAmount);
            await userManager.connect(ALICE).stake(stakeDAIAmount);

            await dai.connect(BOB).approve(userManager.address, stakeDAIAmount);
            await userManager.connect(BOB).stake(stakeDAIAmount);

            await dai.connect(CHARLIE).approve(userManager.address, stakeDAIAmount);
            await userManager.connect(CHARLIE).stake(stakeDAIAmount);
        });

        it("Admin should be able to add Alice, Bob and Charlie", async () => {
            await userManager.addMember(ALICE.getAddress());
            await userManager.addMember(BOB.getAddress());
            await userManager.addMember(CHARLIE.getAddress());
        });

        it("Alice, Bob and Charlie should be able to vouch for David", async () => {
            await userManager.connect(ALICE).updateTrust(DAVID.getAddress(), vouchDAIAmount);
            await userManager.connect(BOB).updateTrust(DAVID.getAddress(), vouchDAIAmount);
            await userManager.connect(CHARLIE).updateTrust(DAVID.getAddress(), vouchDAIAmount);
        });

        it("David should be able to register", async () => {
            await unionToken.connect(DAVID).approve(userManager.address, newMemberFeeUnion);
            await userManager.connect(DAVID).registerMember(DAVID.getAddress());
        });

        it("David should be able to borrow", async () => {
            const davidCreditLimit = await userManager.getCreditLimit(DAVID.getAddress());
            const fee = await uToken.calculatingFee(davidCreditLimit);
            borrowDAIAmount = davidCreditLimit.sub(fee);
            await uToken.connect(DAVID).borrow(borrowDAIAmount);
        });

        it("David should wait for 100 blocks and repay with interest", async () => {
            await waitNBlocks(100);
            const borrowBalanceView = await uToken.borrowBalanceView(DAVID.getAddress());
            await dai.connect(DAVID).approve(uToken.address, borrowBalanceView);
            await uToken.connect(DAVID).repayBorrow(borrowBalanceView);
        });

        it("Alice, Bob and Charlie should be able to withdraw rewards", async () => {
            await userManager.connect(ALICE).withdrawRewards();
            await userManager.connect(BOB).withdrawRewards();
            await userManager.connect(CHARLIE).withdrawRewards();
        });

        it("Alice, Bob and Charlie should be able to unstake", async () => {
            let stakeAmount = await userManager.stakers(ALICE.getAddress());
            let lockedAmount = await userManager.getTotalLockedStake(ALICE.getAddress());
            await userManager.connect(ALICE).unstake(stakeAmount.sub(lockedAmount));

            stakeAmount = await userManager.stakers(BOB.getAddress());
            lockedAmount = await userManager.getTotalLockedStake(BOB.getAddress());
            await userManager.connect(BOB).unstake(stakeAmount.sub(lockedAmount));

            stakeAmount = await userManager.stakers(CHARLIE.getAddress());
            lockedAmount = await userManager.getTotalLockedStake(CHARLIE.getAddress());
            await userManager.connect(CHARLIE).unstake(stakeAmount.sub(lockedAmount));
        });

        describe("Alice transfers own Union tokens", () => {
            it("Alice should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(ALICE.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Alice should be able to trasfer", async () => {
                await unionToken.connect(ALICE).transfer(ETHAN.getAddress(), transferUnionAmount);
            });
        });

        describe("Charlie transfers Bob's Union tokens", () => {
            it("Bob should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(BOB.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Bob should approve Charlie to transfer", async () => {
                await unionToken.connect(BOB).approve(CHARLIE.getAddress(), transferUnionAmount);
            });

            it("Charlie should be able to transfer", async () => {
                await unionToken
                    .connect(CHARLIE)
                    .transferFrom(BOB.getAddress(), ETHAN.getAddress(), transferUnionAmount);
            });
        });

        describe("Admin transfers own Union tokens", () => {
            it("Admin should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(ADMIN.getAddress());
                balance.should.gte(transferUnionAmount);
            });

            it("Admin should be able to transfer Union tokens", async () => {
                await unionToken.transfer(ETHAN.getAddress(), transferUnionAmount);
            });
        });

        describe("Admin transfers Bob's Union tokens", () => {
            it("Bob should have enough tokens to transfer", async () => {
                const balance = await unionToken.balanceOf(BOB.getAddress());
                balance.should.be.gte(transferUnionAmount);
            });

            it("Bob should approve Admin to transfer", async () => {
                await unionToken.connect(BOB).approve(ADMIN.getAddress(), transferUnionAmount);
            });

            it("Admin should be able to transfer", async () => {
                await unionToken.transferFrom(BOB.getAddress(), ETHAN.getAddress(), transferUnionAmount);
            });
        });
    });
});
