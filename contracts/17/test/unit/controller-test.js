const Controller = artifacts.require('Controller');
const MockGvtTokenToken = artifacts.require('MockGvtToken');
const MockPWRDToken = artifacts.require('MockPWRDToken');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDT');
const MockVaultAdaptor = artifacts.require('MockVaultAdaptor');
const MockLifeGuard = artifacts.require('MockLifeGuard');
const MockLPToken = artifacts.require('MockLPToken');
const MockBuoy = artifacts.require('MockBuoy');
const MockPnL = artifacts.require('MockPnL');
const MockInsurance = artifacts.require('MockInsurance')
const { BN, toBN } = require('web3-utils');
const { constants } = require('../utils/constants');
const { expect, ZERO } = require('../utils/common-utils');

contract('Controller Test', function (accounts) {

    const decimals = ['1000000000000000000', '1000000', '1000000'];
    const deployer = accounts[0],
        governance = deployer,
        investor1 = accounts[1],
        investor2 = accounts[2],
        investor3 = accounts[3],
        newGovernance = accounts[8];

    const baseNum = new BN(10).pow(new BN(18));

    let controller, mockVault, mockPWRD, mockLifeGuard, mockBuoy, mockPnl, mockInsurance,
        daiBaseNum, usdcBaseNum,
        mockDAI, mockUSDC, mockUSDT, mockDAIVault, mockUSDCVault, mockUSDTVault,
        mockLPToken, mockCurveVault;

    beforeEach(async function () {
        mockVault = await MockGvtTokenToken.new();
        mockPWRD = await MockPWRDToken.new();
        mockDAI = await MockDAI.new();
        mockUSDC = await MockUSDC.new();
        mockUSDT = await MockUSDT.new();
        mockLPToken = await MockLPToken.new();
        mockDAIVault = await MockVaultAdaptor.new();
        mockUSDCVault = await MockVaultAdaptor.new();
        mockUSDTVault = await MockVaultAdaptor.new();
        mockCurveVault = await MockVaultAdaptor.new();
        tokens = [mockDAI.address, mockUSDC.address, mockUSDT.address];
        vaults = [mockDAIVault.address, mockUSDCVault.address, mockUSDTVault.address];
        controller = await Controller.new(mockPWRD.address, mockVault.address, tokens, decimals);
        await mockVault.transferOwnership(controller.address);
        await mockPWRD.transferOwnership(controller.address);

        mockLifeGuard = await MockLifeGuard.new();
        mockBuoy = await MockBuoy.new();
        await mockLifeGuard.setBuoy(mockBuoy.address);
        await controller.setLifeGuard(mockLifeGuard.address);
        await mockLifeGuard.setStablecoins([mockDAI.address, mockUSDC.address, mockUSDT.address]);

        mockPnl = await MockPnL.new();
        await controller.setPnL(mockPnl.address);

        mockInsurance = await MockInsurance.new();
        await controller.setInsurance(mockInsurance.address);

        daiBaseNum = new BN(10).pow(await mockDAI.decimals());
        usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
        usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());

        await mockDAIVault.setUnderlyingToken(mockDAI.address);
        await mockUSDCVault.setUnderlyingToken(mockUSDC.address);
        await mockUSDTVault.setUnderlyingToken(mockUSDT.address);
        await mockCurveVault.setUnderlyingToken(mockLPToken.address);

        await controller.addToWhitelist(governance, { from: governance });
        await controller.setVault(0, mockDAIVault.address);
        await controller.setVault(1, mockUSDCVault.address);
        await controller.setVault(2, mockUSDCVault.address);
        await controller.setCurveVault(mockCurveVault.address);

        await mockDAI.mint(investor1, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor1, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor1, new BN(10000).mul(usdtBaseNum), { from: deployer });
        await mockDAI.mint(investor2, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor2, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor2, new BN(10000).mul(usdtBaseNum), { from: deployer });
    });

    describe('setVault', function () {
        const tokenVault = accounts[7];
        it('Should revert when the caller is not governance', function () {
            return expect(
                controller.setVault(0, tokenVault, { from: accounts[7] })).to.be.rejected;
        });

        it('Should revert when the new token vault is empty', function () {
            return expect(controller.setVault(0, constants.ZERO_ADDRESS,
                { from: governance })).to.be.rejected;
        });
    });

    describe.skip('Utility', function () {
        it('Should return underlying stablecoins', async function () {
        });
        it('Should return skim percent', async function () {
        });
        it('Should be possible to set a new safe address (non EoA block)', async function () {
        });
        it('Should be possible to switch on the non eoa block', async function () {
        });
        it('Should be possible to set a new rewards address', async function () {
        });
        it('Should be possible to get pwrd/gvt from the controller', async function () {
        });
        it('Should be possible to block Non eoa interactions', async function () {
        });
    });

    describe('totalAssets', function () {
        it('Should ok initially', async function () {
            return expect(controller.totalAssets()).to.eventually.be.a.bignumber.equal(new BN(0));
        });
    });

    describe('gTokenTotalAssets', function () {
        it('Should ok initially', async function () {
            return expect(controller.gTokenTotalAssets({ from: mockVault.address }))
                .to.eventually.be.a.bignumber.equal(new BN(0));
        });
    });

    describe('isValidBigFish', function () {
        it('return false when < bigFishAbsoluteThreshold', async () => {
            await controller.setBigFishThreshold(100, toBN(1000).mul(baseNum));
            return expect(controller.isValidBigFish(false, true, toBN(900).mul(baseNum))).to.eventually.equal(false);
        })

        it('return true when > assets', async () => {
            await controller.setBigFishThreshold(100, toBN(1000).mul(baseNum));
            await mockPnl.setLastGvtAssets(toBN(2000).mul(baseNum));
            return expect(controller.isValidBigFish(false, true, toBN(2010).mul(baseNum))).to.eventually.equal(true);
        })

        it('return true when > bigFishThreshold', async () => {
            await controller.setBigFishThreshold(6000, toBN(1000).mul(baseNum));
            await mockPnl.setLastGvtAssets(toBN(2000).mul(baseNum));
            return expect(controller.isValidBigFish(false, true, toBN(1210).mul(baseNum))).to.eventually.equal(true);
        })

        it('return true when < bigFishThreshold', async () => {
            await controller.setBigFishThreshold(8000, toBN(1000).mul(baseNum));
            await mockPnl.setLastGvtAssets(toBN(2000).mul(baseNum));
            await mockPnl.setLastPwrdAssets(toBN(1600).mul(baseNum));
            return expect(controller.isValidBigFish(false, true, toBN(1270).mul(baseNum))).to.eventually.equal(false);
        })

        it('return true when > bigFishThreshold', async () => {
            await controller.setBigFishThreshold(8000, toBN(1000).mul(baseNum));
            await mockPnl.setLastGvtAssets(toBN(2000).mul(baseNum));
            await mockPnl.setLastPwrdAssets(toBN(1600).mul(baseNum));
            return expect(controller.isValidBigFish(false, true, toBN(2900).mul(baseNum))).to.eventually.equal(true);
        })
    });
})
