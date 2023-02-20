const DepositHandler = artifacts.require('DepositHandler');
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
const PnL = artifacts.require('PnL');
const MockInsurance = artifacts.require('MockInsurance');
// const Insurance = artifacts.require('Insurance');
// const Exposure = artifacts.require('Exposure');
// const Allocation = artifacts.require('Allocation');
const { BN, toBN } = require('web3-utils');
const { constants } = require('../utils/constants');
const { expect, ZERO } = require('../utils/common-utils');

contract('DepositHandler Test', function (accounts) {

    const decimals = ['1000000000000000000', '1000000', '1000000'];
    const deployer = accounts[0],
        governance = deployer,
        investor1 = accounts[1],
        investor2 = accounts[2],
        investor3 = accounts[3],
        exchanger = accounts[5],
        newGovernance = accounts[8];

    const baseNum = new BN(10).pow(new BN(18));

    let controller, mockVault, mockPWRD, mockLifeGuard, mockBuoy,
        pnl, insurance, exposure, allocation, depositHandler, mockInsurance,
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
        mockLifeGuard = await MockLifeGuard.new();
        mockBuoy = await MockBuoy.new();
        controller = await Controller.new(mockPWRD.address, mockVault.address, tokens, decimals);
        await mockLifeGuard.setBuoy(mockBuoy.address);
        await controller.setLifeGuard(mockLifeGuard.address);
        await mockLifeGuard.setStablecoins([mockDAI.address, mockUSDC.address, mockUSDT.address]);
        await mockLifeGuard.setController(controller.address);

        pnl = await PnL.new(mockPWRD.address, mockVault.address, 0, 0);
        pnl.setController(controller.address);
        await controller.setPnL(pnl.address);

        mockInsurance = await MockInsurance.new();
        await controller.setInsurance(mockInsurance.address);
        // await insurance.setController(controller.address);
        // exposure = await Exposure.new();
        // await exposure.setController(controller.address);
        // await insurance.setExposure(exposure.address);
        // allocation = await Allocation.new();
        // await allocation.setController(controller.address);
        // await insurance.setAllocation(allocation.address);

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
        await controller.setVault(2, mockUSDTVault.address);
        await controller.setCurveVault(mockCurveVault.address);

        depositHandler = await DepositHandler.new(
            '2',
            vaults,
            tokens,
            decimals
        );
        await controller.setDepositHandler(depositHandler.address);
        await depositHandler.setController(controller.address);
        await controller.setUtilisationRatioLimitPwrd(toBN(10000));
        await mockVault.transferOwnership(depositHandler.address);
        await mockPWRD.transferOwnership(depositHandler.address);
        await controller.addToWhitelist(depositHandler.address);

        await mockDAI.mint(investor1, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor1, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor1, new BN(10000).mul(usdtBaseNum), { from: deployer });
        await mockDAI.mint(investor2, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor2, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor2, new BN(10000).mul(usdtBaseNum), { from: deployer });

        await mockDAI.mint(exchanger, new BN(1000000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(exchanger, new BN(1000000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(exchanger, new BN(1000000).mul(usdtBaseNum), { from: deployer });

        await mockDAI.approve(mockLifeGuard.address, new BN(1000000).mul(daiBaseNum), { from: exchanger });
        await mockUSDC.approve(mockLifeGuard.address, new BN(1000000).mul(usdcBaseNum), { from: exchanger });
        await mockUSDT.approve(mockLifeGuard.address, new BN(1000000).mul(usdtBaseNum), { from: exchanger });

        await mockLifeGuard.setExchanger(exchanger);
        await depositHandler.setDependencies();
    });

    describe('deposit', function () {
        describe('revert', function () {

            it('Should revert when paused', async function () {
                await controller.pause({ from: governance });
                const investAmount = [new BN(10).mul(daiBaseNum), new BN(0), new BN(0)];
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                const lp = await mockBuoy.stableToLp(investAmount, true);
                const lpWithSlippage = lp.sub(lp.div(new BN("10000")));
                return expect(depositHandler.depositGvt(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                )).to.be.rejected;
            });

            it('Should revert when minAmount values are zero', function () {
                const investAmount = [new BN(10).mul(daiBaseNum), new BN(0), new BN(0)];
                return expect(depositHandler.depositGvt(
                    investAmount,
                    0,
                    ZERO,
                    { from: investor1 }
                )).to.be.rejectedWith('minAmount is 0');
            })

            it('Should revert when gvt amounts less than pwrd amounts', async function () {
                let investAmount = [
                    toBN(100).mul(daiBaseNum),
                    toBN(100).mul(usdcBaseNum),
                    toBN(100).mul(usdtBaseNum),
                ];
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
                await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });

                let lp = await mockBuoy.stableToLp(investAmount, true);
                let lpWithSlippage = lp.sub(lp.div(new BN("10000")));

                const usd = await mockBuoy.stableToUsd(investAmount, true);
                //const expectedLpUsdValue = "300022674714477134455";

                await mockLifeGuard.setInAmounts(investAmount);
                await depositHandler.depositGvt(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                );

                await controller.setUtilisationRatioLimitPwrd(toBN(5000));

                investAmount = [new BN(200).mul(daiBaseNum), new BN(0), new BN(0)];
                lp = await mockBuoy.stableToLp(investAmount, true);
                lpWithSlippage = lp.sub(lp.div(new BN("10000")));
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                return expect(depositHandler.depositPwrd(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                )).to.be.rejected;
            });

            it('Should revert when investor not have enough balance ', async function () {
                const investAmount = [new BN(20000).mul(daiBaseNum), new BN(0), new BN(0)];
                const lp = await mockBuoy.stableToLp(investAmount, true);
                const lpWithSlippage = lp.sub(lp.div(new BN("10000")));
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                return expect(depositHandler.depositGvt(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                )).to.be.rejectedWith('ERC20: transfer amount exceeds balance');
            });
        });

        describe('ok', function () {
            it('sardine', async () => {
                await controller.setBigFishThreshold(1000, toBN(1000).mul(baseNum));
                const investAmount = [
                    toBN(100).mul(daiBaseNum),
                    toBN(100).mul(usdcBaseNum),
                    toBN(100).mul(usdtBaseNum),
                ];
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
                await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });

                const lp = await mockBuoy.stableToLp(investAmount, true);
                const lpWithSlippage = lp.sub(lp.div(new BN("10000")));

                const usd = await mockBuoy.stableToUsd(investAmount, true);
                //const expectedLpUsdValue = "300022674714477134455";

                await depositHandler.depositGvt(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                );

                const result = await pnl.calcPnL({ from: controller.address });

                await expect(controller.totalAssets()).to.eventually.be.a.bignumber.equal(usd);
                await expect(controller.gTokenTotalAssets({ from: mockVault.address }))
                    .to.eventually.be.a.bignumber.equal(usd);
                await expect(mockDAI.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9900).mul(daiBaseNum));
                await expect(mockUSDC.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9900).mul(usdcBaseNum));
                await expect(mockUSDT.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9900).mul(usdtBaseNum));
                await expect(mockDAI.balanceOf(mockDAIVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(100).mul(daiBaseNum));
                await expect(mockUSDC.balanceOf(mockUSDCVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(100).mul(usdcBaseNum));
                return expect(mockUSDT.balanceOf(mockUSDTVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(100).mul(usdtBaseNum));
            })

            it('tuna', async () => {
                await controller.setBigFishThreshold(1000, toBN(1000).mul(baseNum));
                await mockInsurance.setVaultDeltaIndex(0);

                const investAmount = [
                    toBN(1000).mul(daiBaseNum),
                    toBN(1000).mul(usdcBaseNum),
                    toBN(1000).mul(usdtBaseNum),
                ];
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
                await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });

                const lp = await mockBuoy.stableToLp(investAmount, true);
                const lpWithSlippage = lp.sub(lp.mul(toBN(2)).div(new BN("10000")));

                const usd = await mockBuoy.stableToUsd(investAmount, true);
                //const expectedLpUsdValue = "300022674714477134455";

                await depositHandler.depositGvt(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                );

                const result = await pnl.calcPnL({ from: controller.address });

                await expect(controller.totalAssets()).to.eventually.be.a.bignumber.closeTo(usd, toBN(5).mul(baseNum));
                await expect(controller.gTokenTotalAssets({ from: mockVault.address }))
                    .to.eventually.be.a.bignumber.equal(usd);
                await expect(mockDAI.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9000).mul(daiBaseNum));
                await expect(mockUSDC.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9000).mul(usdcBaseNum));
                await expect(mockUSDT.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9000).mul(usdtBaseNum));
                await expect(mockDAI.balanceOf(mockDAIVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(3000).mul(daiBaseNum));
                await expect(mockUSDC.balanceOf(mockUSDCVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(0).mul(usdcBaseNum));
                return expect(mockUSDT.balanceOf(mockUSDTVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(0).mul(usdtBaseNum));
            })

            it('whale', async () => {
                const investAmount = [
                    toBN(100).mul(daiBaseNum),
                    toBN(100).mul(usdcBaseNum),
                    toBN(100).mul(usdtBaseNum),
                ];
                await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
                await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
                await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });

                const lp = await mockBuoy.stableToLp(investAmount, true);
                const lpWithSlippage = lp.sub(lp.div(new BN("10000")));

                const usd = await mockBuoy.stableToUsd(investAmount, true);
                //const expectedLpUsdValue = "300022674714477134455";

                await mockLifeGuard.setInAmounts(investAmount);
                await depositHandler.depositGvt(
                    investAmount,
                    lpWithSlippage,
                    ZERO,
                    { from: investor1 }
                );

                const result = await pnl.calcPnL({ from: controller.address });


                await expect(controller.totalAssets()).to.eventually.be.a.bignumber.equal(usd);
                await expect(controller.gTokenTotalAssets({ from: mockVault.address }))
                    .to.eventually.be.a.bignumber.equal(usd);
                await expect(mockDAI.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9900).mul(daiBaseNum));
                await expect(mockUSDC.balanceOf(investor1))
                    .to.eventually.be.a.bignumber.equal(new BN(9900).mul(usdcBaseNum));
                await expect(mockDAI.balanceOf(mockDAIVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(100).mul(daiBaseNum));
                await expect(mockUSDC.balanceOf(mockUSDCVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(100).mul(usdcBaseNum));
                return expect(mockUSDT.balanceOf(mockUSDTVault.address))
                    .to.eventually.be.a.bignumber.equal(new BN(100).mul(usdtBaseNum));
            });
        })
    });
})
