const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestGovernance } = require('../helpers/setup');

describe('YaxisVotePower', () => {
    const emptyBytes = '0x00';
    let vp, yaxis, rewardsYaxis, pair, weth, rewardsYaxisEth, deployer, user;

    beforeEach(async () => {
        const config = await setupTestGovernance();
        [deployer, , , user] = await ethers.getSigners();
        yaxis = config.yaxis;
        rewardsYaxis = config.rewardsYaxis;
        rewardsYaxisEth = config.rewardsYaxisEth;
        pair = config.pair;
        weth = config.weth;

        const VP = await deployments.get('YaxisVoteProxy');
        vp = await ethers.getContractAt('YaxisVoteProxy', VP.address);

        await weth.faucet(ether('100'));
    });

    it('should calculate voting power', async () => {
        expect(await vp.balanceOf(user.address)).to.be.equal(0);
        expect(await vp.balanceOf(deployer.address)).to.be.above(ether('2915'));
    });

    context('when the user is staking YAXIS in Rewards', () => {
        beforeEach(async () => {
            await yaxis.connect(deployer).transfer(user.address, ether('50'));
            await yaxis
                .connect(user)
                .transferAndCall(rewardsYaxis.address, ether('50'), emptyBytes);
        });

        it('should calculate voting power', async () => {
            expect(await vp.balanceOf(user.address)).to.be.above(ether('7'));
        });
    });

    context('when the user is staking LP in Rewards', () => {
        beforeEach(async () => {
            await weth.connect(deployer).mint(user.address, ether('10'));
            await yaxis.connect(deployer).transfer(user.address, ether('10'));
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('10'));
            await weth.connect(user).approve(pair.address, ethers.constants.MaxUint256);
            await yaxis.connect(user).approve(pair.address, ethers.constants.MaxUint256);
            await pair.connect(user).addLiquidity(ether('10'), ether('10'), ether('20'));
        });

        it('should not count unstaked LP', async () => {
            expect(await vp.balanceOf(user.address)).to.be.equal(0);
        });

        it('should calculate voting power', async () => {
            await pair
                .connect(user)
                .approve(rewardsYaxisEth.address, ethers.constants.MaxUint256);
            await rewardsYaxisEth.connect(user).stake(ether('10'));
            expect(await vp.balanceOf(user.address)).to.be.above(ether('2'));
        });
    });
});
