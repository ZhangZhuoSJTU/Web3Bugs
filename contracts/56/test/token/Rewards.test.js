const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { increaseTime } = require('../helpers/setup');

describe('Rewards', () => {
    const emptyBytes = '0x00';
    const oneDay = 86400;
    const oneYear = 31556952;
    let deployer, user;
    let yaxis, staking, rewards;

    beforeEach(async () => {
        [deployer, , , user] = await ethers.getSigners();

        const YaxisToken = await ethers.getContractFactory('YaxisToken');
        yaxis = await YaxisToken.deploy();
        await yaxis.deployed();

        const Staking = await ethers.getContractFactory('MockERC677');
        staking = await Staking.deploy('Staking Contract', 'ST');
        await staking.deployed();
        await staking.mint(user.address, ether('100'));

        const Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(yaxis.address, staking.address, oneYear);
        await rewards.deployed();
    });

    it('should deploy with initial state set', async () => {
        expect(await rewards.rewardToken()).to.be.equal(yaxis.address);
        expect(await rewards.stakingToken()).to.be.equal(staking.address);
        expect(await rewards.duration()).to.be.equal(oneYear);
    });

    describe('setRewardDistribution', () => {
        it('should revert when called by a non-owner', async () => {
            await expect(
                rewards.connect(user).setRewardDistribution(user.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should set when called by the owner', async () => {
            await rewards.connect(deployer).setRewardDistribution(deployer.address);
        });
    });

    describe('notifyRewardAmount', () => {
        it('should revert when called by the non-rewardDistribution address', async () => {
            await expect(rewards.connect(user).notifyRewardAmount(0)).to.be.revertedWith(
                'Caller is not reward distribution'
            );
        });

        context('when called by the rewardDistribution address', () => {
            beforeEach(async () => {
                await rewards.connect(deployer).setRewardDistribution(deployer.address);
            });

            it('should set the reward to 0 when unfunded', async () => {
                await expect(rewards.connect(deployer).notifyRewardAmount(0))
                    .to.emit(rewards, 'RewardAdded')
                    .withArgs(0);
            });
        });
    });

    describe('onTokenTransfer', () => {
        let fake;

        beforeEach(async () => {
            const Fake = await ethers.getContractFactory('MockERC677');
            fake = await Fake.deploy('Staking Contract', 'ST');
            await fake.deployed();
            await fake.mint(user.address, ether('100'));
        });

        it('should revert when called by a fake token', async () => {
            await expect(
                fake.connect(user).transferAndCall(rewards.address, 1, emptyBytes)
            ).to.be.revertedWith('!stakingToken');
        });
    });

    describe('over funding', () => {
        it('should allow over funding', async () => {
            await rewards.connect(deployer).setRewardDistribution(deployer.address);
            await yaxis.connect(deployer).transfer(rewards.address, ether('10000'));
            await expect(rewards.connect(deployer).notifyRewardAmount(ether('1000')))
                .to.emit(rewards, 'RewardAdded')
                .withArgs(ether('1000'));
            await staking.connect(user).approve(rewards.address, ethers.constants.MaxUint256);
            await rewards.connect(user).stake(ether('100'));
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            let earnedA = await rewards.earned(user.address);
            await increaseTime(oneYear / 4);
            let earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.above(earnedA);
            await increaseTime(oneYear / 4);
            earnedA = await rewards.earned(user.address);
            expect(earnedA).to.be.above(earnedB);
            await increaseTime(oneYear / 4);
            earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.above(earnedA);
            await increaseTime(oneYear / 4);
            earnedA = await rewards.earned(user.address);
            expect(earnedA).to.be.above(earnedB);
            // go over duration just in case
            await increaseTime(oneDay);
            earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.equal(earnedA);
            const balance = await yaxis.balanceOf(user.address);
            await expect(rewards.connect(user).exit()).to.emit(rewards, 'RewardPaid');
            expect(await staking.balanceOf(user.address)).to.be.equal(ether('100'));
            expect(await yaxis.balanceOf(user.address)).to.be.above(balance);
            expect(await yaxis.balanceOf(user.address)).to.be.below(ether('1000'));
        });
    });

    describe('integration', () => {
        beforeEach(async () => {
            await rewards.connect(deployer).setRewardDistribution(deployer.address);
            await yaxis.connect(deployer).transfer(rewards.address, ether('1000'));
            await expect(rewards.connect(deployer).notifyRewardAmount(ether('1000')))
                .to.emit(rewards, 'RewardAdded')
                .withArgs(ether('1000'));
        });

        it('should allow funding by owner, staking and claiming by users', async () => {
            await staking.connect(user).approve(rewards.address, ethers.constants.MaxUint256);
            await rewards.connect(user).stake(ether('100'));
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            let earnedA = await rewards.earned(user.address);
            await increaseTime(oneYear / 4);
            let earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.above(earnedA);
            await increaseTime(oneYear / 4);
            earnedA = await rewards.earned(user.address);
            expect(earnedA).to.be.above(earnedB);
            await increaseTime(oneYear / 4);
            earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.above(earnedA);
            await increaseTime(oneYear / 4);
            earnedA = await rewards.earned(user.address);
            expect(earnedA).to.be.above(earnedB);
            // go over duration just in case
            await increaseTime(oneDay);
            earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.equal(earnedA);
            const balance = await yaxis.balanceOf(user.address);
            await expect(rewards.connect(user).exit()).to.emit(rewards, 'RewardPaid');
            expect(await staking.balanceOf(user.address)).to.be.equal(ether('100'));
            expect(await yaxis.balanceOf(user.address)).to.be.above(balance);
        });

        it('should allow periodic claiming', async () => {
            await staking.connect(user).approve(rewards.address, ethers.constants.MaxUint256);
            const startingBalance = await yaxis.balanceOf(user.address);
            await rewards.connect(user).stake(ether('100'));
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            let balanceA = await yaxis.balanceOf(user.address);
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            let balanceB = await yaxis.balanceOf(user.address);
            expect(balanceB).to.be.above(balanceA);
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            balanceA = await yaxis.balanceOf(user.address);
            expect(balanceA).to.be.above(balanceB);
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            balanceB = await yaxis.balanceOf(user.address);
            expect(balanceB).to.be.above(balanceA);
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            balanceA = await yaxis.balanceOf(user.address);
            expect(balanceA).to.be.above(balanceB);
            const balance = await yaxis.balanceOf(user.address);
            await rewards.connect(user).exit();
            expect(await staking.balanceOf(user.address)).to.be.equal(ether('100'));
            expect(await yaxis.balanceOf(user.address)).to.be.equal(balance);
            expect(await yaxis.balanceOf(user.address)).to.be.above(startingBalance);
        });

        it('should allow depositing by transferAndCall and claiming', async () => {
            const startingBalance = await yaxis.balanceOf(user.address);
            await staking
                .connect(user)
                .transferAndCall(rewards.address, ether('100'), emptyBytes);
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await rewards.connect(user).exit();
            expect(await staking.balanceOf(user.address)).to.be.equal(ether('100'));
            expect(await yaxis.balanceOf(user.address)).to.be.above(startingBalance);
        });

        it('should allow extending duration after completion', async () => {
            await staking
                .connect(user)
                .transferAndCall(rewards.address, ether('100'), emptyBytes);
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            const firstPeriod = await rewards.periodFinish();
            await increaseTime(oneDay + oneYear);
            await yaxis.connect(deployer).transfer(rewards.address, ether('1000'));
            await expect(rewards.connect(deployer).notifyRewardAmount(ether('1000')))
                .to.emit(rewards, 'RewardAdded')
                .withArgs(ether('1000'));
            expect(await rewards.periodFinish()).to.be.above(firstPeriod);
        });

        it('should allow extending duration before completion', async () => {
            await staking
                .connect(user)
                .transferAndCall(rewards.address, ether('100'), emptyBytes);
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            const firstPeriod = await rewards.periodFinish();
            await increaseTime(oneYear / 2);
            await yaxis.connect(deployer).transfer(rewards.address, ether('1000'));
            await expect(rewards.connect(deployer).notifyRewardAmount(ether('1000')))
                .to.emit(rewards, 'RewardAdded')
                .withArgs(ether('1000'));
            expect(await rewards.periodFinish()).to.be.above(firstPeriod);
        });

        it('should allow topping up', async () => {
            await staking
                .connect(user)
                .transferAndCall(rewards.address, ether('100'), emptyBytes);
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            await increaseTime(oneYear / 4);
            const startRewardPerToken = await rewards.rewardPerToken();
            await yaxis.connect(deployer).transfer(rewards.address, ether('1000'));
            await expect(rewards.connect(deployer).notifyRewardAmount(ether('1000')))
                .to.emit(rewards, 'RewardAdded')
                .withArgs(ether('1000'));
            expect(await rewards.rewardPerToken()).to.be.above(startRewardPerToken);
            await increaseTime(oneDay);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
        });
    });
});
