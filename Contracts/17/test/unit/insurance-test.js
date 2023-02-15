const Exposure = artifacts.require('Exposure');
const Insurance = artifacts.require('Insurance');
const Allocation = artifacts.require('Allocation');
const MockController = artifacts.require('MockController');
const MockGvtToken = artifacts.require('MockGvtToken');
const MockPWRDToken = artifacts.require('MockPWRDToken');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDT');
const MockVaultAdaptor = artifacts.require('MockVaultAdaptor');
const MockLifeGuard = artifacts.require('MockLifeGuard');
const MockLPToken = artifacts.require('MockLPToken');
const MockBuoy = artifacts.require('MockBuoy');
const MockPnL = artifacts.require('MockPnL');
const { BN, toBN } = require('web3-utils');
const { constants } = require('../utils/constants');
const { expect } = require('../utils/common-utils');

const {
    getSystemAssetsInfo,
    printSystemAsset,
} = require('../utils/common-utils');

contract('Insurance Test', function (accounts) {
    let mockController, mockGvt, mockPwrd, mockLifeGuard, mockBuoy, mockPnl, insurance, exposure, allocation,
        daiBaseNum, usdcBaseNum, mockDAI, mockUSDC, mockUSDT, mockDAIVault, mockUSDCVault, mockUSDTVault,
        mockLPToken, mockCurveVault;

    const deployer = accounts[0],
        governance = deployer,
        investor1 = accounts[1],
        investor2 = accounts[2],
        investor3 = accounts[3],
        alpha = accounts[7],
        curve = accounts[8],
        compound = accounts[9];

    const vaultTargetPercents = [toBN(3900), toBN(2600), toBN(3500)],
        percentFactor = toBN(10000);

    async function setVaultAssets(vault, vaultTotal, strategyOne, strategyTwo, baseNum) {
        await vault.setTotal(vaultTotal.mul(baseNum));
        await vault.setStrategyAssets(0, strategyOne.mul(baseNum));
        if (strategyTwo) {
            await vault.setStrategyAssets(1, strategyTwo.mul(baseNum));
        }
    }

    beforeEach(async function () {
        mockDAI = await MockDAI.new();
        mockUSDC = await MockUSDC.new();
        mockUSDT = await MockUSDT.new();
        mockLPToken = await MockLPToken.new();
        daiBaseNum = new BN(10).pow(await mockDAI.decimals());
        usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
        baseNum = new BN(10).pow(new BN(18));

        mockDAIVault = await MockVaultAdaptor.new();
        mockUSDCVault = await MockVaultAdaptor.new();
        mockUSDTVault = await MockVaultAdaptor.new();
        mockCurveVault = await MockVaultAdaptor.new();

        mockController = await MockController.new({ from: governance });
        mockGvt = await MockGvtToken.new();
        mockPwrd = await MockPWRDToken.new();
        await mockGvt.transferOwnership(mockController.address);
        await mockPwrd.transferOwnership(mockController.address);

        await mockDAIVault.setUnderlyingToken(mockDAI.address);
        await mockUSDCVault.setUnderlyingToken(mockUSDC.address);
        await mockUSDTVault.setUnderlyingToken(mockUSDT.address);
        await mockCurveVault.setUnderlyingToken(mockLPToken.address);

        await mockController.setUnderlyingTokens([mockDAI.address, mockUSDC.address, mockUSDT.address], { from: governance });
        await mockController.setVault(0, mockDAIVault.address);
        await mockController.setVault(1, mockUSDCVault.address);
        await mockController.setVault(2, mockUSDTVault.address);
        await mockController.setCurveVault(mockCurveVault.address);

        await mockController.setUtilisationRatioLimitForDeposit(toBN(10000));

        mockLifeGuard = await MockLifeGuard.new();
        mockBuoy = await MockBuoy.new();
        await mockLifeGuard.setBuoy(mockBuoy.address);
        await mockController.setLifeGuard(mockLifeGuard.address);
        await mockLifeGuard.setStablecoins([mockDAI.address, mockUSDC.address, mockUSDT.address]);

        mockPnl = await MockPnL.new();
        await mockController.setPnL(mockPnl.address);

        insurance = await Insurance.new();
        await mockController.setInsurance(insurance.address);
        await insurance.setController(mockController.address);
        await insurance.setExposureBufferRebalance(new BN(50));

        await insurance.setUnderlyingTokenPercent(0, vaultTargetPercents[0]);
        await insurance.setUnderlyingTokenPercent(1, vaultTargetPercents[1]);
        await insurance.setUnderlyingTokenPercent(2, vaultTargetPercents[2]);

        exposure = await Exposure.new();
        await insurance.setExposure(exposure.address);
        await exposure.setController(mockController.address);

        allocation = await Allocation.new();
        await insurance.setAllocation(allocation.address);
        await allocation.setController(mockController.address);

        daiBaseNum = new BN(10).pow(await mockDAI.decimals());
        usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
        usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());

        await mockDAI.mint(investor1, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor1, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor1, new BN(10000).mul(usdtBaseNum), { from: deployer });
        await mockDAI.mint(investor2, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor2, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockUSDT.mint(investor2, new BN(10000).mul(usdtBaseNum), { from: deployer });

        await exposure.setProtocolCount(2)
        await exposure.setMakerUSDCExposure(new BN(3120));

        await setVaultAssets(mockDAIVault, new BN(10000), new BN(6000), new BN(4000), daiBaseNum);
        await setVaultAssets(mockUSDCVault, new BN(10000), new BN(6000), new BN(4000), usdcBaseNum);
        await setVaultAssets(mockUSDTVault, new BN(10000), new BN(6000), new BN(4000), usdtBaseNum);
        await setVaultAssets(mockCurveVault, new BN(3000), new BN(3000), undefined, daiBaseNum);

        await mockLifeGuard.setInAmounts([toBN(1000).mul(daiBaseNum), toBN(1000).mul(usdcBaseNum), toBN(1000).mul(usdtBaseNum)])
        await mockLifeGuard.deposit();
    });

    describe('Insurance', function () {
        it('get Delta', async () => {
            const result = await insurance.getDelta(toBN(10000).mul(baseNum));
            return expect(result.toString()).equal('2200,4800,3000');
        })

        it('calculateDepositDeltasOnAllVaults', async () => {
            const result = await insurance.calculateDepositDeltasOnAllVaults();
            return expect(result.toString()).equal('3900,2600,3500');
        })

        it('getVaultDeltaForDeposit return 1', async () => {
            await insurance.setWhaleThresholdDeposit(1000);
            const result = await insurance.getVaultDeltaForDeposit(toBN(1000).mul(baseNum));
            expect(result[0].toString()).equal('10000,0,0');
            expect(result[1].toString()).equal('0,2,1');
            return expect(result[2]).to.be.a.bignumber.equal(toBN(1));
        })

        it('getVaultDeltaForDeposit return 3', async () => {
            const result = await insurance.getVaultDeltaForDeposit(toBN(1000).mul(baseNum));
            expect(result[0].toString()).equal('0,0,0');
            expect(result[1].toString()).equal('0,0,0');
            return expect(result[2]).to.be.a.bignumber.equal(toBN(3));
        })

        describe('rebalanceTrigger', function () {
            beforeEach(async function () {
                await mockPnl.setLastGvtAssets(new BN(17000).mul(baseNum));
                await mockPnl.setLastPwrdAssets(new BN(16000).mul(baseNum));
            });

            it('Should trigger rebalance when exposure is above threshold', async function () {
                const result = await insurance.rebalanceTrigger();
                return expect(result).to.be.equal(true);
            });

            it('Should not trigger rebalance when exposure is blow threshold', async function () {
                await mockPnl.setLastGvtAssets(new BN(20000).mul(baseNum));
                await mockPnl.setLastPwrdAssets(new BN(13000).mul(baseNum));
                const result = await insurance.rebalanceTrigger();
                return expect(result).to.be.equal(false);
            });
        });

        describe('calcSkim', function () {
            it('return curveVaultPercent when totalAssets is 0', async () => {
                await insurance.setCurveVaultPercent(1500);
                return expect(insurance.calcSkim()).to.eventually.be.a.bignumber.equal(toBN(1500));
            })

            it('return curveVaultPercent when < curveVaultPercent', async () => {
                await insurance.setCurveVaultPercent(1000);
                await mockPnl.setLastGvtAssets(toBN(20000).mul(baseNum));
                await mockPnl.setLastPwrdAssets(toBN(10100).mul(baseNum));
                return expect(insurance.calcSkim()).to.eventually.be.a.bignumber.equal(toBN(1000));
            })

            it('return 0 when > curveVaultPercent', async () => {
                await insurance.setCurveVaultPercent(1000);
                await mockPnl.setLastGvtAssets(toBN(20000).mul(baseNum));
                await mockPnl.setLastPwrdAssets(toBN(10000).mul(baseNum));
                return expect(insurance.calcSkim()).to.eventually.be.a.bignumber.equal(toBN(0));
            })
        });

        describe('rebalanceForWithdraw', function () {

        })
    })

    describe('Allocation', function () {
        async function calcVaultTargetDelta(vaultAssets, targetPercents) {
            let totalAssets = toBN(0);
            let vaultTargetAssets = Array(vaultAssets.length).fill(toBN(0));
            let vaultAssetsUsd = Array(vaultAssets.length).fill(toBN(0));
            let swapInsSB = Array(vaultAssets.length).fill(toBN(0));
            let swapIns = Array(vaultAssets.length).fill(toBN(0));
            let swapOuts = Array(vaultAssets.length).fill(toBN(0));
            let swapInTotal = toBN(0);
            let swapOutTotal = toBN(0);
            for (let i = 0; i < vaultAssets.length; i++) {
                vaultAssetsUsd[i] = await mockBuoy.singleStableToUsd(vaultAssets[i], i);
                totalAssets = totalAssets.add(vaultAssetsUsd[i]);
            }
            for (let i = 0; i < vaultAssets.length; i++) {
                vaultTargetAssets[i] = totalAssets.mul(targetPercents[i]).div(percentFactor);
                if (vaultAssetsUsd[i].gt(vaultTargetAssets[i])) {
                    swapIns[i] = vaultAssetsUsd[i].sub(vaultTargetAssets[i]);
                    swapInTotal = swapInTotal.add(swapIns[i]);
                    swapInsSB[i] = vaultAssets[i].sub(await mockBuoy.singleStableFromUsd(vaultTargetAssets[i], i));
                } else {
                    swapOuts[i] = vaultTargetAssets[i].sub(vaultAssetsUsd[i]);
                    swapOutTotal = swapOutTotal.add(swapOuts[i])
                }
            }
            let percent = toBN(10000);
            if (swapOutTotal > 0) {
                for (let i = 0; i < swapOuts.length - 1; i++) {
                    swapOuts[i] = swapOuts[i].mul(percentFactor).div(swapOutTotal);
                    percent = percent.sub(swapOuts[i]);
                }
            }
            swapOuts[swapOuts.length - 1] = percent;
            let result = {}
            result.swapIns = swapIns;
            result.swapInsSB = swapInsSB;
            result.swapOuts = swapOuts;
            result.vaultTargetAssets = vaultTargetAssets;
            result.swapInTotal = swapInTotal;
            return result;
        }

        it('calcVaultTargetDelta all', async () => {
            const sysState = await insurance.prepareCalculation();
            const result1 = await allocation.calcVaultTargetDelta(sysState, false);

            const vaultAssets = Array(3);
            vaultAssets[0] = await mockDAIVault.totalAssets();
            vaultAssets[1] = await mockUSDCVault.totalAssets();
            vaultAssets[2] = await mockUSDTVault.totalAssets();

            const result2 = await calcVaultTargetDelta(vaultAssets, vaultTargetPercents);
            expect(result2.swapIns.toString()).equal(result1.swapInAmountsUsd.toString());
            expect(result2.swapInsSB.toString()).equal(result1.swapInAmounts.toString());
            expect(result2.swapOuts.toString()).equal(result1.swapOutPercents.toString());
            expect(result2.swapInTotal).to.be.a.bignumber.equal(result1.swapInTotalAmountUsd);
            return expect(result2.vaultTargetAssets.toString()).equal(result1.vaultsTargetUsd.toString());
        })

        it('calcVaultTargetDelta onlySwapOut', async () => {
            const sysState = await insurance.prepareCalculation();
            const result1 = await allocation.calcVaultTargetDelta(sysState, true);

            const vaultAssets = Array(3);
            vaultAssets[0] = await mockDAIVault.totalAssets();
            vaultAssets[1] = await mockUSDCVault.totalAssets();
            vaultAssets[2] = await mockUSDTVault.totalAssets();

            const result2 = await calcVaultTargetDelta(vaultAssets, vaultTargetPercents);
            return expect(result2.swapOuts.toString()).equal(result1.swapOutPercents.toString());
        })

        it('calcStrategyPercent when utilization is above TertiaryStrategyThreshold', async function () {
            const utilizationRatio = new BN(8000);
            const result = await allocation.calcStrategyPercent(utilizationRatio);
            expect(result[0]).to.be.a.bignumber.equal(new BN(5555));
            return expect(result[1]).to.be.a.bignumber.equal(new BN(4445));
        });

        it('calcStrategyPercent when utilization is 0%', async function () {
            const utilizationRatio = new BN(0);
            const result = await allocation.calcStrategyPercent(utilizationRatio);
            expect(result[0]).to.be.a.bignumber.equal(new BN(10000));
            return expect(result[1]).to.be.a.bignumber.equal(new BN(0));
        });

        it('calcStrategyPercent when utilization is 100%', async function () {
            const utilizationRatio = new BN(10000);
            const result = await allocation.calcStrategyPercent(utilizationRatio);
            expect(result[0]).to.be.a.bignumber.equal(new BN(5000));
            return expect(result[1]).to.be.a.bignumber.equal(new BN(5000));
        });
    })

    describe('Exposure', function () {
        it('calcRiskExposure return both stable coin and protocol exposure', async () => {
            const sysState = await insurance.prepareCalculation();
            const expState = await exposure.calcRiskExposure(sysState);
            const stablecoinExposure = expState[0];
            const protocolExposure = expState[1];
            const curveExposure = expState[2];
            expect(protocolExposure[0]).to.be.a.bignumber.equal(new BN(4995));
            expect(protocolExposure[1]).to.be.a.bignumber.equal(new BN(3330));
            expect(curveExposure).to.be.a.bignumber.equal(new BN(1670));
            expect(stablecoinExposure[0]).to.be.a.bignumber.equal(new BN(4450));
            expect(stablecoinExposure[1]).to.be.a.bignumber.equal(new BN(5311));
            return expect(stablecoinExposure[2]).to.be.a.bignumber.equal(new BN(4443));
        })

        it('getUnifiedAssets', async function () {
            await mockDAIVault.setTotal(toBN(10000).mul(daiBaseNum));
            await mockUSDCVault.setTotal(toBN(10000).mul(usdcBaseNum));
            await mockUSDTVault.setTotal(toBN(10000).mul(usdtBaseNum));

            const result = await exposure.getUnifiedAssets(await mockController.vaults());
            expect(result[0]).to.be.a.bignumber.equal(new BN(30000).mul(baseNum));
            return expect(result[1].toString()).equal('10000000000000000000000,10000000000000000000000,10000000000000000000000');
        });

        it('sortVaultsByDelta bigFirst true', async function () {
            const result1 = await exposure.getUnifiedAssets(await mockController.vaults());
            const result2 = await exposure.sortVaultsByDelta(true, result1[0], result1[1], [toBN('2000'), toBN('5000'), toBN('3000')]);
            return expect(JSON.stringify(result2)).equal('["0","2","1"]');
        });

        it('sortVaultsByDelta bigFirst false', async function () {
            const result1 = await exposure.getUnifiedAssets(await mockController.vaults());
            const result2 = await exposure.sortVaultsByDelta(false, result1[0], result1[1], [toBN('2000'), toBN('5000'), toBN('3000')]);
            return expect(JSON.stringify(result2)).equal('["1","2","0"]');
        });
    })
})
