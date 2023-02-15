const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('VaultHelper', () => {
    let deployer, treasury, user;
    let dai,
        usdc,
        usdt,
        manager,
        vault,
        vaultToken,
        controller,
        gauge,
        gaugeController,
        vaultHelper;

    beforeEach(async () => {
        await deployments.fixture('test');
        [deployer, treasury, , user] = await ethers.getSigners();
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const VaultToken = await deployments.get('VaultToken');
        vaultToken = await ethers.getContractAt('VaultToken', VaultToken.address);
        const Vault = await deployments.get('VaultStables');
        vault = await ethers.getContractAt('Vault', Vault.address);
        const Gauge = await deployments.get('VaultStablesGauge');
        gauge = await ethers.getContractAt('LiquidityGaugeV2', Gauge.address);
        const GaugeController = await deployments.get('GaugeController');
        gaugeController = await ethers.getContractAt(
            'GaugeController',
            GaugeController.address
        );
        const VaultHelper = await deployments.get('VaultHelper');
        vaultHelper = await ethers.getContractAt('VaultHelper', VaultHelper.address);

        await dai.connect(user).faucet(ether('100000000'));
        await usdc.connect(user).faucet('100000000000000');
        await dai.connect(user).approve(VaultHelper.address, ethers.constants.MaxUint256);
        await usdc.connect(user).approve(VaultHelper.address, ethers.constants.MaxUint256);
        await usdt.connect(user).approve(VaultHelper.address, ethers.constants.MaxUint256);
        await gauge.connect(user).approve(VaultHelper.address, ethers.constants.MaxUint256);
        await vaultToken
            .connect(user)
            .approve(VaultHelper.address, ethers.constants.MaxUint256);
        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);
        await manager.connect(treasury).setAllowedController(controller.address, true);
        await manager.setController(vault.address, controller.address);
        await manager.addVault(vault.address);
        await gaugeController['add_type(string,uint256)']('vault', ether('1'));
        await gaugeController['add_gauge(address,int128,uint256)'](
            gauge.address,
            0,
            ether('1')
        );
        await vault.connect(deployer).setGauge(gauge.address);
    });

    describe('depositVault', () => {
        context('when the gauge is set', () => {
            it('should give gauge tokens to the user', async () => {
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(0);
                expect(await gauge.balanceOf(user.address)).to.be.equal(0);
                await vaultHelper.connect(user).depositVault(vault.address, ether('100'));
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(0);
                expect(await gauge.balanceOf(user.address)).to.be.equal(ether('100'));
            });
        });

        context('when the gauge is unset', () => {
            beforeEach(async () => {
                await vault.connect(deployer).setGauge(ethers.constants.AddressZero);
            });

            it('should give vault tokens to the user', async () => {
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(0);
                expect(await gauge.balanceOf(user.address)).to.be.equal(0);
                await vaultHelper.connect(user).depositVault(vault.address, ether('100'));
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(ether('100'));
                expect(await gauge.balanceOf(user.address)).to.be.equal(0);
            });
        });
    });

    describe('withdrawVault', () => {
        context('when the gauge is set', () => {
            beforeEach(async () => {
                await vaultHelper.connect(user).depositVault(vault.address, ether('100'));
                expect(await gauge.balanceOf(user.address)).to.be.equal(ether('100'));
            });

            it('should withdraw from the gauge and vault', async () => {
                await vaultHelper.connect(user).withdrawVault(vault.address, ether('100'));
                expect(await gauge.balanceOf(user.address)).to.be.equal(0);
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(0);
                expect(await dai.balanceOf(user.address)).to.be.equal(ether('99999999.9'));
            });
        });

        context('when the gauge is unset', () => {
            beforeEach(async () => {
                await vault.connect(deployer).setGauge(ethers.constants.AddressZero);
                await vaultHelper.connect(user).depositVault(vault.address, ether('100'));
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(ether('100'));
            });

            it('should withdraw from the vault', async () => {
                await vaultHelper.connect(user).withdrawVault(vault.address, ether('100'));
                expect(await gauge.balanceOf(user.address)).to.be.equal(0);
                expect(await vaultToken.balanceOf(user.address)).to.be.equal(0);
                expect(await dai.balanceOf(user.address)).to.be.equal(ether('99999999.9'));
            });
        });
    });
});
