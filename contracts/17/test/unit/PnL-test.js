const PnL = artifacts.require('PnL')
const MockController = artifacts.require('MockController')
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDT');
const MockLPToken = artifacts.require('MockLPToken');
const MockVaultAdaptor = artifacts.require('MockVaultAdaptor')
const MockLifeGuard = artifacts.require('MockLifeGuard')
const MockBuoy = artifacts.require('MockBuoy');
const MockGvtToken = artifacts.require('MockGvtToken')
const MockPWRD = artifacts.require('MockPWRDToken')
const { expect, thousandBaseNum, millionBaseNum, } = require('../utils/common-utils')
const { toBN, BN } = require('web3-utils')
const { distributeProfit } = require('../utils/pnl-utils');

contract('PnL Test', function (accounts) {
    const decimals = ['1000000000000000000', '1000000', '1000000'];
    const [deployer, governance,] = accounts;

    const lifeGuardBase = new BN(10).pow(new BN(18));

    let pnl, mockController, mockLifeGuard, mockBuoy, mockGvt, mockPWRD,
        daiBaseNum, usdcBaseNum, usdtBaseNum,
        mockDAI, mockUSDC, mockUSDT, mock3Crv,
        mockDAIVault, mockUSDCVault, mockUSDTVault, mockCurveVault, vaults;

    beforeEach(async function () {
        mockController = await MockController.new();

        mockGvt = await MockGvtToken.new();
        mockPWRD = await MockPWRD.new();
        await mockGvt.transferOwnership(mockController.address);
        await mockPWRD.transferOwnership(mockController.address);

        mockDAI = await MockDAI.new();
        mockUSDC = await MockUSDC.new();
        mockUSDT = await MockUSDT.new();
        mock3Crv = await MockLPToken.new();
        mockDAIVault = await MockVaultAdaptor.new();
        mockUSDCVault = await MockVaultAdaptor.new();
        mockUSDTVault = await MockVaultAdaptor.new();
        mockCurveVault = await MockVaultAdaptor.new();
        vaults = [mockDAIVault, mockUSDCVault, mockUSDTVault];
        tokens = [mockDAI.address, mockUSDC.address, mockUSDT.address];

        pnl = await PnL.new(mockPWRD.address, mockGvt.address, 0, 0);
        await pnl.setController(mockController.address);
        await mockController.setPnL(pnl.address);
        await mockDAIVault.setUnderlyingToken(mockDAI.address);
        await mockUSDCVault.setUnderlyingToken(mockUSDC.address);
        await mockUSDTVault.setUnderlyingToken(mockUSDT.address);
        await mockCurveVault.setUnderlyingToken(mock3Crv.address);
        await mockController.setUnderlyingTokens([mockDAI.address, mockUSDC.address, mockUSDT.address]);
        await mockController.setVault(0, mockDAIVault.address);
        await mockController.setVault(1, mockUSDCVault.address);
        await mockController.setVault(2, mockUSDTVault.address);
        await mockController.setCurveVault(mockCurveVault.address);
        await mockController.setGVT(mockGvt.address);
        await mockController.setPWRD(mockPWRD.address);

        mockLifeGuard = await MockLifeGuard.new();
        mockBuoy = await MockBuoy.new();
        await mockLifeGuard.setBuoy(mockBuoy.address);
        await mockLifeGuard.setStablecoins([mockDAI.address, mockUSDC.address, mockUSDT.address]);
        await mockController.setLifeGuard(mockLifeGuard.address);

        daiBaseNum = new BN(10).pow(await mockDAI.decimals());
        usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
        usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());
        crvBaseNum = new BN(10).pow(await mock3Crv.decimals());
    })

    describe('calcPnL', function () {
        it('ok', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase))

            const res = await pnl.calcPnL()
            expect(res[0]).to.be.a.bignumber.closeTo(
                toBN(100).mul(thousandBaseNum).mul(lifeGuardBase), toBN(1));
            return expect(res[1]).to.be.a.bignumber.closeTo(
                toBN(50).mul(thousandBaseNum).mul(lifeGuardBase), toBN(1));
        })
    })

    describe('distributeStrategyGainLoss', function () {
        it('revert when invalid caller address', async function () {
            return expect(pnl.distributeStrategyGainLoss(0, 0, governance, { from: governance }))
                .to.be.rejectedWith('!Controller');
        })

        it('ok when gain and ratio < 80%', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase))

            const profitAmounts = [
                toBN(1).mul(thousandBaseNum).mul(daiBaseNum),
                toBN(1).mul(thousandBaseNum).mul(usdcBaseNum),
                toBN(1).mul(thousandBaseNum).mul(usdtBaseNum),
            ];

            const profit = await mockBuoy.stableToUsd(profitAmounts, true);

            const lastGVTAssets = await pnl.lastGvtAssets();
            const lastPWRDAssets = await pnl.lastPwrdAssets();
            const [expectGVTAssets, expectPWRDAssets] = distributeProfit(
                profit, lastGVTAssets, lastPWRDAssets);

            await mockController.distributeStrategyGainLoss(profit, 0);
            const res = await pnl.calcPnL()

            expect(expectGVTAssets).to.be.a.bignumber.closeTo(res[0], toBN(1));
            return expect(expectPWRDAssets).to.be.a.bignumber.closeTo(res[1], toBN(1));
        })

        it('ok when gain and ratio >= 80%', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(85).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.setTotalAssets(toBN(185).mul(thousandBaseNum).mul(lifeGuardBase))

            const profitAmounts = [
                toBN(5).mul(thousandBaseNum).mul(daiBaseNum),
                0,
                0,
            ];

            const profit = await mockBuoy.stableToUsd(profitAmounts, true);

            const lastGVTAssets = await pnl.lastGvtAssets();
            const lastPWRDAssets = await pnl.lastPwrdAssets();
            const [expectGVTAssets, expectPWRDAssets] = distributeProfit(
                profit, lastGVTAssets, lastPWRDAssets);

            await mockController.distributeStrategyGainLoss(profit, 0);
            const res = await pnl.calcPnL()

            expect(expectGVTAssets).to.be.a.bignumber.closeTo(res[0], toBN(1));
            return expect(expectPWRDAssets).to.be.a.bignumber.closeTo(res[1], toBN(1));
        })

        it('ok when loss <= gvt assets', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(85).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.setTotalAssets(toBN(185).mul(thousandBaseNum).mul(lifeGuardBase))

            const lossAmounts = [
                toBN(10).mul(thousandBaseNum).mul(daiBaseNum),
                toBN(10).mul(thousandBaseNum).mul(usdcBaseNum),
                0,
            ];

            const loss = await mockBuoy.stableToUsd(lossAmounts, true);

            const lastGVTAssets = await pnl.lastGvtAssets();
            const lastPWRDAssets = await pnl.lastPwrdAssets();
            const expectGVTAssets = lastGVTAssets.sub(loss);
            const expectPWRDAssets = lastPWRDAssets;

            await mockController.distributeStrategyGainLoss(0, loss);
            const res = await pnl.calcPnL();

            expect(expectGVTAssets).to.be.a.bignumber.closeTo(res[0], toBN(1));
            return expect(expectPWRDAssets).to.be.a.bignumber.closeTo(res[1], toBN(1));
        })

        it('ok when loss > gvt assets', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase))
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase))

            const lossAmounts = [
                toBN(40).mul(thousandBaseNum).mul(daiBaseNum),
                toBN(40).mul(thousandBaseNum).mul(usdcBaseNum),
                toBN(40).mul(thousandBaseNum).mul(usdtBaseNum),
            ];

            const loss = await mockBuoy.stableToUsd(lossAmounts, true);

            const lastGVTAssets = await pnl.lastGvtAssets();
            const lastPWRDAssets = await pnl.lastPwrdAssets();
            const expectGVTAssets = toBN(1).mul(lifeGuardBase);
            const expectPWRDAssets = lastPWRDAssets.sub(loss.add(toBN(1).mul(lifeGuardBase)).sub(lastGVTAssets));

            await mockController.distributeStrategyGainLoss(0, loss);
            const res = await pnl.calcPnL()

            expect(expectGVTAssets).to.be.a.bignumber.closeTo(res[0], toBN(1));
            return expect(expectPWRDAssets).to.be.a.bignumber.closeTo(res[1], toBN(1));
        })
    })

    describe('distributeHodlerBonus', function () {
        it('ok', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase));

            const bonus = toBN(900).mul(lifeGuardBase);

            const lastGVTAssets = await pnl.lastGvtAssets();
            const lastPWRDAssets = await pnl.lastPwrdAssets();

            await mockController.decreaseGTokenLastAmount(mockPWRD.address, 0, bonus);
            const res = await pnl.calcPnL();

            await expect(res[0]).to.be.a.bignumber.closeTo(lastGVTAssets.add(toBN(600).mul(lifeGuardBase)), toBN(1));
            return expect(res[1]).to.be.a.bignumber.closeTo(lastPWRDAssets.add(toBN(300).mul(lifeGuardBase)), toBN(1));
        })
    })

    describe('distributePriceChange', function () {
        it('gain', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase));

            await mockController.setTotalAssets(toBN(160).mul(thousandBaseNum).mul(lifeGuardBase));

            await mockController.distributePriceChange();
            const res = await pnl.calcPnL();

            expect(res[0]).to.be.a.bignumber.equal(toBN(110).mul(thousandBaseNum).mul(lifeGuardBase));
            return expect(res[1]).to.be.a.bignumber.equal(toBN(50).mul(thousandBaseNum).mul(lifeGuardBase));
        })

        it('gvt loss', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase));

            await mockController.setTotalAssets(toBN(120).mul(thousandBaseNum).mul(lifeGuardBase));

            await mockController.distributePriceChange();
            const res = await pnl.calcPnL();

            expect(res[0]).to.be.a.bignumber.equal(toBN(70).mul(thousandBaseNum).mul(lifeGuardBase));
            return expect(res[1]).to.be.a.bignumber.equal(toBN(50).mul(thousandBaseNum).mul(lifeGuardBase));
        })

        it('pwrd loss', async function () {
            await mockController.increaseGTokenLastAmount(mockGvt.address, toBN(100).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.increaseGTokenLastAmount(mockPWRD.address, toBN(50).mul(thousandBaseNum).mul(lifeGuardBase));
            await mockController.setTotalAssets(toBN(150).mul(thousandBaseNum).mul(lifeGuardBase));

            await mockController.setTotalAssets(toBN(30).mul(thousandBaseNum).mul(lifeGuardBase));

            await mockController.distributePriceChange();
            const res = await pnl.calcPnL();

            expect(res[0]).to.be.a.bignumber.equal(toBN(1).mul(lifeGuardBase));
            return expect(res[1]).to.be.a.bignumber.equal(toBN(30).mul(thousandBaseNum).mul(lifeGuardBase).sub(lifeGuardBase));
        })
    })
})
