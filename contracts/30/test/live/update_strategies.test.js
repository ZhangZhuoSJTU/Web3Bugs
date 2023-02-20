const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers, deployments, getNamedAccounts } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Update Strategies: live', () => {
    before(async () => {
        let {
            DAI,
            deployer,
            oldStrategyCrv,
            T3CRV,
            timelock,
            treasury,
            USDC,
            user,
            vault3crv
        } = await getNamedAccounts();
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [deployer]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [timelock]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [treasury]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [user]
        });
        const Controller = await deployments.get('StrategyControllerV2');
        const Converter = await deployments.get('StableSwap3PoolConverter');
        const StrategyCurve = await deployments.get('StrategyCurve3Crv');
        const StrategyYearn = await deployments.get('StrategyYearnV2-DAI');
        this.deployer = await ethers.provider.getSigner(deployer);
        this.timelock = await ethers.provider.getSigner(timelock);
        this.treasury = await ethers.provider.getSigner(treasury);
        this.user = await ethers.provider.getSigner(user);
        this.vault = await ethers.getContractAt('yAxisMetaVault', vault3crv);
        this.controller = await ethers.getContractAt(
            'StrategyControllerV2',
            Controller.address,
            timelock
        );
        this.strategyCurve = await ethers.getContractAt(
            'StrategyCurve3Crv',
            StrategyCurve.address
        );
        this.strategyYearn = await ethers.getContractAt(
            'StrategyYearnV2',
            StrategyYearn.address
        );
        this.converter = Converter.address;
        this.t3crv = T3CRV;
        this.dai = DAI;
        this.usdc = USDC;
        this.oldStrategyCrv = oldStrategyCrv;
        await this.user.sendTransaction({
            to: this.deployer._address,
            value: ether('10')
        });
        await this.user.sendTransaction({
            to: this.timelock._address,
            value: ether('10')
        });
        await this.user.sendTransaction({
            to: this.treasury._address,
            value: ether('10')
        });
    });

    it('should remove the old strategy', async () => {
        await this.controller
            .connect(this.treasury)
            .removeStrategy(this.t3crv, this.oldStrategyCrv, 86400);
        expect((await this.controller.strategies(this.t3crv)).length).to.be.equal(0);
    });

    it('should add the new strategies to the controller', async () => {
        await this.controller
            .connect(this.timelock)
            .addStrategy(
                this.t3crv,
                this.strategyCurve.address,
                0,
                ethers.constants.AddressZero,
                true,
                86400
            );
        expect((await this.controller.strategies(this.t3crv)).length).to.be.equal(1);
        await this.controller
            .connect(this.timelock)
            .addStrategy(
                this.t3crv,
                this.strategyYearn.address,
                ether('100000000'),
                this.converter,
                false,
                86400
            );
        expect((await this.controller.strategies(this.t3crv)).length).to.be.equal(2);
    });

    it('should earn to the Yearn strategy', async () => {
        expect(await this.strategyYearn.balanceOf()).to.be.equal(0);
        await this.vault.connect(this.deployer).earn();
        expect(await this.strategyCurve.balanceOf()).to.be.equal(0);
        expect(await this.strategyYearn.balanceOf()).to.be.above(1);
    });

    it('should withdrawAll from strategy', async () => {
        await this.controller.connect(this.treasury).withdrawAll(this.strategyYearn.address);
        expect(await this.strategyYearn.balanceOf()).to.be.equal(0);
    });
});
