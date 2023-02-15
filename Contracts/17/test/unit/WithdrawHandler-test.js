const WithdrawHandler = artifacts.require('WithdrawHandler');
const DepositHandler = artifacts.require('DepositHandler');
const Controller = artifacts.require('Controller');
const MockGvtTokenToken = artifacts.require('MockGvtToken');
const MockPWRDToken = artifacts.require('MockPWRDToken');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDT');
const MockVaultAdaptor = artifacts.require('MockVaultAdaptor');
const MockLifeGuard = artifacts.require('MockLifeGuard');
const MockBuoy = artifacts.require('MockBuoy');
const MockLPToken = artifacts.require('MockLPToken');
const PnL = artifacts.require('PnL');
const MockInsurance = artifacts.require('MockInsurance')
const { BN, toBN, isTopic } = require('web3-utils');
const { constants } = require('../utils/constants');
const { expect, ZERO } = require('../utils/common-utils');

contract('WithdrawHandler Test', function (accounts) {

    const decimals = ['1000000000000000000', '1000000', '1000000'];
    const deployer = accounts[0],
        governance = deployer,
        investor1 = accounts[1],
        investor2 = accounts[2],
        investor3 = accounts[3],
        newGovernance = accounts[8];

    const baseNum = new BN(10).pow(new BN(18));

    let controller, mockVault, mockPWRD, mockLifeGuard, mockBuoy, pnl, mockInsurance, withdrawHandler,
        daiBaseNum, usdcBaseNum,
        mockDAI, mockUSDC, mockUSDT, mockLPToken,
        mockDAIVault, mockUSDCVault, mockUSDTVault, mockCurveVault;

    async function calcWithdrawTokens(lpAmount, slippage = 1) {
        const tokenAmounts = await withdrawHandler.getVaultDeltas(lpAmount);
        const tokenAmountsWithSlippage = [];
        for (let i = 0; i < tokenAmounts.length; i++) {
            tokenAmountsWithSlippage[i] = tokenAmounts[i].sub(tokenAmounts[i].mul(toBN(slippage)).div(toBN(1000)));
        }
        return tokenAmountsWithSlippage;
    }

    async function calcWithdrawToken(lpAmount, index) {
        const tokenAmount = await mockBuoy.singleStableFromLp(lpAmount, index);
        return tokenAmount.sub(tokenAmount.mul(toBN(1)).div(toBN(1000)));
    }

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

        mockLifeGuard = await MockLifeGuard.new();
        mockBuoy = await MockBuoy.new();
        await mockLifeGuard.setBuoy(mockBuoy.address);
        await controller.setLifeGuard(mockLifeGuard.address);
        await mockLifeGuard.setStablecoins([mockDAI.address, mockUSDC.address, mockUSDT.address]);
        await mockLifeGuard.setController(controller.address);

        pnl = await PnL.new(mockPWRD.address, mockVault.address, 0, 0);
        await pnl.setController(controller.address);
        await controller.setPnL(pnl.address);

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
        await controller.addToWhitelist(depositHandler.address);

        withdrawHandler = await WithdrawHandler.new(
            vaults,
            tokens,
            decimals
        );
        await controller.setWithdrawHandler(withdrawHandler.address, ZERO);
        await withdrawHandler.setController(controller.address);
        await controller.setUtilisationRatioLimitGvt(toBN(10000));
        await controller.addToWhitelist(withdrawHandler.address);

        await controller.setWithdrawalFee(false, 50);

        await controller.setBigFishThreshold(1000, toBN(1000).mul(baseNum));

        await mockDAI.mint(investor1, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor1, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor1, new BN(10000).mul(usdtBaseNum), { from: deployer });

        await mockDAI.mint(investor2, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor2, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor2, new BN(10000).mul(usdtBaseNum), { from: deployer });

        await mockDAIVault.approve(mockLifeGuard.address, new BN(10000).mul(daiBaseNum));
        await mockUSDCVault.approve(mockLifeGuard.address, new BN(10000).mul(usdcBaseNum));
        await mockUSDTVault.approve(mockLifeGuard.address, new BN(10000).mul(usdtBaseNum));
        await withdrawHandler.setDependencies();
        await depositHandler.setDependencies();
    });

    describe('withdrawByLPToken', function () {
        beforeEach(async function () {
            const investAmount = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor1 }
            );

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor2 });
            lp = await mockBuoy.stableToLp(investAmount, true);
            lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                1,
                ZERO,
                { from: investor2 }
            );
        })

        it('Should work when paused', async function () {
            await controller.pause({ from: governance });
            const amounts = [new BN(10).mul(daiBaseNum), new BN(0), new BN(0)];
            return expect(withdrawHandler.withdrawByLPToken(false, 1, amounts, { from: investor1 })).to.be.fulfilled;
        })

        it('Should revert when lpAmount values are zero', async function () {
            const amounts = [new BN(10).mul(daiBaseNum), new BN(0), new BN(0)];
            return expect(withdrawHandler.withdrawByLPToken(false, 0, amounts, { from: investor1 })).to.be.rejectedWith('!minAmount');
        })

        it('Should revert when gvt amounts less than pwrd amounts', async function () {
            let amounts = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];
            await mockDAI.approve(depositHandler.address, amounts[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, amounts[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, amounts[2], { from: investor2 });
            let lp = await mockBuoy.stableToLp(amounts, true);
            const lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositPwrd(
                amounts,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            const usd = toBN(250).mul(baseNum);
            await mockLifeGuard.setDepositStableAmount(usd);
            lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            amounts = await calcWithdrawTokens(lpWithoutFee);
            //add system slippage

            await controller.setUtilisationRatioLimitGvt(toBN(8500));
            return expect(withdrawHandler.withdrawByLPToken(
                false,
                lp,
                amounts,
                { from: investor1 }
            )).to.be.rejected;
        })

        it('Should revert when user balance is not enough', async function () {
            const usd = toBN(350).mul(baseNum);
            const lp = await mockBuoy.usdToLp(usd);
            const amounts = await withdrawHandler.getVaultDeltas(lp);
            await mockLifeGuard.setDepositStableAmount(usd);
            //add system slippage
            return expect(withdrawHandler.withdrawByLPToken(
                false,
                lp,
                amounts,
                { from: investor1 }
            )).to.be.rejectedWith('!withdraw: not enough balance');
        })

        it('ok normal', async () => {
            const userDAIPre = await mockDAI.balanceOf(investor1);
            const userUSDCPre = await mockUSDC.balanceOf(investor1);
            const userUSDTPre = await mockUSDT.balanceOf(investor1);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = toBN(100).mul(baseNum);
            const lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const tokens = await calcWithdrawTokens(lpWithoutFee);


            await withdrawHandler.withdrawByLPToken(false, lp, tokens, { from: investor1 });


            const userDAIPost = await mockDAI.balanceOf(investor1);
            const userUSDCPost = await mockUSDC.balanceOf(investor1);
            const userUSDTPost = await mockUSDT.balanceOf(investor1);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(500).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(1).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(500).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(1).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost.sub(userUSDCPre)).to.be.a.bignumber.equal(vaultUSDCPre.sub(vaultUSDCPost));
            return expect(userUSDTPost.sub(userUSDTPre)).to.be.a.bignumber.equal(vaultUSDTPre.sub(vaultUSDTPost));
        })

        it('ok whale', async () => {
            await controller.setBigFishThreshold(1, 0);

            const userDAIPre = await mockDAI.balanceOf(investor1);
            const userUSDCPre = await mockUSDC.balanceOf(investor1);
            const userUSDTPre = await mockUSDT.balanceOf(investor1);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = toBN(200).mul(baseNum);
            const lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const tokens = await calcWithdrawTokens(lpWithoutFee);
            await mockLifeGuard.setDepositStableAmount(lpWithoutFee);


            await withdrawHandler.withdrawByLPToken(false, lp, tokens, { from: investor1 });

            const userDAIPost = await mockDAI.balanceOf(investor1);
            const userUSDCPost = await mockUSDC.balanceOf(investor1);
            const userUSDTPost = await mockUSDT.balanceOf(investor1);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);

            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(400).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(1).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(400).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(1).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost.sub(userUSDCPre)).to.be.a.bignumber.equal(vaultUSDCPre.sub(vaultUSDCPost));
            return expect(userUSDTPost.sub(userUSDTPre)).to.be.a.bignumber.equal(vaultUSDTPre.sub(vaultUSDTPost));
        })
    });

    describe('withdrawByStablecoin', function () {
        beforeEach(async function () {
            const investAmount = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor1 }
            );

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor2 });
            lp = await mockBuoy.stableToLp(investAmount, true);
            lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );
        })

        it('Should revert when invalid index', async function () {
            return expect(withdrawHandler.withdrawByStablecoin(false, 10, 1, 1, { from: investor1 })).to.be.rejectedWith('invalid index');
        })

        it('Should allow to withdraw pwrd when paused', async function () {
            const investAmount = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositPwrd(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor1 }
            );

            const initialPwrd = await mockPWRD.balanceOf(investor1);
            const initialUsdc = await mockUSDC.balanceOf(investor1);
            await controller.pause({ from: governance });
            lp = await mockBuoy.usdToLp('50000000000000000000');
            let lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            let token = await calcWithdrawToken(lpWithoutFee, 1);
            await mockLifeGuard.setInAmounts([0, token, 0])
            await expect(
               withdrawHandler.withdrawByStablecoin(true, 1, lp, 0, { from: investor1 })
            ).to.eventually.be.fulfilled;
            await expect(mockPWRD.balanceOf(investor1)).to.eventually.be.a.bignumber.lessThan(initialPwrd);
            await expect(mockUSDC.balanceOf(investor1)).to.eventually.be.a.bignumber.greaterThan(initialUsdc);
            const initialDAI = await mockDAI.balanceOf(investor1);
            await controller.setBigFishThreshold(1, 0);
            const userPwrd = await mockPWRD.getAssets(investor1);
            await mockLifeGuard.setInAmounts([userPwrd, 0, 0])
            lp = await mockBuoy.usdToLp(userPwrd);
            lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            token = await calcWithdrawToken(lpWithoutFee, 1);
            await mockLifeGuard.setInAmounts([token, 0, 0])
            await expect(
               withdrawHandler.withdrawAllSingle(true, 0, 0, { from: investor1 })
            ).to.eventually.be.fulfilled
            await expect(mockPWRD.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(new BN('0'));
            return expect(mockDAI.balanceOf(investor1)).to.eventually.be.a.bignumber.greaterThan(initialDAI);
        })

        it('Should revert balanced withdrawals when in emergency when paused', async function () {
            await controller.emergency(0, { from: governance });
            return expect(withdrawHandler.withdrawByLPToken(false, 0, 1, 1, { from: investor1 })).to.be.rejected;
        })

        it('Should revert when lpAmount values are zero', async function () {
            return expect(
                withdrawHandler.withdrawByStablecoin(false, 0, 0, 0, { from: investor1 })
            ).to.be.rejected;
        })

        it('Should revert when gvt amounts less than pwrd amounts', async function () {
            let amounts = [
                toBN(150).mul(daiBaseNum),
                toBN(150).mul(usdcBaseNum),
                toBN(200).mul(usdtBaseNum)
            ];
            await mockDAI.approve(depositHandler.address, amounts[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, amounts[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, amounts[2], { from: investor2 });
            let lp = await mockBuoy.stableToLp(amounts, true);
            const lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositPwrd(
                amounts,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            amount = toBN(250).mul(baseNum);
            lp = await mockBuoy.usdToLp(amount);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const scAmount = await calcWithdrawToken(lpWithoutFee, 0);
            return expect(withdrawHandler.withdrawByStablecoin(
                false,
                0,
                lp,
                scAmount,
                { from: investor1 }
            )).to.be.rejected;
        })

        it('Should revert when user balance is not enough', async function () {
            const amount = toBN(350).mul(baseNum);
            const lp = await mockBuoy.usdToLp(amount);
            const scAmount = await mockLifeGuard.singleStableFromLp(lp, 0);

            return expect(withdrawHandler.withdrawByStablecoin(
                false,
                0,
                lp,
                scAmount,
                { from: investor1 }
            )).to.be.rejectedWith('!withdraw: not enough balance');
        })

        it('ok normal', async () => {
            const userDAIPre = await mockDAI.balanceOf(investor1);
            const userUSDCPre = await mockUSDC.balanceOf(investor1);
            const userUSDTPre = await mockUSDT.balanceOf(investor1);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = toBN(100).mul(baseNum);
            const lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const token = await calcWithdrawToken(lpWithoutFee, 0);


            await withdrawHandler.withdrawByStablecoin(false, 0, lp, token, { from: investor1 });

            const userDAIPost = await mockDAI.balanceOf(investor1);
            const userUSDCPost = await mockUSDC.balanceOf(investor1);
            const userUSDTPost = await mockUSDT.balanceOf(investor1);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(500).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(500).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost).to.be.a.bignumber.equal(userUSDCPre);
            expect(vaultUSDCPre).to.be.a.bignumber.equal(vaultUSDCPost);
            expect(userUSDTPost).to.be.a.bignumber.equal(userUSDTPre);
            return expect(vaultUSDTPre).to.be.a.bignumber.equal(vaultUSDTPost);
        })

        it('ok whale', async () => {
            await controller.setBigFishThreshold(1, 0);

            const userDAIPre = await mockDAI.balanceOf(investor1);
            const userUSDCPre = await mockUSDC.balanceOf(investor1);
            const userUSDTPre = await mockUSDT.balanceOf(investor1);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = toBN(200).mul(baseNum);
            const lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const token = await calcWithdrawToken(lpWithoutFee, 0);


            await mockLifeGuard.setInAmounts([token, 0, 0])
            await withdrawHandler.withdrawByStablecoin(false, 0, lp, token, { from: investor1 });

            const userDAIPost = await mockDAI.balanceOf(investor1);
            const userUSDCPost = await mockUSDC.balanceOf(investor1);
            const userUSDTPost = await mockUSDT.balanceOf(investor1);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(400).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(400).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost).to.be.a.bignumber.equal(userUSDCPre);
            expect(vaultUSDCPre).to.be.a.bignumber.equal(vaultUSDCPost);
            expect(userUSDTPost).to.be.a.bignumber.equal(userUSDTPre);
            return expect(vaultUSDTPre).to.be.a.bignumber.equal(vaultUSDTPost);
        })
    })

    describe('withdrawAllSingle', function () {
        beforeEach(async function () {
            const investAmount = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor1 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor1 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor1 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor1 }
            );
        })

        it('Should revert when invalid index', async function () {
            return expect(withdrawHandler.withdrawAllSingle(false, 10, 1, { from: investor1 })).to.be.rejectedWith('invalid index');
        })

        it('Should revert when paused', async function () {
            await controller.pause({ from: governance });
            return expect(withdrawHandler.withdrawAllSingle(false, 0, 1, { from: investor1 })).to.be.rejected;
        })

        it('Should revert when gvt amounts less than pwrd amounts', async function () {
            let amounts = [
                toBN(250).mul(daiBaseNum),
                toBN(0).mul(usdcBaseNum),
                toBN(0).mul(usdtBaseNum)
            ];
            await mockDAI.approve(depositHandler.address, amounts[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, amounts[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, amounts[2], { from: investor2 });
            let lp = await mockBuoy.stableToLp(amounts, true);
            const lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositPwrd(
                amounts,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            return expect(withdrawHandler.withdrawAllSingle(false, 0, toBN(99).mul(daiBaseNum), { from: investor1 })).to.be.rejected;
        })

        it('ok normal', async () => {
            const investAmount = [
                toBN(200).mul(daiBaseNum),
                0,
                0,
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor2 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            const userDAIPre = await mockDAI.balanceOf(investor2);
            const userUSDCPre = await mockUSDC.balanceOf(investor2);
            const userUSDTPre = await mockUSDT.balanceOf(investor2);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = await mockVault.getAssets(investor2);
            lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const token = await calcWithdrawToken(lpWithoutFee, 0);


            await withdrawHandler.withdrawAllSingle(false, 0, token, { from: investor2 });

            const userDAIPost = await mockDAI.balanceOf(investor2);
            const userUSDCPost = await mockUSDC.balanceOf(investor2);
            const userUSDTPost = await mockUSDT.balanceOf(investor2);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);

            const userGvtPost = await mockVault.getAssets(investor2);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(300).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(300).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost).to.be.a.bignumber.equal(userUSDCPre);
            expect(vaultUSDCPre).to.be.a.bignumber.equal(vaultUSDCPost);
            expect(userUSDTPost).to.be.a.bignumber.equal(userUSDTPre);
            expect(vaultUSDTPre).to.be.a.bignumber.equal(vaultUSDTPost);
            return expect(userGvtPost).to.be.a.bignumber.equal(toBN(0));
        })

        it('ok whale', async () => {
            const investAmount = [
                toBN(200).mul(daiBaseNum),
                0,
                0,
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor2 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            await controller.setBigFishThreshold(1, 0);

            const userDAIPre = await mockDAI.balanceOf(investor2);
            const userUSDCPre = await mockUSDC.balanceOf(investor2);
            const userUSDTPre = await mockUSDT.balanceOf(investor2);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = toBN(200).mul(baseNum);
            lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const token = await calcWithdrawToken(lpWithoutFee, 0);


            await mockLifeGuard.setInAmounts([token, 0, 0])
            await withdrawHandler.withdrawAllSingle(false, 0, token, { from: investor2 });

            const userDAIPost = await mockDAI.balanceOf(investor2);
            const userUSDCPost = await mockUSDC.balanceOf(investor2);
            const userUSDTPost = await mockUSDT.balanceOf(investor2);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);

            const userGvtPost = await mockVault.getAssets(investor2);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(300).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(300).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost).to.be.a.bignumber.equal(userUSDCPre);
            expect(vaultUSDCPre).to.be.a.bignumber.equal(vaultUSDCPost);
            expect(userUSDTPost).to.be.a.bignumber.equal(userUSDTPre);
            expect(vaultUSDTPre).to.be.a.bignumber.equal(vaultUSDTPost);
            return expect(userGvtPost).to.be.a.bignumber.equal(toBN(0));
        })
    })

    describe('withdrawAllBalanced', function () {
        beforeEach(async function () {
            const investAmount = [
                toBN(300).mul(daiBaseNum),
                toBN(300).mul(usdcBaseNum),
                toBN(300).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, toBN(10000).mul(daiBaseNum), { from: investor1 });
            await mockUSDC.approve(depositHandler.address, toBN(10000).mul(usdcBaseNum), { from: investor1 });
            await mockUSDT.approve(depositHandler.address, toBN(10000).mul(usdtBaseNum), { from: investor1 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor1 }
            );

            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor1 }
            );
        })

        it('Should revert when paused', async function () {
            await controller.pause({ from: governance });
            return expect(withdrawHandler.withdrawAllBalanced(false, [1, 1, 1], { from: investor1 })).to.be.rejected;
        })

        it('Should revert when gvt amounts less than pwrd amounts', async function () {
            let amounts = [
                toBN(300).mul(daiBaseNum),
                toBN(300).mul(usdcBaseNum),
                toBN(300).mul(usdtBaseNum)
            ];
            await mockDAI.approve(depositHandler.address, amounts[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, amounts[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, amounts[2], { from: investor2 });
            let lp = await mockBuoy.stableToLp(amounts, true);
            const lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositPwrd(
                amounts,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            await controller.setBigFishThreshold(1, 0);

            return expect(withdrawHandler.withdrawAllBalanced(false, [0, 0, 0], { from: investor1 })).to.be.rejected;
        })

        it('ok normal', async () => {
            const investAmount = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor2 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            const userDAIPre = await mockDAI.balanceOf(investor2);
            const userUSDCPre = await mockUSDC.balanceOf(investor2);
            const userUSDTPre = await mockUSDT.balanceOf(investor2);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            const usd = await mockVault.getAssets(investor2);
            lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const tokens = await calcWithdrawTokens(lpWithoutFee);

            await withdrawHandler.withdrawAllBalanced(false, tokens, { from: investor2 });

            const userDAIPost = await mockDAI.balanceOf(investor2);
            const userUSDCPost = await mockUSDC.balanceOf(investor2);
            const userUSDTPost = await mockUSDT.balanceOf(investor2);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);

            const userGvtPost = await mockVault.getAssets(investor2);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(1800).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(1800).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost.sub(userUSDCPre)).to.be.a.bignumber.equal(vaultUSDCPre.sub(vaultUSDCPost));
            expect(userUSDTPost.sub(userUSDTPre)).to.be.a.bignumber.equal(vaultUSDTPre.sub(vaultUSDTPost));
            return expect(userGvtPost).to.be.a.bignumber.equal(toBN(0));
        })

        it('ok whale', async () => {
            const investAmount = [
                toBN(100).mul(daiBaseNum),
                toBN(100).mul(usdcBaseNum),
                toBN(100).mul(usdtBaseNum)
            ];

            await mockDAI.approve(depositHandler.address, investAmount[0], { from: investor2 });
            await mockUSDC.approve(depositHandler.address, investAmount[1], { from: investor2 });
            await mockUSDT.approve(depositHandler.address, investAmount[2], { from: investor2 });
            let lp = await mockBuoy.stableToLp(investAmount, true);
            let lpWithSlippage = lp.sub(lp.div(new BN("10000")));
            await depositHandler.depositGvt(
                investAmount,
                lpWithSlippage,
                ZERO,
                { from: investor2 }
            );

            const userDAIPre = await mockDAI.balanceOf(investor2);
            const userUSDCPre = await mockUSDC.balanceOf(investor2);
            const userUSDTPre = await mockUSDT.balanceOf(investor2);

            const vaultDAIPre = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPre = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPre = await mockUSDT.balanceOf(mockUSDTVault.address);

            await controller.setBigFishThreshold(1, 0);

            const usd = await mockVault.getAssets(investor2);
            lp = await mockBuoy.usdToLp(usd);
            const lpWithoutFee = lp.sub(lp.mul(toBN('50')).div(toBN('10000')));
            const tokens = await calcWithdrawTokens(lpWithoutFee);
            await mockLifeGuard.setDepositStableAmount(lpWithoutFee);


            await withdrawHandler.withdrawAllBalanced(false, tokens, { from: investor2 });

            const userDAIPost = await mockDAI.balanceOf(investor2);
            const userUSDCPost = await mockUSDC.balanceOf(investor2);
            const userUSDTPost = await mockUSDT.balanceOf(investor2);

            const vaultDAIPost = await mockDAI.balanceOf(mockDAIVault.address);
            const vaultUSDCPost = await mockUSDC.balanceOf(mockUSDCVault.address);
            const vaultUSDTPost = await mockUSDT.balanceOf(mockUSDTVault.address);

            const userGvtPost = await mockVault.getAssets(investor2);


            await expect(controller.gTokenTotalAssets({ from: mockVault.address })).to.eventually.be.a.bignumber
                .closeTo(toBN(1800).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            await expect(controller.totalAssets()).to.eventually.be.a.bignumber
                .closeTo(toBN(1800).mul(baseNum).add(usd.mul(toBN(5)).div(toBN(1000))), toBN(5).mul(baseNum).div(toBN(10)));
            expect(userDAIPost.sub(userDAIPre)).to.be.a.bignumber.equal(vaultDAIPre.sub(vaultDAIPost));
            expect(userUSDCPost.sub(userUSDCPre)).to.be.a.bignumber.equal(vaultUSDCPre.sub(vaultUSDCPost));
            expect(userUSDTPost.sub(userUSDTPre)).to.be.a.bignumber.equal(vaultUSDTPre.sub(vaultUSDTPost));
            return expect(userGvtPost).to.be.a.bignumber.equal(toBN(0));

        })
    })
})
