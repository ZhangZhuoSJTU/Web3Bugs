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
    let controller,
        dai,
        gaugeController,
        gaugeProxy,
        manager,
        minter,
        minterWrapper,
        vaultStables,
        vaultStablesGauge,
        votingEscrow,
        yaxis;

    before(async () => {
        await deployments.fixture('v3');
        [deployer, treasury, user] = await ethers.getSigners();
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const YAXIS = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('YaxisToken', YAXIS.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
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
        const VaultStables = await deployments.get('VaultStables');
        vaultStables = await ethers.getContractAt('Vault', VaultStables.address);
        const VaultStablesGauge = await deployments.get('VaultStablesGauge');
        vaultStablesGauge = await ethers.getContractAt(
            'LiquidityGaugeV2',
            VaultStablesGauge.address
        );
    });

    it('should deploy with expected state', async () => {
        expect(await gaugeController.admin()).to.be.equal(deployer.address);
        expect(await gaugeController.future_admin()).to.be.equal(treasury.address);
        expect(await gaugeController.token()).to.be.equal(yaxis.address);
        expect(await gaugeController.voting_escrow()).to.be.equal(votingEscrow.address);
        expect(await gaugeController.n_gauges()).to.be.equal(1);
        expect(await gaugeController.n_gauge_types()).to.be.equal(1);
        expect(await minter.token()).to.be.equal(minterWrapper.address);
        expect(await minter.controller()).to.be.equal(gaugeController.address);
        expect(await minterWrapper.token()).to.be.equal(yaxis.address);
        expect(await vaultStablesGauge.crv_token()).to.be.equal(minterWrapper.address);
        expect(await vaultStablesGauge.lp_token()).to.be.equal(vaultStables.address);
        expect(await vaultStablesGauge.controller()).to.be.equal(gaugeController.address);
        expect(await vaultStablesGauge.admin()).to.be.equal(gaugeProxy.address);
        expect(await vaultStablesGauge.minter()).to.be.equal(minter.address);
        expect(await vaultStables.getPricePerFullShare()).to.equal(0);
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
        expect(await gaugeController.get_gauge_weight(vaultStablesGauge.address)).to.be.equal(
            ether('1')
        );
        await gaugeController.vote_for_gauge_weights(vaultStablesGauge.address, 10000);
        expect(await gaugeController.get_gauge_weight(vaultStablesGauge.address)).to.be.above(
            ether('0.97')
        );
    });

    it('should allow users to stake vault tokens in a gauge', async () => {
        await increaseTime(86400 * 7);
        await manager.connect(deployer).setAllowedController(controller.address, true);
        await manager.connect(deployer).setAllowedVault(vaultStables.address, true);
        await manager.connect(deployer).setAllowedToken(dai.address, true);
        await manager
            .connect(deployer)
            .setController(vaultStables.address, controller.address);
        await manager.connect(deployer).addToken(vaultStables.address, dai.address);
        await dai.connect(user).faucet(ether('1000'));
        await dai.connect(user).approve(vaultStables.address, ethers.constants.MaxUint256);
        await vaultStables.connect(user).deposit(dai.address, ether('1000'));
        expect(await vaultStables.balanceOf(user.address)).to.be.equal(ether('1000'));
        await vaultStables
            .connect(user)
            .approve(vaultStablesGauge.address, ethers.constants.MaxUint256);
        expect(await vaultStablesGauge.balanceOf(user.address)).to.be.equal(0);
        await vaultStablesGauge
            .connect(user)
            ['deposit(uint256,address)'](ether('1000'), user.address);
        expect(await vaultStablesGauge.balanceOf(user.address)).to.be.equal(ether('1000'));
    });

    it('should allow users to earn rewards', async () => {
        expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
        await increaseTime(86400 * 30);

        await expect(minter.connect(user).mint(vaultStablesGauge.address)).to.emit(
            minter,
            'Minted'
        );
        expect(await yaxis.balanceOf(user.address)).to.be.above(0);
    });
});
