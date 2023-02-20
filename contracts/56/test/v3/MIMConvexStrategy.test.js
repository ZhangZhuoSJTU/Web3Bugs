const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;

describe('MIMConvexStrategy', () => {
    let deployer, treasury, user;
    let mim,
        mock3crv,
        mim3crv,
        stableSwap2Pool,
        manager,
        convexStrategy,
        crv,
        cvx,
        weth,
        convexVault,
        controller,
        unirouter;

    beforeEach(async () => {
        await deployments.fixture(['v3', 'MIMConvexStrategy']);
        [deployer, treasury, , user] = await ethers.getSigners();
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const MOCK3CRV = await deployments.get('MOCK3CRV');
        mock3crv = await ethers.getContractAt('MockERC20', MOCK3CRV.address);
        const MIM3CRV = await deployments.get('MIM3CRV');
        mim3crv = await ethers.getContractAt('MockERC20', MIM3CRV.address);
        const CRV = await deployments.get('CRV');
        crv = await ethers.getContractAt('MockERC20', CRV.address);
        const CVX = await deployments.get('CVX');
        cvx = await ethers.getContractAt('MockERC20', CVX.address);
        const WETH = await deployments.get('WETH');
        weth = await ethers.getContractAt('MockERC20', WETH.address);
        const MIM = await deployments.get('MIM');
        mim = await ethers.getContractAt('MockERC20', MIM.address);
        const ConvexVault = await deployments.get('MockConvexVault');
        convexVault = await ethers.getContractAt('MockConvexVault', ConvexVault.address);
        const MockStableSwap2Pool = await deployments.get('MockStableSwap2Pool');
        stableSwap2Pool = await ethers.getContractAt(
            'MockStableSwap2Pool',
            MockStableSwap2Pool.address
        );
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const router = await deployments.get('MockUniswapRouter');
        unirouter = await ethers.getContractAt('MockUniswapRouter', router.address);
        const vaultPID = 0;

        const MIMConvexStrategy = await deployments.deploy('MIMConvexStrategy', {
            from: deployer.address,
            args: [
                'Convex: MIMCRV',
                mim3crv.address,
                crv.address,
                cvx.address,
                weth.address,
                mim.address,
                mock3crv.address,
                vaultPID,
                convexVault.address,
                stableSwap2Pool.address,
                controller.address,
                manager.address,
                unirouter.address
            ]
        });
        convexStrategy = await ethers.getContractAt(
            'MIMConvexStrategy',
            MIMConvexStrategy.address
        );

        await manager.setGovernance(treasury.address);
    });

    it('should deploy with expected state', async () => {
        expect(await convexStrategy.crv()).to.equal(crv.address);
        expect(await convexStrategy.cvx()).to.equal(cvx.address);
        expect(await convexStrategy.mim()).to.equal(mim.address);
        expect(await convexStrategy.crv3()).to.equal(mock3crv.address);
        expect(await convexStrategy.stableSwap2Pool()).to.equal(stableSwap2Pool.address);
        expect(await convexStrategy.convexVault()).to.equal(convexVault.address);
        expect(await convexStrategy.want()).to.equal(mim3crv.address);
        expect(await convexStrategy.weth()).to.equal(weth.address);
        expect(await convexStrategy.controller()).to.equal(controller.address);
        expect(await convexStrategy.manager()).to.equal(manager.address);
        expect(await convexStrategy.name()).to.equal('Convex: MIMCRV');
        expect(await convexStrategy.router()).to.equal(unirouter.address);
    });

    describe('approveForSpender', () => {
        it('should revert if called by an address other than governance', async () => {
            await expect(
                convexStrategy
                    .connect(user)
                    .approveForSpender(
                        ethers.constants.AddressZero,
                        ethers.constants.AddressZero,
                        0
                    )
            ).to.be.revertedWith('!governance');
        });

        it('should approve spender when called by governance', async () => {
            expect(await mim.allowance(convexStrategy.address, user.address)).to.equal(0);
            await convexStrategy
                .connect(treasury)
                .approveForSpender(mim.address, user.address, 123);
            expect(await mim.allowance(convexStrategy.address, user.address)).to.equal(123);
        });
    });

    describe('setRouter', () => {
        it('should revert if called by an address other than governance', async () => {
            await expect(
                convexStrategy.connect(user).setRouter(ethers.constants.AddressZero)
            ).to.be.revertedWith('!governance');
        });

        it('should set router when called by governance', async () => {
            expect(await convexStrategy.router()).to.equal(unirouter.address);
            await convexStrategy.connect(treasury).setRouter(ethers.constants.AddressZero);
            expect(await convexStrategy.router()).to.equal(ethers.constants.AddressZero);
        });
    });

    describe('deposit', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(convexStrategy.deposit()).to.be.revertedWith('!controller');
        });
    });

    describe('deposit', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(convexStrategy.harvest(0, 0)).to.be.revertedWith('!controller');
        });
    });

    describe('skim', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(convexStrategy.skim()).to.be.revertedWith('!controller');
        });
    });

    describe('withdraw address', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(
                convexStrategy['withdraw(address)'](ethers.constants.AddressZero)
            ).to.be.revertedWith('!controller');
        });
    });

    describe('withdraw amount', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(convexStrategy['withdraw(uint256)'](0)).to.be.revertedWith(
                '!controller'
            );
        });
    });

    describe('withdrawAll', () => {
        it('should revert if called by an address other than controller', async () => {
            await expect(convexStrategy.withdrawAll()).to.be.revertedWith('!controller');
        });
    });
});
