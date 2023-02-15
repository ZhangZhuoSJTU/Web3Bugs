const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { increaseTime } = require('../helpers/setup');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Gauges', () => {
    const MAXTIME = 1 * 365 * 86400;
    let deployer, treasury, user;
    let t3crv,
        gaugeController,
        gaugeProxy,
        minter,
        minterWrapper,
        vault3Crv,
        vault3CrvGauge,
        vault3CrvToken,
        votingEscrow,
        yaxis;

    before(async () => {
        await deployments.fixture('v3');
        [deployer, treasury, user] = await ethers.getSigners();
        const YAXIS = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('YaxisToken', YAXIS.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const GaugeController = await deployments.get('GaugeController');
        gaugeController = await ethers.getContractAt(
            'GaugeController',
            GaugeController.address,
            deployer
        );
        const GaugeProxy = await deployments.get('GaugeProxy');
        gaugeProxy = await ethers.getContractAt('GaugeProxy', GaugeProxy.address);
        const VotingEscrow = await deployments.get('VotingEscrow');
        votingEscrow = await ethers.getContractAt('VotingEscrow', VotingEscrow.address);
        const MinterWrapper = await deployments.get('MinterWrapper');
        minterWrapper = await ethers.getContractAt('MinterWrapper', MinterWrapper.address);
        const Minter = await deployments.get('Minter');
        minter = await ethers.getContractAt('Minter', Minter.address);
        const Vault3CRVToken = await deployments.get('VaultToken3CRV');
        vault3CrvToken = await ethers.getContractAt('VaultToken', Vault3CRVToken.address);
        const Vault3CRV = await deployments.get('Vault3CRV');
        vault3Crv = await ethers.getContractAt('Vault', Vault3CRV.address);
        const Vault3CRVGauge = await deployments.get('Vault3CRVGauge');
        vault3CrvGauge = await ethers.getContractAt(
            'LiquidityGaugeV2',
            Vault3CRVGauge.address
        );
    });

    it('should deploy with expected state', async () => {
        expect(await gaugeController.admin()).to.be.equal(deployer.address);
        expect(await gaugeController.future_admin()).to.be.equal(treasury.address);
        expect(await gaugeController.token()).to.be.equal(yaxis.address);
        expect(await gaugeController.voting_escrow()).to.be.equal(votingEscrow.address);
        expect(await gaugeController.n_gauges()).to.be.above(0);
        expect(await gaugeController.n_gauge_types()).to.be.equal(1);
        expect(await minter.token()).to.be.equal(minterWrapper.address);
        expect(await minter.controller()).to.be.equal(gaugeController.address);
        expect(await minterWrapper.token()).to.be.equal(yaxis.address);
        expect(await vault3CrvGauge.crv_token()).to.be.equal(minterWrapper.address);
        expect(await vault3CrvGauge.lp_token()).to.be.equal(vault3CrvToken.address);
        expect(await vault3CrvGauge.controller()).to.be.equal(gaugeController.address);
        expect(await vault3CrvGauge.admin()).to.be.equal(gaugeProxy.address);
        expect(await vault3CrvGauge.minter()).to.be.equal(minter.address);
        expect(await vault3Crv.getPricePerFullShare()).to.equal(0);
    });

    it('should fund the minterWrapper with YAXIS', async () => {
        expect(await yaxis.balanceOf(minterWrapper.address)).to.be.equal(0);
        await yaxis.connect(deployer).transfer(minterWrapper.address, ether('10000'));
        expect(await yaxis.balanceOf(minterWrapper.address)).to.be.equal(ether('10000'));
    });

    it('should allow users to lock tokens in voting escrow', async () => {
        expect(await votingEscrow['balanceOf(address)'](deployer.address)).to.be.equal(0);
        await yaxis.approve(votingEscrow.address, ethers.constants.MaxUint256);
        const block = await ethers.provider.getBlockNumber();
        const { timestamp } = await ethers.provider.getBlock(block);
        await votingEscrow.create_lock(ether('1'), timestamp + MAXTIME);
        expect(await votingEscrow['balanceOf(address)'](deployer.address)).to.be.above(
            ether('0.98')
        );
    });

    it('should allow users to vote for a gauge', async () => {
        expect(await gaugeController.get_gauge_weight(vault3CrvGauge.address)).to.be.equal(
            ether('1')
        );
        await gaugeController.vote_for_gauge_weights(vault3CrvGauge.address, 10000);
        expect(await gaugeController.get_gauge_weight(vault3CrvGauge.address)).to.be.above(
            ether('0.97')
        );
    });

    it('should allow users to stake vault tokens in a gauge', async () => {
        await increaseTime(86400 * 7);
        await t3crv.connect(user).faucet(ether('1000'));
        await t3crv.connect(user).approve(vault3Crv.address, ethers.constants.MaxUint256);
        await vault3Crv.connect(user).deposit(ether('1000'));
        expect(await vault3CrvToken.balanceOf(user.address)).to.be.equal(ether('1000'));
        await vault3CrvToken
            .connect(user)
            .approve(vault3CrvGauge.address, ethers.constants.MaxUint256);
        expect(await vault3CrvGauge.balanceOf(user.address)).to.be.equal(0);
        await vault3CrvGauge
            .connect(user)
            ['deposit(uint256,address)'](ether('1000'), user.address);
        expect(await vault3CrvGauge.balanceOf(user.address)).to.be.equal(ether('1000'));
    });
});
