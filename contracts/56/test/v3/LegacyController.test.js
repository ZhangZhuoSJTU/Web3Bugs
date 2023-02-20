const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('LegacyController', () => {
    let deployer, user;
    let t3crv,
        vault,
        manager,
        metavault,
        controller,
        converter,
        legacyController,
        harvester,
        strategy;

    beforeEach(async () => {
        await deployments.fixture('test');
        [deployer, , , user] = await ethers.getSigners();
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);

        const LegacyController = await deployments.get('LegacyController');
        legacyController = await ethers.getContractAt(
            'LegacyController',
            LegacyController.address
        );

        const Converter = await deployments.get('StablesConverter');
        converter = await ethers.getContractAt('StablesConverter', Converter.address);

        const MetaVault = await deployments.get('MetaVault');
        metavault = await ethers.getContractAt('MetaVault', MetaVault.address);

        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);

        const Strategy = await deployments.get('NativeStrategyCurve3Crv');
        strategy = await ethers.getContractAt('NativeStrategyCurve3Crv', Strategy.address);

        const Vault = await deployments.get('VaultStables');
        vault = await ethers.getContractAt('Vault', Vault.address);

        await manager.connect(deployer).setAllowedVault(vault.address, true);
        await manager.connect(deployer).setAllowedStrategy(Strategy.address, true);
        await manager.addVault(vault.address);
        await manager.connect(deployer).setAllowedConverter(converter.address, true);
        await manager.connect(deployer).setAllowedController(legacyController.address, true);
        await manager.connect(deployer).setAllowedController(controller.address, true);
        await manager.connect(deployer).setHarvester(harvester.address);
        await harvester.setHarvester(deployer.address, true);
        await manager.connect(deployer).setController(vault.address, controller.address);
        await controller.connect(deployer).setConverter(vault.address, converter.address);
        await controller.connect(deployer).addStrategy(vault.address, Strategy.address, 0, 0);
        await t3crv.connect(user).faucet(ether('100000'));
        await t3crv.connect(user).approve(metavault.address, ethers.constants.MaxUint256);
        await metavault.connect(deployer).setController(legacyController.address);
    });

    describe('setVault', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                legacyController.connect(user).setVault(vault.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should set the vault if called by the strategist', async () => {
            expect(await legacyController.vault()).to.be.equal(ethers.constants.AddressZero);
            await legacyController.connect(deployer).setVault(vault.address);
            expect(await legacyController.vault()).to.be.equal(vault.address);
        });
    });

    describe('setConverter', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                legacyController.connect(user).setConverter(converter.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should set the vault if called by the strategist', async () => {
            expect(await legacyController.converter()).to.be.equal(
                ethers.constants.AddressZero
            );
            await legacyController.connect(deployer).setConverter(converter.address);
            expect(await legacyController.converter()).to.be.equal(converter.address);
        });
    });

    describe('setInvestEnabled', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                legacyController.connect(user).setInvestEnabled(true)
            ).to.be.revertedWith('!strategist');
        });

        it('should set investEnabled if called by the strategist', async () => {
            expect(await legacyController.investEnabled()).to.be.equal(false);
            await legacyController.connect(deployer).setInvestEnabled(true);
            expect(await legacyController.investEnabled()).to.be.equal(true);
        });
    });

    describe('withdrawFee', () => {
        it('should return the value from the manager', async () => {
            expect(
                await legacyController.withdrawFee(t3crv.address, ether('1000'))
            ).to.be.equal(ether('1'));
        });
    });

    describe('earn', () => {
        beforeEach(async () => {
            await legacyController.connect(deployer).setConverter(converter.address);
            await legacyController.connect(deployer).setVault(vault.address);
            await legacyController.connect(deployer).setInvestEnabled(true);
        });

        it('should revert if called by an address other than the metavault', async () => {
            await expect(
                legacyController.connect(user).earn(ethers.constants.AddressZero, 0)
            ).to.be.revertedWith('!metavault');
        });

        it('should be called on deposit to metavault', async () => {
            await expect(
                metavault.connect(user).deposit(ether('1000'), t3crv.address, 1, false)
            ).to.emit(legacyController, 'Earn');
            expect(await legacyController.balanceOf(t3crv.address)).to.be.equal(ether('950'));
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            await legacyController.connect(deployer).setConverter(converter.address);
            await legacyController.connect(deployer).setVault(vault.address);
            await legacyController.connect(deployer).setInvestEnabled(true);
            await metavault.connect(user).deposit(ether('1000'), t3crv.address, 1, false);
        });

        it('should withdraw the balance from the legacy controller if possible', async () => {
            expect(await t3crv.balanceOf(user.address)).to.be.equal(ether('99000'));
            await expect(
                metavault.connect(user).withdraw(ether('1000'), t3crv.address)
            ).to.emit(legacyController, 'Withdraw');
            expect(await t3crv.balanceOf(user.address)).to.be.equal(ether('100000'));
        });

        describe('when withdrawing from a strategy', () => {
            beforeEach(async () => {
                expect(await strategy.balanceOf()).to.be.equal(0);
                await harvester.connect(deployer).legacyEarn(1);
                await expect(
                    harvester.connect(deployer).earn(strategy.address, vault.address)
                ).to.emit(vault, 'Earn');
                expect(await strategy.balanceOf()).to.be.above(ether('900'));
            });

            it('should withdraw', async () => {
                const startingBalance = await t3crv.balanceOf(user.address);
                await metavault.connect(user).withdrawAll(t3crv.address);
                const endingBalance = await t3crv.balanceOf(user.address);
                expect(endingBalance).to.be.above(startingBalance);
                expect(await strategy.balanceOf()).to.be.below(ether('2'));
            });
        });
    });
});
