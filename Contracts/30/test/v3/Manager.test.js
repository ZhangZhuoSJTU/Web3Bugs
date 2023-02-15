const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { increaseTime } = require('../helpers/setup');

describe('Manager', () => {
    let deployer, treasury, user;
    let dai, usdc, usdt, t3crv, yaxis;
    let manager, controller, converter, harvester;

    beforeEach(async () => {
        await deployments.fixture('test');
        [deployer, treasury, , user] = await ethers.getSigners();
        const YAXIS = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('MockERC20', YAXIS.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const Converter = await deployments.get('StablesConverter');
        converter = await ethers.getContractAt('StablesConverter', Converter.address);
    });

    it('should deploy with expected state', async () => {
        expect(await manager.yaxis()).to.equal(yaxis.address);
        expect(await manager.governance()).to.equal(deployer.address);
        expect(await manager.strategist()).to.equal(deployer.address);
        expect(await manager.harvester()).to.equal(deployer.address);
        expect(await manager.treasury()).to.equal(deployer.address);
        expect(await manager.stakingPoolShareFee()).to.equal(2000);
        expect(await manager.treasuryFee()).to.equal(500);
        expect(await manager.withdrawalProtectionFee()).to.equal(10);
    });

    describe('setAllowedController', () => {
        beforeEach(async () => {
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedController(controller.address, true);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedController(controller.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the controller manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewController = await ethers.getContractFactory('Controller');
            const newController = await NewController.deploy(fakeManager.address);
            await expect(
                manager.connect(treasury).setAllowedController(newController.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedController(controller.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed controller when called by governance', async () => {
            const NewController = await ethers.getContractFactory('Controller');
            const newController = await NewController.deploy(manager.address);
            await expect(
                manager.connect(treasury).setAllowedController(newController.address, true)
            )
                .to.emit(manager, 'AllowedController')
                .withArgs(newController.address, true);
            expect(await manager.allowedControllers(newController.address)).to.be.equal(true);
        });

        it('should unset the allowed controller when called by governance', async () => {
            expect(await manager.allowedControllers(controller.address)).to.be.equal(true);
            await expect(
                manager.connect(treasury).setAllowedController(controller.address, false)
            )
                .to.emit(manager, 'AllowedController')
                .withArgs(controller.address, false);
            expect(await manager.allowedControllers(controller.address)).to.be.equal(false);
        });
    });

    describe('setAllowedConverter', () => {
        beforeEach(async () => {
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedConverter(converter.address, true);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedConverter(converter.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the converter manager is not this manager', async () => {
            const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewConverter = await ethers.getContractFactory('StablesConverter');
            const newConverter = await NewConverter.deploy(
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                stableSwap3Pool.address,
                fakeManager.address
            );
            await expect(
                manager.connect(treasury).setAllowedController(newConverter.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedConverter(converter.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed converter when called by governance', async () => {
            const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            const NewConverter = await ethers.getContractFactory('StablesConverter');
            const newConverter = await NewConverter.deploy(
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                stableSwap3Pool.address,
                manager.address
            );
            await expect(
                manager.connect(treasury).setAllowedConverter(newConverter.address, true)
            )
                .to.emit(manager, 'AllowedConverter')
                .withArgs(newConverter.address, true);
            expect(await manager.allowedConverters(newConverter.address)).to.be.equal(true);
        });

        it('should unset the allowed converter when called by governance', async () => {
            expect(await manager.allowedConverters(converter.address)).to.be.equal(true);
            await expect(
                manager.connect(treasury).setAllowedConverter(converter.address, false)
            )
                .to.emit(manager, 'AllowedConverter')
                .withArgs(converter.address, false);
            expect(await manager.allowedConverters(converter.address)).to.be.equal(false);
        });
    });

    describe('setAllowedStrategy', () => {
        let strategy, crv, weth, gauge, minter, stableSwap3Pool, router;

        beforeEach(async () => {
            stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            weth = await deployments.get('WETH');
            const CRV = await ethers.getContractFactory('MockERC20');
            crv = await CRV.deploy('Curve.fi', 'CRV', 18);
            const Gauge = await ethers.getContractFactory('MockCurveGauge');
            gauge = await Gauge.deploy(t3crv.address);
            const Minter = await ethers.getContractFactory('MockCurveMinter');
            minter = await Minter.deploy(crv.address);
            const Router = await ethers.getContractFactory('MockUniswapRouter');
            router = await Router.deploy(ethers.constants.AddressZero);
            const Strategy = await ethers.getContractFactory('NativeStrategyCurve3Crv');
            strategy = await Strategy.deploy(
                'Original Strategy',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                controller.address,
                manager.address,
                router.address
            );
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedStrategy(strategy.address, true);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedStrategy(strategy.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the strategy manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewStrategy = await ethers.getContractFactory('NativeStrategyCurve3Crv');
            const newStrategy = await NewStrategy.deploy(
                'Bad Strategy',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                controller.address,
                fakeManager.address,
                router.address
            );
            await expect(
                manager.connect(treasury).setAllowedStrategy(newStrategy.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedStrategy(strategy.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed strategy when called by governance', async () => {
            const NewStrategy = await ethers.getContractFactory('NativeStrategyCurve3Crv');
            const newStrategy = await NewStrategy.deploy(
                'New Strategy',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                controller.address,
                manager.address,
                router.address
            );
            await expect(
                manager.connect(treasury).setAllowedStrategy(newStrategy.address, true)
            )
                .to.emit(manager, 'AllowedStrategy')
                .withArgs(newStrategy.address, true);
            expect(await manager.allowedStrategies(newStrategy.address)).to.be.equal(true);
        });

        it('should unset the allowed strategy when called by governance', async () => {
            expect(await manager.allowedStrategies(strategy.address)).to.be.equal(true);
            await expect(manager.connect(treasury).setAllowedStrategy(strategy.address, false))
                .to.emit(manager, 'AllowedStrategy')
                .withArgs(strategy.address, false);
            expect(await manager.allowedStrategies(strategy.address)).to.be.equal(false);
        });
    });

    describe('setAllowedToken', () => {
        let token;

        beforeEach(async () => {
            const Token = await ethers.getContractFactory('MockERC20');
            token = await Token.deploy('Token', 'TKN', 18);
            await manager.connect(deployer).setGovernance(treasury.address);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedToken(token.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedToken(token.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed token when called by governance', async () => {
            await expect(manager.connect(treasury).setAllowedToken(token.address, true))
                .to.emit(manager, 'AllowedToken')
                .withArgs(token.address, true);
            expect(await manager.allowedTokens(token.address)).to.be.equal(true);
        });

        it('should unset the allowed token when called by governance', async () => {
            await manager.connect(treasury).setAllowedToken(token.address, true);
            expect(await manager.allowedTokens(token.address)).to.be.equal(true);
            await expect(manager.connect(treasury).setAllowedToken(token.address, false))
                .to.emit(manager, 'AllowedToken')
                .withArgs(token.address, false);
            expect(await manager.allowedTokens(token.address)).to.be.equal(false);
        });
    });

    describe('setAllowedVault', () => {
        let vault;

        beforeEach(async () => {
            const Vault = await ethers.getContractFactory('Vault');
            vault = await Vault.deploy('Vault', 'V', manager.address);
            await manager.connect(deployer).setGovernance(treasury.address);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedVault(vault.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the vault manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewVault = await ethers.getContractFactory('Vault');
            const newVault = await NewVault.deploy('Bad Vault', 'BV', fakeManager.address);
            await expect(
                manager.connect(treasury).setAllowedVault(newVault.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedVault(vault.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed vault when called by governance', async () => {
            await expect(manager.connect(treasury).setAllowedVault(vault.address, true))
                .to.emit(manager, 'AllowedVault')
                .withArgs(vault.address, true);
            expect(await manager.allowedVaults(vault.address)).to.be.equal(true);
        });

        it('should unset the allowed converter when called by governance', async () => {
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            expect(await manager.allowedVaults(vault.address)).to.be.equal(true);
            await expect(manager.connect(treasury).setAllowedVault(vault.address, false))
                .to.emit(manager, 'AllowedVault')
                .withArgs(vault.address, false);
            expect(await manager.allowedVaults(vault.address)).to.be.equal(false);
        });
    });

    describe('setGovernance', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(user).setGovernance(treasury.address)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setGovernance(treasury.address)
            ).to.be.revertedWith('halted');
        });

        it('should set the new governance when called by governance', async () => {
            await expect(manager.connect(deployer).setGovernance(treasury.address))
                .to.emit(manager, 'SetGovernance')
                .withArgs(treasury.address);
            expect(await manager.governance()).to.be.equal(treasury.address);
        });
    });

    describe('setHarvester', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(user).setHarvester(harvester.address)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setHarvester(harvester.address)
            ).to.be.revertedWith('halted');
        });

        it('should revert if the harvester manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewFakeHarvester = await ethers.getContractFactory('Harvester');
            const newFakeHarvester = await NewFakeHarvester.deploy(
                fakeManager.address,
                controller.address,
                ethers.constants.AddressZero
            );
            await expect(
                manager.connect(deployer).setHarvester(newFakeHarvester.address)
            ).to.be.revertedWith('!manager');
        });

        it('should set the new harvester when called by governance', async () => {
            const NewHarvester = await ethers.getContractFactory('Harvester');
            const newHarvester = await NewHarvester.deploy(
                manager.address,
                controller.address,
                ethers.constants.AddressZero
            );
            await manager.connect(deployer).setHarvester(newHarvester.address);
            expect(await manager.harvester()).to.be.equal(newHarvester.address);
        });
    });

    describe('setInsuranceFee', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(manager.connect(user).setInsuranceFee(99)).to.be.revertedWith(
                '!governance'
            );
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(manager.connect(deployer).setInsuranceFee(99)).to.be.revertedWith(
                'halted'
            );
        });

        it('should revert if the fee is over 100', async () => {
            await expect(manager.connect(deployer).setInsuranceFee(101)).to.be.revertedWith(
                '_insuranceFee over 1%'
            );
        });

        it('should set the insurance fee when called by governance', async () => {
            await manager.connect(deployer).setInsuranceFee(99);
            expect(await manager.insuranceFee()).to.be.equal(99);
        });
    });

    describe('setInsurancePool', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(user).setInsurancePool(user.address)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setInsurancePool(user.address)
            ).to.be.revertedWith('halted');
        });

        it('should set the insurance pool when called by governance', async () => {
            await manager.connect(deployer).setInsurancePool(user.address);
            expect(await manager.insurancePool()).to.be.equal(user.address);
        });
    });

    describe('setInsurancePoolFee', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(manager.connect(user).setInsurancePoolFee(99)).to.be.revertedWith(
                '!governance'
            );
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(manager.connect(deployer).setInsurancePoolFee(99)).to.be.revertedWith(
                'halted'
            );
        });

        it('should revert if the fee is over 20000', async () => {
            await expect(
                manager.connect(deployer).setInsurancePoolFee(20001)
            ).to.be.revertedWith('_insurancePoolFee over 20%');
        });

        it('should set the insurance fee when called by governance', async () => {
            await manager.connect(deployer).setInsurancePoolFee(99);
            expect(await manager.insurancePoolFee()).to.be.equal(99);
        });
    });

    describe('setStakingPool', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(user).setStakingPool(user.address)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setStakingPool(user.address)
            ).to.be.revertedWith('halted');
        });

        it('should set the staking pool when called by governance', async () => {
            await manager.connect(deployer).setStakingPool(user.address);
            expect(await manager.stakingPool()).to.be.equal(user.address);
        });
    });

    describe('setStakingPoolShareFee', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(manager.connect(user).setStakingPoolShareFee(99)).to.be.revertedWith(
                '!governance'
            );
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setStakingPoolShareFee(99)
            ).to.be.revertedWith('halted');
        });

        it('should revert if the fee is over 5000', async () => {
            await expect(
                manager.connect(deployer).setStakingPoolShareFee(5001)
            ).to.be.revertedWith('_stakingPoolShareFee over 50%');
        });

        it('should set the insurance fee when called by governance', async () => {
            await manager.connect(deployer).setStakingPoolShareFee(99);
            expect(await manager.stakingPoolShareFee()).to.be.equal(99);
        });
    });

    describe('setStrategist', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(manager.connect(user).setStrategist(user.address)).to.be.revertedWith(
                '!governance'
            );
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setStrategist(user.address)
            ).to.be.revertedWith('halted');
        });

        it('should revert if attempting to set the 0 address', async () => {
            await expect(
                manager.connect(deployer).setStrategist(ethers.constants.AddressZero)
            ).to.be.revertedWith('!_strategist');
        });

        it('should set the pending strategist when called by governance', async () => {
            await expect(manager.connect(deployer).setStrategist(user.address))
                .to.emit(manager, 'SetPendingStrategist')
                .withArgs(user.address);
            expect(await manager.pendingStrategist()).to.be.equal(user.address);
        });
    });

    describe('setTreasury', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(manager.connect(user).setTreasury(user.address)).to.be.revertedWith(
                '!governance'
            );
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setTreasury(user.address)
            ).to.be.revertedWith('halted');
        });

        it('should revert if attempting to set the 0 address', async () => {
            await expect(
                manager.connect(deployer).setTreasury(ethers.constants.AddressZero)
            ).to.be.revertedWith('!_treasury');
        });

        it('should set the treasury when called by governance', async () => {
            await manager.connect(deployer).setTreasury(user.address);
            expect(await manager.treasury()).to.be.equal(user.address);
        });
    });

    describe('setTreasuryFee', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(manager.connect(user).setTreasuryFee(99)).to.be.revertedWith(
                '!governance'
            );
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(manager.connect(deployer).setTreasuryFee(99)).to.be.revertedWith(
                'halted'
            );
        });

        it('should revert if the fee is over 2000', async () => {
            await expect(manager.connect(deployer).setTreasuryFee(2001)).to.be.revertedWith(
                '_treasuryFee over 20%'
            );
        });

        it('should set the treasury fee when called by governance', async () => {
            await manager.connect(deployer).setTreasuryFee(99);
            expect(await manager.treasuryFee()).to.be.equal(99);
        });
    });

    describe('setWithdrawalProtectionFee', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(user).setWithdrawalProtectionFee(99)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setWithdrawalProtectionFee(99)
            ).to.be.revertedWith('halted');
        });

        it('should revert if the fee is over 2000', async () => {
            await expect(
                manager.connect(deployer).setWithdrawalProtectionFee(101)
            ).to.be.revertedWith('_withdrawalProtectionFee over 1%');
        });

        it('should set the withdrawal protection fee when called by governance', async () => {
            await manager.connect(deployer).setWithdrawalProtectionFee(99);
            expect(await manager.withdrawalProtectionFee()).to.be.equal(99);
        });
    });

    describe('setStrategist', () => {
        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(manager.connect(user).acceptStrategist()).to.be.revertedWith(
                'halted'
            );
        });

        it('should revert if there is no pendingStrategist', async () => {
            await expect(manager.connect(user).acceptStrategist()).to.be.revertedWith(
                '!pendingStrategist'
            );
        });

        context('when there is a pending strategist', () => {
            beforeEach(async () => {
                await manager.connect(deployer).setStrategist(user.address);
            });

            it('should revert if called by an account other than the pending strategist', async () => {
                await increaseTime(7 * 86400);
                await expect(manager.connect(deployer).acceptStrategist()).to.be.revertedWith(
                    '!pendingStrategist'
                );
            });

            it('should revert if called by the pending strategist within the timelock', async () => {
                await increaseTime(2 * 86400);
                await expect(manager.connect(user).acceptStrategist()).to.be.revertedWith(
                    'PENDING_STRATEGIST_TIMELOCK'
                );
            });

            it('should set the strategist if called by the pending strategist after the timelock', async () => {
                await increaseTime(7 * 86400 + 1);

                await expect(manager.connect(user).acceptStrategist())
                    .to.emit(manager, 'SetStrategist')
                    .withArgs(user.address);
                expect(await manager.pendingStrategist()).to.be.equal(
                    ethers.constants.AddressZero
                );
                expect(await manager.strategist()).to.be.equal(user.address);
            });
        });
    });

    describe('addToken', () => {
        let vault;

        beforeEach(async () => {
            const Vault = await ethers.getContractFactory('Vault');
            vault = await Vault.deploy('Vault', 'VLT', manager.address);
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedToken(dai.address, true);
        });

        it('should revert when called by non-strategist address', async () => {
            await expect(
                manager
                    .connect(user)
                    .addToken(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager
                    .connect(deployer)
                    .addToken(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('halted');
        });

        it('should revert if token is not allowed', async () => {
            await expect(
                manager
                    .connect(deployer)
                    .addToken(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('!allowedTokens');
        });

        it('should revert if vault is not allowed', async () => {
            await expect(
                manager.connect(deployer).addToken(ethers.constants.AddressZero, dai.address)
            ).to.be.revertedWith('!allowedVaults');
        });

        it('should add tokens within the maximum number', async () => {
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
        });

        it('should revert if the token is already added', async () => {
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            await expect(
                manager.connect(deployer).addToken(vault.address, dai.address)
            ).to.be.revertedWith('!_token');
        });

        it('should revert when it reaches the maximum number of tokens in vault', async () => {
            const _numToAddress = (num) => `0x${(num + 1).toString().padStart(40, '0')}`;

            // Fill manager with maximum number of tokens in a vault
            const max = 256;
            const addTokens = new Array(max)
                .fill(0)
                .map((_, i) =>
                    manager.connect(treasury).setAllowedToken(_numToAddress(i), true)
                );
            await Promise.all(addTokens);
            const addMax = new Array(max)
                .fill(0)
                .map((v, i) =>
                    manager.connect(deployer).addToken(vault.address, _numToAddress(i))
                );
            await Promise.all(addMax);

            // The next should fail
            await expect(
                manager.connect(deployer).addToken(vault.address, dai.address)
            ).to.be.revertedWith('>tokens');
        });
    });

    describe('recoverToken', () => {
        beforeEach(async () => {
            await dai.connect(user).faucet(1);
            await dai.connect(user).transfer(manager.address, 1);
        });

        it('should revert when called by non-strategist address', async () => {
            await expect(
                manager.connect(user).recoverToken(dai.address, 1, deployer.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).recoverToken(dai.address, 1, deployer.address)
            ).to.be.revertedWith('halted');
        });

        it('should send the managers tokens when called by strategist', async () => {
            const initialBalance = await dai.balanceOf(deployer.address);
            expect(await dai.balanceOf(manager.address)).to.equal(1);
            await manager.connect(deployer).recoverToken(dai.address, 1, deployer.address);
            expect(await dai.balanceOf(manager.address)).to.equal(0);
            expect(await dai.balanceOf(deployer.address)).to.equal(initialBalance.add(1));
        });
    });

    describe('removeToken', () => {
        let vault;

        beforeEach(async () => {
            const Vault = await ethers.getContractFactory('Vault');
            vault = await Vault.deploy('Vault', 'VLT', manager.address);
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.connect(deployer).addToken(vault.address, dai.address);
        });

        it('should revert when called by non-strategist address', async () => {
            await expect(
                manager
                    .connect(user)
                    .removeToken(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager
                    .connect(deployer)
                    .removeToken(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('halted');
        });

        it('should remove token', async () => {
            await expect(manager.connect(deployer).removeToken(vault.address, dai.address))
                .to.emit(manager, 'TokenRemoved')
                .withArgs(vault.address, dai.address);
            expect((await manager.getTokens(vault.address)).length).to.equal(0);
        });

        it('should do nothing if vault is not added', async () => {
            await expect(
                manager
                    .connect(deployer)
                    .removeToken(ethers.constants.AddressZero, dai.address)
            ).to.not.emit(manager, 'TokenRemoved');
            expect((await manager.getTokens(vault.address)).length).to.equal(1);
        });

        it('should do nothing if token is not added', async () => {
            await expect(
                manager
                    .connect(deployer)
                    .removeToken(vault.address, ethers.constants.AddressZero)
            ).to.not.emit(manager, 'TokenRemoved');
            expect((await manager.getTokens(vault.address)).length).to.equal(1);
        });
    });

    describe('setController', () => {
        let vault, newController;

        beforeEach(async () => {
            const Vault = await ethers.getContractFactory('Vault');
            vault = await Vault.deploy('Vault', 'VLT', manager.address);
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            const NewController = await ethers.getContractFactory('Controller');
            newController = await NewController.deploy(manager.address);
            await manager.connect(treasury).setAllowedController(newController.address, true);
        });

        it('should revert when called by non-strategist address', async () => {
            await expect(
                manager
                    .connect(user)
                    .setController(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager
                    .connect(deployer)
                    .setController(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith('halted');
        });

        it('should revert if vault is not added', async () => {
            await expect(
                manager
                    .connect(deployer)
                    .setController(ethers.constants.AddressZero, newController.address)
            ).to.be.revertedWith('!_vault');
        });

        it('should revert if controller is not added', async () => {
            await expect(
                manager
                    .connect(deployer)
                    .setController(vault.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('!_controller');
        });

        it('should set controller if called by strategist', async () => {
            await expect(
                manager.connect(deployer).setController(vault.address, newController.address)
            )
                .to.emit(manager, 'SetController')
                .withArgs(vault.address, newController.address);
            expect(await manager.controllers(vault.address)).to.equal(newController.address);
        });
    });

    describe('setHalted', () => {
        it('should revert when called by non-strategist address', async () => {
            await expect(manager.connect(user).setHalted()).to.be.revertedWith('!strategist');
        });

        it('should halt the manager if called by strategist', async () => {
            await expect(manager.connect(deployer).setHalted()).to.emit(manager, 'Halted');
            expect(await manager.halted()).to.be.true;
        });

        it('should revert if the manager is already halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(manager.connect(deployer).setHalted()).to.be.revertedWith('halted');
        });
    });
});
