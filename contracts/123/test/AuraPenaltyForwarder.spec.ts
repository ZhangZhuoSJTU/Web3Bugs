import { expect } from "chai";
import { Signer } from "ethers";
import hre, { ethers } from "hardhat";
import { deployMocks, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4, SystemDeployed } from "../scripts/deploySystem";
import { ONE_WEEK } from "../test-utils/constants";
import { impersonateAccount } from "../test-utils/fork";
import { BN, simpleToExactAmount } from "../test-utils/math";
import { getTimestamp, increaseTime } from "../test-utils/time";
import { AuraPenaltyForwarder, AuraToken, ExtraRewardsDistributor } from "../types/generated";

describe("AuraPenaltyForwarder", () => {
    let accounts: Signer[];
    let contracts: SystemDeployed;
    let deployer: Signer;
    let alice: Signer;
    let aliceAddress: string;
    let aliceInitialBalance: BN;
    let distributor: ExtraRewardsDistributor;
    let cvx: AuraToken;

    // Testing contract
    let penaltyForwarder: AuraPenaltyForwarder;

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
        penaltyForwarder = contracts.penaltyForwarder;
        cvx = contracts.cvx;
        distributor = contracts.extraRewardsDistributor.connect(alice);

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await cvx.connect(operatorAccount.signer).mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await cvx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        aliceInitialBalance = await cvx.balanceOf(aliceAddress);
    });

    it("initial configuration is correct", async () => {
        const currentTime = await getTimestamp();
        expect(await penaltyForwarder.distributor(), "distributor").to.eq(distributor.address);
        expect(await penaltyForwarder.token(), "token").to.eq(cvx.address);
        expect(await penaltyForwarder.distributionDelay(), "distributionDelay").to.eq(ONE_WEEK.mul(7).div(2));
        expect(await penaltyForwarder.lastDistribution(), "lastDistribution").to.lte(currentTime);
    });
    it("forwarder cvx allowance is correct", async () => {
        expect(await cvx.allowance(penaltyForwarder.address, distributor.address), "allowance").to.eq(
            ethers.constants.MaxUint256,
        );
    });
    describe("forward", async () => {
        it("fails if the distribution delay is not completed", async () => {
            const currentTime = await getTimestamp();
            const lastDistribution = await penaltyForwarder.lastDistribution();
            const distributionDelay = await penaltyForwarder.distributionDelay();
            expect(currentTime, "lastDistribution").to.lte(lastDistribution.add(distributionDelay));
            await expect(penaltyForwarder.forward(), "fails due to ").to.be.revertedWith("!elapsed");
        });
        it("fails if the balance of the forwarder is 0", async () => {
            // increase time so that the distribution delay is completed
            await increaseTime(await penaltyForwarder.distributionDelay());
            const penaltyForwarderBalance = await cvx.balanceOf(penaltyForwarder.address);
            expect(penaltyForwarderBalance, "penalty forwarder balance").to.eq(0);

            await expect(penaltyForwarder.forward(), "empty balance").to.be.revertedWith("!empty");
        });

        it("should forward all cvx balance to the distributor", async () => {
            const cvxAmount = aliceInitialBalance.div(2);
            // Locks some CVX in locker to avoid:
            // Error: VM Exception while processing transaction: reverted with panic code 0x12 (Division or modulo division by zero)
            // ExtraRewardsDistributor._addReward (contracts/ExtraRewardsDistributor.sol:97
            await cvx.connect(alice).approve(contracts.cvxLocker.address, cvxAmount);
            await contracts.cvxLocker.connect(alice).lock(aliceAddress, cvxAmount);

            // Sends some cvx to the forwarder
            await cvx.connect(alice).approve(penaltyForwarder.address, cvxAmount);
            await cvx.connect(alice).transfer(penaltyForwarder.address, cvxAmount);
            const distributorBalanceBefore = await cvx.balanceOf(distributor.address);
            const penaltyForwarderBalanceBefore = await cvx.balanceOf(penaltyForwarder.address);

            // Increase time to avoid dividing by zero at ExtraRewardsDistributor._addReward , auraLocker.totalSupplyAtEpoch
            await increaseTime(ONE_WEEK);

            expect(penaltyForwarderBalanceBefore, "penalty forwarder balance").to.gt(0);
            // Test
            const tx = await penaltyForwarder.forward();
            // Verify events, storage change, balance, etc.
            await expect(tx).to.emit(penaltyForwarder, "Forwarded").withArgs(cvxAmount);
            const distributorBalanceAfter = await cvx.balanceOf(distributor.address);
            const penaltyForwarderBalanceAfter = await cvx.balanceOf(penaltyForwarder.address);
            expect(penaltyForwarderBalanceAfter, "penalty forwarder balance").to.eq(0);
            expect(distributorBalanceAfter, "distributor balance").to.eq(distributorBalanceBefore.add(cvxAmount));
        });
    });
});
