const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('StablesConverter', () => {
    let deployer, user;
    let converter, dai, t3crv, usdc, usdt, stableSwap3Pool, manager;

    beforeEach(async () => {
        await deployments.fixture(['v3', 'NativeStrategyCurve3Crv']);
        [deployer, , , user] = await ethers.getSigners();
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const MockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = await ethers.getContractAt(
            'MockStableSwap3Pool',
            MockStableSwap3Pool.address
        );

        const Converter = await deployments.deploy('StablesConverter', {
            from: deployer.address,
            args: [
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                stableSwap3Pool.address,
                manager.address
            ]
        });
        converter = await ethers.getContractAt('StablesConverter', Converter.address);
    });

    it('should deploy with expected state', async () => {
        expect(await converter.manager()).to.equal(manager.address);
        expect(await converter.stableSwap3Pool()).to.equal(stableSwap3Pool.address);
        expect(await converter.token3CRV()).to.equal(t3crv.address);
        expect(await converter.tokens(0)).to.equal(dai.address);
        expect(await converter.tokens(1)).to.equal(usdc.address);
        expect(await converter.tokens(2)).to.equal(usdt.address);
    });

    describe('approveForSpender', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                converter
                    .connect(user)
                    .approveForSpender(
                        ethers.constants.AddressZero,
                        ethers.constants.AddressZero,
                        0
                    )
            ).to.be.revertedWith('!strategist');
        });

        it('should approve spender when called by the strategist', async () => {
            expect(await dai.allowance(converter.address, user.address)).to.equal(0);
            await converter.approveForSpender(dai.address, user.address, 123);
            expect(await dai.allowance(converter.address, user.address)).to.equal(123);
        });
    });

    describe('recoverUnsupported', () => {
        beforeEach(async () => {
            await dai.connect(user).faucet(1000);
            await dai.connect(user).transfer(converter.address, 1000);
        });

        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                converter.connect(user).recoverUnsupported(dai.address, 1000, user.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should approve spender when called by the strategist', async () => {
            expect(await dai.balanceOf(converter.address)).to.equal(1000);
            expect(await dai.balanceOf(user.address)).to.equal(0);
            await converter.recoverUnsupported(dai.address, 1000, user.address);
            expect(await dai.balanceOf(converter.address)).to.equal(0);
            expect(await dai.balanceOf(user.address)).to.equal(1000);
        });
    });

    describe('convert', () => {
        let alwaysAccess, newConverter;

        beforeEach(async () => {
            const AlwaysAccess = await ethers.getContractFactory('AlwaysAccess');
            alwaysAccess = await AlwaysAccess.deploy(true);
            const Converter = await deployments.deploy('StablesConverter', {
                from: deployer.address,
                args: [
                    dai.address,
                    usdc.address,
                    usdt.address,
                    t3crv.address,
                    stableSwap3Pool.address,
                    alwaysAccess.address
                ]
            });
            newConverter = await ethers.getContractAt('StablesConverter', Converter.address);

            await dai.faucet(ether('1000'));
            await usdc.faucet(ether('1000'));
            await usdt.faucet('1000000000');
        });

        it('should revert if called by an address that is not authorized', async () => {
            await expect(
                newConverter.connect(user).convert(dai.address, usdc.address, 1, 1)
            ).to.be.revertedWith('!authorized');
        });

        it('should convert non-3CRV to non-3CRV when called from authorized sender', async () => {
            const startBalance = await usdc.balanceOf(deployer.address);
            await dai.transfer(newConverter.address, ether('100'));
            await newConverter.convert(dai.address, usdc.address, ether('100'), 1);
            expect(await usdc.balanceOf(deployer.address)).to.be.above(startBalance);
        });

        it('should convert 3CRV to non-3CRV when called from authorized sender', async () => {
            const startBalance = await usdc.balanceOf(deployer.address);
            await t3crv.transfer(newConverter.address, ether('100'));
            await newConverter.convert(t3crv.address, usdc.address, ether('100'), 1);
            expect(await usdc.balanceOf(deployer.address)).to.be.above(startBalance);
        });

        it('should convert non-3CRV to 3CRV when called from authorized sender', async () => {
            const startBalance = await t3crv.balanceOf(deployer.address);
            await dai.transfer(newConverter.address, ether('100'));
            await newConverter.convert(dai.address, t3crv.address, ether('100'), 1);
            expect(await t3crv.balanceOf(deployer.address)).to.be.above(startBalance);
        });
    });
});
