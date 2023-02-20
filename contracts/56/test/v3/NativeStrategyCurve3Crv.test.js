const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;

describe('NativeStrategyCurve3Crv', () => {
    let deployer, treasury, user;
    let dai,
        t3crv,
        usdc,
        usdt,
        stableSwap3Pool,
        manager,
        nativeStrategyCurve3Crv,
        crv,
        weth,
        gauge,
        mintr,
        controller,
        unirouter;

    beforeEach(async () => {
        await deployments.fixture(['v3', 'NativeStrategyCurve3Crv']);
        [deployer, treasury, , user] = await ethers.getSigners();
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const CRV = await deployments.get('CRV');
        crv = await ethers.getContractAt('MockERC20', CRV.address);
        const WETH = await deployments.get('WETH');
        weth = await ethers.getContractAt('MockERC20', WETH.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const Gauge = await deployments.get('MockCurveGauge');
        gauge = await ethers.getContractAt('MockCurveGauge', Gauge.address);
        const Mintr = await deployments.get('MockCurveMinter');
        mintr = await ethers.getContractAt('MockCurveMinter', Mintr.address);
        const MockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = await ethers.getContractAt(
            'MockStableSwap3Pool',
            MockStableSwap3Pool.address
        );
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const router = await deployments.get('MockUniswapRouter');
        unirouter = await ethers.getContractAt('MockUniswapRouter', router.address);

        const NativeStrategyCurve3Crv = await deployments.deploy('NativeStrategyCurve3Crv', {
            from: deployer.address,
            args: [
                'Curve: 3CRV',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                mintr.address,
                stableSwap3Pool.address,
                controller.address,
                manager.address,
                unirouter.address
            ]
        });
        nativeStrategyCurve3Crv = await ethers.getContractAt(
            'NativeStrategyCurve3Crv',
            NativeStrategyCurve3Crv.address
        );

        await manager.setGovernance(treasury.address);
    });

    it('should deploy with expected state', async () => {
        expect(await nativeStrategyCurve3Crv.crv()).to.equal(crv.address);
        expect(await nativeStrategyCurve3Crv.dai()).to.equal(dai.address);
        expect(await nativeStrategyCurve3Crv.usdc()).to.equal(usdc.address);
        expect(await nativeStrategyCurve3Crv.usdt()).to.equal(usdt.address);
        expect(await nativeStrategyCurve3Crv.crvMintr()).to.equal(mintr.address);
        expect(await nativeStrategyCurve3Crv.stableSwap3Pool()).to.equal(
            stableSwap3Pool.address
        );
        expect(await nativeStrategyCurve3Crv.gauge()).to.equal(gauge.address);
        expect(await nativeStrategyCurve3Crv.want()).to.equal(t3crv.address);
        expect(await nativeStrategyCurve3Crv.weth()).to.equal(weth.address);
        expect(await nativeStrategyCurve3Crv.controller()).to.equal(controller.address);
        expect(await nativeStrategyCurve3Crv.manager()).to.equal(manager.address);
        expect(await nativeStrategyCurve3Crv.name()).to.equal('Curve: 3CRV');
        expect(await nativeStrategyCurve3Crv.router()).to.equal(unirouter.address);
    });

    describe('approveForSpender', () => {
        it('should revert if called by an address other than governance', async () => {
            await expect(
                nativeStrategyCurve3Crv
                    .connect(user)
                    .approveForSpender(
                        ethers.constants.AddressZero,
                        ethers.constants.AddressZero,
                        0
                    )
            ).to.be.revertedWith('!governance');
        });

        it('should approve spender when called by governance', async () => {
            expect(
                await dai.allowance(nativeStrategyCurve3Crv.address, user.address)
            ).to.equal(0);
            await nativeStrategyCurve3Crv
                .connect(treasury)
                .approveForSpender(dai.address, user.address, 123);
            expect(
                await dai.allowance(nativeStrategyCurve3Crv.address, user.address)
            ).to.equal(123);
        });
    });

    describe('setRouter', () => {
        it('should revert if called by an address other than governance', async () => {
            await expect(
                nativeStrategyCurve3Crv.connect(user).setRouter(ethers.constants.AddressZero)
            ).to.be.revertedWith('!governance');
        });

        it('should set router when called by governance', async () => {
            expect(await nativeStrategyCurve3Crv.router()).to.equal(unirouter.address);
            await nativeStrategyCurve3Crv
                .connect(treasury)
                .setRouter(ethers.constants.AddressZero);
            expect(await nativeStrategyCurve3Crv.router()).to.equal(
                ethers.constants.AddressZero
            );
        });
    });

    describe('deposit', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(nativeStrategyCurve3Crv.deposit()).to.be.revertedWith('!controller');
        });
    });

    describe('deposit', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(nativeStrategyCurve3Crv.harvest(0, 0)).to.be.revertedWith(
                '!controller'
            );
        });
    });

    describe('skim', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(nativeStrategyCurve3Crv.skim()).to.be.revertedWith('!controller');
        });
    });

    describe('withdraw address', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(
                nativeStrategyCurve3Crv['withdraw(address)'](ethers.constants.AddressZero)
            ).to.be.revertedWith('!controller');
        });
    });

    describe('withdraw amount', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(nativeStrategyCurve3Crv['withdraw(uint256)'](0)).to.be.revertedWith(
                '!controller'
            );
        });
    });

    describe('withdrawAll', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(nativeStrategyCurve3Crv.withdrawAll()).to.be.revertedWith(
                '!controller'
            );
        });
    });
});
