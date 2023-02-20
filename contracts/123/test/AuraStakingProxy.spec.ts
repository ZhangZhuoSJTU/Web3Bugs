import hre, { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4, SystemDeployed } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { impersonateAccount, increaseTime, simpleToExactAmount, ZERO, ZERO_ADDRESS } from "../test-utils";
import { deployContract } from "../tasks/utils";
import { MockERC20, MockERC20__factory } from "../types";

describe("AuraStakingProxy", () => {
    let accounts: Signer[];
    let contracts: SystemDeployed;
    let mocks: DeployMocksResult;

    let deployer: Signer;

    let alice: Signer;
    let aliceAddress: string;
    let bob: Signer;
    let bobAddress: string;

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
        contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        bob = accounts[2];
        bobAddress = await bob.getAddress();

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        let tx = await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await tx.wait();

        tx = await contracts.cvx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        await tx.wait();

        tx = await contracts.cvx.connect(operatorAccount.signer).transfer(bobAddress, simpleToExactAmount(100));
        await tx.wait();
    };

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        await setup();
    });

    it("has correct initial config", async () => {
        expect(await contracts.cvxStakingProxy.crv()).eq(mocks.crv.address);
        expect(await contracts.cvxStakingProxy.cvx()).eq(contracts.cvx.address);
        expect(await contracts.cvxStakingProxy.cvxCrv()).eq(contracts.cvxCrv.address);
        expect(await contracts.cvxStakingProxy.crvDepositorWrapper()).eq(contracts.crvDepositorWrapper.address);
        expect(await contracts.cvxStakingProxy.outputBps()).eq(9975);
        expect(await contracts.cvxStakingProxy.rewards()).eq(contracts.cvxLocker.address);
        expect(await contracts.cvxStakingProxy.owner()).eq(await accounts[0].getAddress());
        expect(await contracts.cvxStakingProxy.pendingOwner()).eq(ZERO_ADDRESS);
        expect(await contracts.cvxStakingProxy.callIncentive()).eq(25);
    });

    describe("admin fns", () => {
        describe("when called by EOA", () => {
            it("fails to set crvDepositorWrapper", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).setCrvDepositorWrapper(ZERO_ADDRESS, "9001");
                await expect(tx).to.revertedWith("!auth");
            });
            it("fails to set the keeper", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).setKeeper(ZERO_ADDRESS);
                await expect(tx).to.be.revertedWith("!auth");
            });
            it("fails to set pending owner", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).setPendingOwner(ZERO_ADDRESS);
                await expect(tx).to.revertedWith("!auth");
            });
            it("fails to apply pending owner due to auth", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).applyPendingOwner();
                await expect(tx).to.revertedWith("!auth");
            });
            it("fails to apply pending owner due to wrong owner", async () => {
                const oldOwner = await contracts.cvxStakingProxy.owner();
                const pendingOwner = await contracts.cvxStakingProxy.pendingOwner();

                // sets wrong owner address
                await contracts.cvxStakingProxy.setPendingOwner(ZERO_ADDRESS);

                expect(oldOwner).not.eq(pendingOwner);
                const tx = contracts.cvxStakingProxy.applyPendingOwner();
                await expect(tx).to.revertedWith("invalid owner");

                // reset
                await contracts.cvxStakingProxy.setPendingOwner(pendingOwner);
            });
            it("fails to set call incentive", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).setCallIncentive("0");
                await expect(tx).to.revertedWith("!auth");
            });
            it("fails to set call incentive too high", async () => {
                const tx = contracts.cvxStakingProxy.setCallIncentive("101");
                await expect(tx).to.revertedWith("too high");
            });
            it("fails to set reward contract", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).setRewards(ZERO_ADDRESS);
                await expect(tx).to.revertedWith("!auth");
            });
            it("fails to rescue token", async () => {
                const tx = contracts.cvxStakingProxy.connect(accounts[2]).rescueToken(ZERO_ADDRESS, ZERO_ADDRESS);
                await expect(tx).to.revertedWith("!auth");
            });
        });
        describe("when called by owner", () => {
            it("fails to set crvDepositorWrapper if output bps out of range", async () => {
                let tx = contracts.cvxStakingProxy.setCrvDepositorWrapper(ZERO_ADDRESS, "8999");
                await expect(tx).to.revertedWith("Invalid output bps");

                tx = contracts.cvxStakingProxy.setCrvDepositorWrapper(ZERO_ADDRESS, "10001");
                await expect(tx).to.revertedWith("Invalid output bps");
            });
            it("sets crvDepositorWrapper", async () => {
                const oldCrvDepositorWrapper = await contracts.cvxStakingProxy.crvDepositorWrapper();
                const proposedCrvDepositorWrapper = ZERO_ADDRESS;
                expect(proposedCrvDepositorWrapper).not.eq(oldCrvDepositorWrapper);

                const oldOutputBps = await contracts.cvxStakingProxy.outputBps();
                const proposedOutputBps = BigNumber.from("9003");
                expect(proposedOutputBps).not.eq(oldOutputBps);

                await contracts.cvxStakingProxy.setCrvDepositorWrapper(ZERO_ADDRESS, proposedOutputBps);
                const newCrvDepositorWrapper = await contracts.cvxStakingProxy.crvDepositorWrapper();
                expect(newCrvDepositorWrapper).eq(proposedCrvDepositorWrapper);
                const newOutputBps = await contracts.cvxStakingProxy.outputBps();
                expect(newOutputBps).eq(proposedOutputBps);

                // reset
                await contracts.cvxStakingProxy.setCrvDepositorWrapper(oldCrvDepositorWrapper, oldOutputBps);
            });
            it("sets keeper", async () => {
                const oldKeeper = await contracts.cvxStakingProxy.keeper();
                const proposedKeeper = await accounts[2].getAddress();
                expect(oldKeeper).not.eq(proposedKeeper);
                await contracts.cvxStakingProxy.connect(accounts[0]).setKeeper(proposedKeeper);
                const newKeeper = await contracts.cvxStakingProxy.keeper();
                expect(newKeeper).eq(proposedKeeper);
            });
            it("sets pending owner", async () => {
                const proposedOwner = await accounts[2].getAddress();
                const oldPendingOwner = await contracts.cvxStakingProxy.pendingOwner();
                expect(proposedOwner).not.eq(oldPendingOwner);

                await contracts.cvxStakingProxy.setPendingOwner(proposedOwner);
                const newPendingOwner = await contracts.cvxStakingProxy.pendingOwner();
                expect(newPendingOwner).eq(proposedOwner);
            });
            it("applies pending owner", async () => {
                const oldOwner = await contracts.cvxStakingProxy.owner();
                const pendingOwner = await contracts.cvxStakingProxy.pendingOwner();
                expect(oldOwner).not.eq(pendingOwner);
                await contracts.cvxStakingProxy.applyPendingOwner();
                const newOwner = await contracts.cvxStakingProxy.owner();
                expect(newOwner).eq(pendingOwner);

                // reset
                const latestOwner = accounts[2];
                await contracts.cvxStakingProxy.connect(latestOwner).setPendingOwner(oldOwner);
                await contracts.cvxStakingProxy.connect(latestOwner).applyPendingOwner();
                const newerOwner = await contracts.cvxStakingProxy.owner();
                expect(newerOwner).eq(oldOwner);
            });
            it("sets rewards contract", async () => {
                const proposedRewards = ZERO_ADDRESS;
                const oldRewards = await contracts.cvxStakingProxy.rewards();
                expect(oldRewards).not.eq(proposedRewards);
                await contracts.cvxStakingProxy.setRewards(proposedRewards);
                const newRewards = await contracts.cvxStakingProxy.rewards();
                expect(proposedRewards).eq(newRewards);

                // reset
                await contracts.cvxStakingProxy.setRewards(oldRewards);
            });
            it("rescues token", async () => {
                const amount = ethers.utils.parseEther("100");
                const deployerAddress = await accounts[0].getAddress();
                const randomToken = await deployContract(
                    hre,
                    new MockERC20__factory(accounts[0]),
                    "RandomToken",
                    ["Random", "RND", 18, deployerAddress, 100],
                    {},
                    false,
                );

                await randomToken.transfer(contracts.cvxStakingProxy.address, amount);
                const balanceBefore = await randomToken.balanceOf(deployerAddress);
                expect(balanceBefore).eq(ZERO);

                await contracts.cvxStakingProxy.rescueToken(randomToken.address, deployerAddress);
                const balanceAfter = await randomToken.balanceOf(deployerAddress);
                expect(balanceAfter).eq(amount);
            });
            it("fails to rescue crv", async () => {
                const tx = contracts.cvxStakingProxy.rescueToken(mocks.crv.address, ZERO_ADDRESS);
                await expect(tx).to.revertedWith("not allowed");
            });
            it("fails to rescue cvx", async () => {
                const tx = contracts.cvxStakingProxy.rescueToken(contracts.cvx.address, ZERO_ADDRESS);
                await expect(tx).to.revertedWith("not allowed");
            });
            it("fails to rescue cvxCrv", async () => {
                const tx = contracts.cvxStakingProxy.rescueToken(contracts.cvxCrv.address, ZERO_ADDRESS);
                await expect(tx).to.revertedWith("not allowed");
            });
            it("set call incentive", async () => {
                const oldCallIncentive = await contracts.cvxStakingProxy.callIncentive();
                const tx = contracts.cvxStakingProxy.setCallIncentive(oldCallIncentive.add(1));
                await expect(tx)
                    .to.emit(contracts.cvxStakingProxy, "CallIncentiveChanged")
                    .withArgs(oldCallIncentive.add(1));
                const newCallIncentive = await contracts.cvxStakingProxy.callIncentive();
                expect(newCallIncentive).not.eq(oldCallIncentive);
                // reset
                await contracts.cvxStakingProxy.setCallIncentive(oldCallIncentive);
            });
        });
    });

    describe("distributing rewards", () => {
        it("fails to distribute if caller is not the keeper", async () => {
            const keeper = await accounts[1].getAddress();
            await contracts.cvxStakingProxy.setKeeper(keeper);
            await expect(contracts.cvxStakingProxy.connect(accounts[0]).distribute()).to.be.revertedWith("!auth");
            await contracts.cvxStakingProxy.connect(accounts[1]).distribute();
        });
        it("allows anyone to distribute", async () => {
            await contracts.cvxStakingProxy.setKeeper(ZERO_ADDRESS);
            await contracts.cvxStakingProxy.connect(accounts[0]).distribute();
        });
        it("distribute rewards from the booster", async () => {
            await contracts.booster.earmarkRewards(0);
            await increaseTime(60 * 60 * 24);

            const incentive = await contracts.booster.stakerIncentive();
            const rate = await mocks.crvMinter.rate();
            const stakingProxyBalance = await mocks.crv.balanceOf(contracts.cvxStakingProxy.address);
            expect(stakingProxyBalance).to.equal(rate.mul(incentive).div(10000));

            const balanceBefore = await contracts.cvxCrv.balanceOf(contracts.cvxLocker.address);
            const tx = await contracts.cvxStakingProxy.distribute();
            await tx.wait();

            const balanceAfter = await contracts.cvxCrv.balanceOf(contracts.cvxLocker.address);

            const outputBps = await contracts.cvxStakingProxy.outputBps();
            const minOut = await contracts.crvDepositorWrapper.getMinOut(stakingProxyBalance, outputBps);
            const callIncentive = await contracts.cvxStakingProxy.callIncentive();
            const callIncentiveAmount = minOut.mul(callIncentive).div("10000");

            expect(balanceAfter.sub(balanceBefore)).gt(minOut.sub(callIncentiveAmount));
            // False negative check
            expect(balanceAfter).gt(0);
        });
    });
    describe("distributing other rewards", () => {
        let randomToken: MockERC20;
        let deployerAddress: string;
        before(async () => {
            // const amount = ethers.utils.parseEther("100");
            deployerAddress = await accounts[0].getAddress();
            randomToken = await deployContract(
                hre,
                new MockERC20__factory(accounts[0]),
                "RandomToken",
                ["Random", "RND", 18, deployerAddress, 100],
                {},
                false,
            );
        });
        it("fails to distribute cvxCrv or crv", async () => {
            await expect(contracts.cvxStakingProxy.distributeOther(mocks.crv.address)).to.be.revertedWith(
                "not allowed",
            );
            await expect(contracts.cvxStakingProxy.distributeOther(contracts.cvxCrv.address)).to.be.revertedWith(
                "not allowed",
            );
        });
        it("allows anyone to distribute", async () => {
            await contracts.cvxStakingProxy.distributeOther(randomToken.address);
        });
        it("distribute other rewards", async () => {
            const user = await accounts[1];
            const userAddress = await user.getAddress();
            const amount = ethers.utils.parseEther("100");

            // Add reward to aura locker
            await contracts.cvxLocker.addReward(randomToken.address, contracts.cvxStakingProxy.address);

            // Send tokens to the staking proxy
            await randomToken.transfer(contracts.cvxStakingProxy.address, amount);

            // Distribute rewards
            const userTokenBalanceBefore = await randomToken.balanceOf(userAddress);
            const proxyTokenBalanceBefore = await randomToken.balanceOf(contracts.cvxStakingProxy.address);
            const callIncentive = await contracts.cvxStakingProxy.callIncentive();
            const denominator = await contracts.cvxStakingProxy.denominator();
            const incentiveAmount = proxyTokenBalanceBefore.mul(callIncentive).div(denominator);
            const rewardAmount = proxyTokenBalanceBefore.sub(incentiveAmount);

            const tx = contracts.cvxStakingProxy.connect(user).distributeOther(randomToken.address);
            await expect(tx)
                .to.emit(contracts.cvxStakingProxy, "RewardsDistributed")
                .withArgs(randomToken.address, rewardAmount);
            expect(await randomToken.balanceOf(userAddress), "incentive to sender").eq(
                userTokenBalanceBefore.add(incentiveAmount),
            );
        });
    });
});
