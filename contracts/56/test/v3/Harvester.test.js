const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Harvester', () => {
    let deployer, treasury, user;
    let vault,
        legacyController,
        manager,
        controller,
        harvester,
        strategyCrv,
        converter,
        dai,
        t3crv,
        crv,
        yax,
        weth,
        unirouter;

    beforeEach(async () => {
        await deployments.fixture('test');
        [deployer, treasury, , user] = await ethers.getSigners();
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const CRV = await deployments.get('CRV');
        crv = await ethers.getContractAt('MockERC20', CRV.address);
        const WETH = await deployments.get('WETH');
        weth = await ethers.getContractAt('MockERC20', WETH.address);
        const YAX = await deployments.get('YaxisToken');
        yax = await ethers.getContractAt('MockERC20', YAX.address);
        const router = await deployments.get('MockUniswapRouter');
        unirouter = await ethers.getContractAt('MockUniswapRouter', router.address);
        converter = await deployments.get('StablesConverter');
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const LegacyController = await deployments.get('LegacyController');
        legacyController = await ethers.getContractAt(
            'LegacyController',
            LegacyController.address
        );
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);
        const StrategyCrv = await deployments.get('NativeStrategyCurve3Crv');
        strategyCrv = await ethers.getContractAt(
            'NativeStrategyCurve3Crv',
            StrategyCrv.address,
            deployer
        );
        const Vault = await deployments.get('VaultStables');
        vault = await ethers.getContractAt('Vault', Vault.address);

        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);
        await manager.connect(treasury).setAllowedController(controller.address, true);
        await manager.connect(treasury).setAllowedController(legacyController.address, true);
        await manager.setController(vault.address, controller.address);
        await manager.connect(treasury).setAllowedConverter(converter.address, true);
        await controller.connect(deployer).setConverter(vault.address, converter.address);
        await manager.connect(treasury).setHarvester(harvester.address);
        await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
        await manager.addVault(vault.address);
        await harvester.setHarvester(deployer.address, true);
    });

    it('should deploy with expected state', async () => {
        expect(await harvester.manager()).to.equal(manager.address);
        expect(await harvester.controller()).to.equal(controller.address);
        expect(await harvester.legacyController()).to.equal(legacyController.address);
    });

    describe('addStrategy', () => {
        it('should revert when called by an address other than controller', async () => {
            await expect(
                harvester.connect(user).addStrategy(vault.address, strategyCrv.address, 1)
            ).to.be.revertedWith('!controller');
        });

        it('should add the strategy when called by the controller', async () => {
            await expect(controller.addStrategy(vault.address, strategyCrv.address, 0, 86400))
                .to.emit(harvester, 'StrategyAdded')
                .withArgs(vault.address, strategyCrv.address, 86400);
        });
    });

    describe('removeStrategy', () => {
        beforeEach(async () => {
            await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
        });

        it('should revert when called by an address other than controller', async () => {
            await expect(
                harvester.connect(user).removeStrategy(vault.address, strategyCrv.address, 1)
            ).to.be.revertedWith('!controller');
        });

        it('should add the strategy when called by the controller', async () => {
            await expect(controller.removeStrategy(vault.address, strategyCrv.address, 86400))
                .to.emit(harvester, 'StrategyRemoved')
                .withArgs(vault.address, strategyCrv.address, 86400);
        });

        it('should do nothing if strategy isnt added to harvester', async () => {
            const NewHarvester = await ethers.getContractFactory('Harvester');
            const newHarvester = await NewHarvester.deploy(
                manager.address,
                controller.address,
                legacyController.address
            );
            await manager.connect(treasury).setHarvester(newHarvester.address);
            await expect(
                controller.removeStrategy(vault.address, strategyCrv.address, 86400)
            ).to.not.emit(harvester, 'StrategyRemoved');
        });
    });

    describe('setHarvester', () => {
        it('should revert when called by an address other than the strategist', async () => {
            await expect(
                harvester.connect(user).setHarvester(user.address, true)
            ).to.be.revertedWith('!strategist');
        });

        it('should set harvester when called by the strategist', async () => {
            expect(await harvester.isHarvester(user.address)).to.be.false;
            await expect(harvester.setHarvester(user.address, true))
                .to.emit(harvester, 'HarvesterSet')
                .withArgs(user.address, true);
            expect(await harvester.isHarvester(user.address)).to.be.true;
            await expect(harvester.setHarvester(user.address, false))
                .to.emit(harvester, 'HarvesterSet')
                .withArgs(user.address, false);
            expect(await harvester.isHarvester(user.address)).to.be.false;
        });
    });

    describe('setSlippage', () => {
        it('should revert when called by an address other than the strategist', async () => {
            await expect(harvester.connect(user).setSlippage(1)).to.be.revertedWith(
                '!strategist'
            );
        });

        it('should revert when slippage is over 10000', async () => {
            await expect(harvester.setSlippage(10001)).to.be.revertedWith('!_slippage');
        });

        it('should set slippage when called by the strategist', async () => {
            await harvester.setSlippage(1);
            expect(await harvester.slippage()).to.equal(1);
        });
    });

    describe('earn', () => {
        beforeEach(async () => {
            await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
            await dai.connect(user).faucet(1000);
            await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
            await vault.connect(user).deposit(1000);
        });

        it('should revert when called by an address other than the harvester', async () => {
            await expect(
                harvester.connect(user).earn(strategyCrv.address, vault.address)
            ).to.be.revertedWith('!harvester');
        });

        it('should pass when called by the harvester', async () => {
            await harvester.earn(strategyCrv.address, vault.address);
        });
    });

    describe('harvest', () => {
        beforeEach(async () => {
            await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
            await dai.connect(user).faucet(1000);
            await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
            await vault.connect(user).deposit(1000);
            await harvester.earn(strategyCrv.address, vault.address);
            await dai.connect(user).faucet(1000);
            await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
            await vault.connect(user).deposit(1000);
            await harvester.earn(strategyCrv.address, vault.address);
            await crv.faucet(ether('1000'));
            await weth.faucet(ether('2000'));
            await dai.faucet(ether('1000'));

            await crv.transfer(unirouter.address, ether('1000'));
            await dai.transfer(unirouter.address, ether('1000'));
            await weth.transfer(unirouter.address, ether('2000'));
            await yax.connect(deployer).transfer(unirouter.address, ether('1000'));
        });

        it('should revert when called by an address other than the harvester', async () => {
            await expect(
                harvester.connect(user).harvest(controller.address, strategyCrv.address, 0, 0)
            ).to.be.revertedWith('!harvester');
        });

        it('should pass when called by the harvester', async () => {
            await harvester.harvest(controller.address, strategyCrv.address, 0, 0);
        });
    });

    describe('harvestNextStrategy', () => {
        beforeEach(async () => {
            await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
            await dai.connect(user).faucet(1000);
            await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
            await vault.connect(user).deposit(1000);
            await harvester.earn(strategyCrv.address, vault.address);
            await dai.connect(user).faucet(1000);
            await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
            await vault.connect(user).deposit(1000);
            await harvester.earn(strategyCrv.address, vault.address);
            await crv.faucet(ether('1000'));
            await weth.faucet(ether('2000'));
            await dai.faucet(ether('1000'));

            await crv.transfer(unirouter.address, ether('1000'));
            await dai.transfer(unirouter.address, ether('1000'));
            await weth.transfer(unirouter.address, ether('2000'));
            await yax.connect(deployer).transfer(unirouter.address, ether('1000'));
        });

        it('should revert if vault does not exist', async () => {
            await expect(
                harvester.harvestNextStrategy(ethers.constants.AddressZero, 0, 0)
            ).to.be.revertedWith('!canHarvest');

            // TODO: Also check if harvested within certain time
            // TODO: Check if passes after waiting a certain time
        });

        it('should revert when called by an address other than the harvester', async () => {
            await expect(
                harvester.connect(user).harvestNextStrategy(vault.address, 0, 0)
            ).to.be.revertedWith('!harvester');
        });

        it('should pass when called by the harvester', async () => {
            await harvester.harvest(controller.address, strategyCrv.address, 0, 0);
            // TODO: Check that addresses in strategies decreases
        });
    });

    describe('legacyEarn', () => {
        beforeEach(async () => {
            await t3crv.connect(user).faucet(ether('100000'));
            await t3crv.connect(user).transfer(legacyController.address, ether('1000'));
            await legacyController.connect(deployer).setConverter(converter.address);
            await legacyController.connect(deployer).setVault(vault.address);
            await legacyController.connect(deployer).setInvestEnabled(true);
        });

        it('should revert when called by an address other than the harvester', async () => {
            await expect(harvester.connect(user).legacyEarn(0)).to.be.revertedWith(
                '!harvester'
            );
        });

        it('should pass when called by the harvester', async () => {
            await harvester.connect(deployer).legacyEarn(0);
        });
    });
});
