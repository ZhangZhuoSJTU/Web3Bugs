import { simpleToExactAmount } from "./../test-utils/math";
import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4, SystemDeployed } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { Booster, ERC20__factory, BaseRewardPool4626__factory, BaseRewardPool4626 } from "../types/generated";
import { Signer } from "ethers";

type Pool = {
    lptoken: string;
    token: string;
    gauge: string;
    crvRewards: string;
    stash: string;
    shutdown: boolean;
};

describe("BaseRewardPool4626", () => {
    let accounts: Signer[];
    let booster: Booster;
    let mocks: DeployMocksResult;
    let pool: Pool;
    let contracts: SystemDeployed;

    let deployer: Signer;
    let deployerAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    const setup = async () => {
        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[4], accounts[5], accounts[6]);
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
        await phase3.poolManager.connect(accounts[6]).setProtectPool(false);
        contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        ({ booster } = contracts);

        pool = await booster.poolInfo(0);

        // transfer LP tokens to accounts
        const balance = await mocks.lptoken.balanceOf(deployerAddress);
        for (const account of accounts) {
            const accountAddress = await account.getAddress();
            const share = balance.div(accounts.length);
            const tx = await mocks.lptoken.transfer(accountAddress, share);
            await tx.wait();
        }

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
    };

    let alternateReceiver: Signer;

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];
        deployerAddress = await deployer.getAddress();

        await setup();
        alternateReceiver = accounts[7];
    });

    describe("checking compliance", () => {
        it("has 4626 config setup", async () => {
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            expect(await crvRewards.asset()).eq(pool.lptoken);
        });
        it("has the correct name and symbol", async () => {
            const auraBPT = await ERC20__factory.connect(pool.token, deployer);
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            expect(await crvRewards.name()).eq(`${await auraBPT.name()} Vault`);
            expect(await crvRewards.symbol()).eq(`${await auraBPT.symbol()}-vault`);
        });
        it("does not support transfer or transferFrom", async () => {
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            await expect(crvRewards.transfer(deployerAddress, 1)).to.be.revertedWith("ERC4626: Not supported");
            await expect(crvRewards.transferFrom(deployerAddress, deployerAddress, 1)).to.be.revertedWith(
                "ERC4626: Not supported",
            );
        });
        it("does support approval and allowances", async () => {
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const tx = await crvRewards.approve(deployerAddress, 1);
            await expect(tx).to.emit(crvRewards, "Approval");

            let allowance = await crvRewards.allowance(aliceAddress, deployerAddress);
            expect(allowance).eq(1);

            await crvRewards.approve(deployerAddress, 0);
            allowance = await crvRewards.allowance(aliceAddress, deployerAddress);
            expect(allowance).eq(0);
        });
    });

    describe("checking flow from crvLP deposits", () => {
        it("allows direct deposits", async () => {
            const amount = ethers.utils.parseEther("10");
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const depositToken = ERC20__factory.connect(pool.token, alice);

            const depositTokenBalanceBefore = await depositToken.balanceOf(pool.crvRewards);
            const balanceBefore = await crvRewards.balanceOf(aliceAddress);
            const totalSupplyBefore = await crvRewards.totalSupply();
            const lpBalanceBefore = await mocks.lptoken.balanceOf(aliceAddress);

            await mocks.lptoken.connect(alice).approve(pool.crvRewards, amount);
            await crvRewards.deposit(amount, aliceAddress);

            const depositTokenBalanceAfter = await depositToken.balanceOf(pool.crvRewards);
            const balanceAfter = await crvRewards.balanceOf(aliceAddress);
            const totalSupplyAfter = await crvRewards.totalSupply();
            const lpBalanceAfter = await mocks.lptoken.balanceOf(aliceAddress);

            expect(balanceAfter.sub(balanceBefore)).eq(amount);
            expect(totalSupplyAfter.sub(totalSupplyBefore)).eq(amount);
            expect(depositTokenBalanceAfter.sub(depositTokenBalanceBefore)).eq(amount);
            expect(lpBalanceBefore.sub(lpBalanceAfter)).eq(amount);
        });

        it("allows direct deposits via mint()", async () => {
            const amount = ethers.utils.parseEther("10");
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const depositToken = ERC20__factory.connect(pool.token, alice);

            const depositTokenBalanceBefore = await depositToken.balanceOf(pool.crvRewards);
            const balanceBefore = await crvRewards.balanceOf(aliceAddress);

            await mocks.lptoken.connect(alice).approve(pool.crvRewards, amount);
            await crvRewards.mint(amount, aliceAddress);

            const depositTokenBalanceAfter = await depositToken.balanceOf(pool.crvRewards);
            const balanceAfter = await crvRewards.balanceOf(aliceAddress);
            expect(balanceAfter.sub(balanceBefore)).eq(amount);
            expect(depositTokenBalanceAfter.sub(depositTokenBalanceBefore)).eq(amount);
        });

        it("allows direct deposits on behalf of alternate reciever", async () => {
            const amount = ethers.utils.parseEther("10");
            const alternateReceiverAddress = await alternateReceiver.getAddress();

            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const balanceBefore = await crvRewards.balanceOf(alternateReceiverAddress);
            const totalSupplyBefore = await crvRewards.totalSupply();

            await mocks.lptoken.connect(alice).approve(pool.crvRewards, amount);
            await crvRewards.deposit(amount, alternateReceiverAddress);

            const balanceAfter = await crvRewards.balanceOf(alternateReceiverAddress);
            const totalSupplyAfter = await crvRewards.totalSupply();
            expect(balanceAfter.sub(balanceBefore)).eq(amount);
            expect(totalSupplyAfter.sub(totalSupplyBefore)).eq(amount);
        });

        it("allows direct withdraws", async () => {
            const amount = ethers.utils.parseEther("10");
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const balanceBefore = await mocks.lptoken.balanceOf(aliceAddress);
            await crvRewards["withdraw(uint256,address,address)"](amount, aliceAddress, aliceAddress);
            const balanceAfter = await mocks.lptoken.balanceOf(aliceAddress);
            expect(balanceAfter.sub(balanceBefore)).eq(amount);
        });

        it("allows direct withdraws via redeem()", async () => {
            const amount = ethers.utils.parseEther("5");
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const balanceBefore = await mocks.lptoken.balanceOf(aliceAddress);
            await crvRewards["redeem(uint256,address,address)"](amount, aliceAddress, aliceAddress);
            const balanceAfter = await mocks.lptoken.balanceOf(aliceAddress);
            expect(balanceAfter.sub(balanceBefore)).eq(amount);
        });

        it("allows withdraws to receipient", async () => {
            const amount = ethers.utils.parseEther("5");
            const alternateReceiverAddress = await alternateReceiver.getAddress();
            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const balanceBefore = await mocks.lptoken.balanceOf(alternateReceiverAddress);
            const rwdBalanaceBefore = await crvRewards.balanceOf(aliceAddress);
            expect(rwdBalanaceBefore).eq(simpleToExactAmount(5));
            await crvRewards["redeem(uint256,address,address)"](amount, alternateReceiverAddress, aliceAddress);
            const balanceAfter = await mocks.lptoken.balanceOf(alternateReceiverAddress);
            expect(balanceAfter.sub(balanceBefore)).eq(amount);
            const rwdBalanaceAfter = await crvRewards.balanceOf(aliceAddress);
            expect(rwdBalanaceAfter).eq(0);
        });

        it("allows direct withdraws for alternate reciever", async () => {
            const amount = ethers.utils.parseEther("10");
            const alternateReceiverAddress = await alternateReceiver.getAddress();

            const crvRewards = BaseRewardPool4626__factory.connect(pool.crvRewards, alice);
            const balanceBefore = await mocks.lptoken.balanceOf(alternateReceiverAddress);
            await crvRewards
                .connect(alternateReceiver)
                ["withdraw(uint256,address,address)"](amount, alternateReceiverAddress, alternateReceiverAddress);
            const balanceAfter = await mocks.lptoken.balanceOf(alternateReceiverAddress);
            expect(balanceAfter.sub(balanceBefore)).eq(amount);
        });
    });

    describe("checking withdrawal using allowance", () => {
        let depositor: Signer;
        let depositorAddress: string;
        let withdrawer: Signer;
        let withdrawerAddress: string;
        let rewardPool: BaseRewardPool4626;
        before(async () => {
            depositor = accounts[2];
            depositorAddress = await depositor.getAddress();
            withdrawer = accounts[3];
            withdrawerAddress = await withdrawer.getAddress();

            rewardPool = BaseRewardPool4626__factory.connect(pool.crvRewards, depositor);

            expect(await rewardPool.balanceOf(depositorAddress)).eq(0);
            expect(await rewardPool.balanceOf(withdrawerAddress)).eq(0);

            await mocks.lptoken.connect(depositor).approve(rewardPool.address, simpleToExactAmount(100));
            await rewardPool.deposit(simpleToExactAmount(10), depositorAddress);
        });
        it("withdrawing someone else requires approval", async () => {
            expect(await rewardPool.allowance(depositorAddress, withdrawerAddress)).eq(0);
            await expect(
                rewardPool
                    .connect(withdrawer)
                    ["withdraw(uint256,address,address)"](1, withdrawerAddress, depositorAddress),
            ).to.be.revertedWith("ERC4626: withdrawal amount exceeds allowance");
        });
        it("allows depositor to approve someone to withdraw", async () => {
            await rewardPool.approve(withdrawerAddress, simpleToExactAmount(5));
            expect(await rewardPool.allowance(depositorAddress, withdrawerAddress)).eq(simpleToExactAmount(5));

            const depositorPoolBalanceBefore = simpleToExactAmount(10);
            const withdrawerPoolBalanceBefore = simpleToExactAmount(0);
            const depositorLPBalanceBefore = await mocks.lptoken.balanceOf(depositorAddress);
            const withdrawerLPBalanceBefore = await mocks.lptoken.balanceOf(withdrawerAddress);
            const allowanceBefore = simpleToExactAmount(5);

            const withdrawalAmount = simpleToExactAmount(4);
            const tx = await rewardPool
                .connect(withdrawer)
                ["withdraw(uint256,address,address)"](withdrawalAmount, withdrawerAddress, depositorAddress);
            await expect(tx)
                .to.emit(rewardPool, "Withdraw")
                .withArgs(withdrawerAddress, withdrawerAddress, depositorAddress, withdrawalAmount, withdrawalAmount);

            const depositorPoolBalanceAfter = await rewardPool.balanceOf(depositorAddress);
            const withdrawerPoolBalanceAfter = await rewardPool.balanceOf(withdrawerAddress);
            const depositorLPBalanceAfter = await mocks.lptoken.balanceOf(depositorAddress);
            const withdrawerLPBalanceAfter = await mocks.lptoken.balanceOf(withdrawerAddress);
            const allowanceAfter = await rewardPool.allowance(depositorAddress, withdrawerAddress);

            expect(depositorPoolBalanceAfter).eq(depositorPoolBalanceBefore.sub(withdrawalAmount));
            expect(withdrawerPoolBalanceAfter).eq(withdrawerPoolBalanceBefore);
            expect(depositorLPBalanceAfter).eq(depositorLPBalanceBefore);
            expect(withdrawerLPBalanceAfter).eq(withdrawerLPBalanceBefore.add(withdrawalAmount));
            expect(allowanceAfter).eq(allowanceBefore.sub(withdrawalAmount));
        });
        it("withdrawing lowers the approval accordingly", async () => {
            expect(await rewardPool.allowance(depositorAddress, withdrawerAddress)).eq(simpleToExactAmount(1));
            await expect(
                rewardPool
                    .connect(withdrawer)
                    ["withdraw(uint256,address,address)"](simpleToExactAmount(2), withdrawerAddress, depositorAddress),
            ).to.be.revertedWith("ERC4626: withdrawal amount exceeds allowance");
            await rewardPool
                .connect(withdrawer)
                ["withdraw(uint256,address,address)"](simpleToExactAmount(1), withdrawerAddress, depositorAddress);
            expect(await rewardPool.allowance(depositorAddress, withdrawerAddress)).eq(0);
            await expect(
                rewardPool
                    .connect(withdrawer)
                    ["withdraw(uint256,address,address)"](simpleToExactAmount(1), withdrawerAddress, depositorAddress),
            ).to.be.revertedWith("ERC4626: withdrawal amount exceeds allowance");
        });
    });
});
