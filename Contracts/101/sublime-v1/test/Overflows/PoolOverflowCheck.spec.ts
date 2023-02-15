import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createEnvironment, createNewPool } from '../../utils/createEnv';
import { CreditLineDefaultStrategy, Environment, PoolCreateParams } from '../../utils/types';

import hre from 'hardhat';

import { CompoundPair } from '../../utils/types';
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators, WBTCWhale, Binance7, WhaleAccount } from '../../config/constants';
import { sha256 } from 'ethers/lib/utils';
import DeployHelper from '../../utils/deploys';
import { BigNumber, BigNumberish } from 'ethers';
import { Repayments } from '../../typechain/Repayments';

import { Pool } from '@typechain/Pool';
import { expect } from 'chai';
import { incrementChain, induceDelay, latestTime } from '../../utils/helpers';
import { timeTravel } from '../../utils/time';
import { ERC20Detailed } from '../../typechain/ERC20Detailed';
import { ERC20 } from '../../typechain/ERC20';
import { PoolFactory } from '../../typechain/PoolFactory';

const overFlowTest = process.env?.SKIP_OVERFLOW_TEST?.toLowerCase() == 'true' ? it.skip : it;

describe('Pool Overflow checks', async () => {
    let env: Environment;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraLenders: SignerWithAddress[];
    let pair: CompoundPair[];
    let repayments: Repayments;
    let pool: Pool;

    let snapshotId: any;
    let lendersToUse = 1;

    async function fixture() {
        let env: Environment = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            pair,
            [],
            [
                { tokenAddress: Contracts.WETH, feedAggregator: ChainLinkAggregators['ETH/USD'] },
                { tokenAddress: Contracts.DAI, feedAggregator: ChainLinkAggregators['DAI/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: Contracts.USDT, feedAggregator: ChainLinkAggregators['USDT/USD'] },
                { tokenAddress: Contracts.USDC, feedAggregator: ChainLinkAggregators['USDC/USD'] },
            ],
            { votingPassRatio: 100 },
            { gracePenalityRate: 100, gracePeriodFraction: 100000 },
            {
                admin: '',
                _collectionPeriod: 1000000,
                _loanWithdrawalDuration: 1000000,
                _marginCallDuration: 1000000,
                _liquidatorRewardFraction: 1000000,
                _poolCancelPenalityFraction: 10000000,
                _protocolFeeFraction: 10000000,
                protocolFeeCollector: '',
                _minBorrowFraction: 100000000,
                noStrategy: '',
                beacon: '',
            },
            CreditLineDefaultStrategy.NoStrategy,
            {
                _protocolFeeFraction: 10000000,
                _liquidatorRewardFraction: 1000000000,
            },
            {
                activationDelay: 1,
            },
            Contracts.WETH,
            Contracts.USDC
        );

        let deployHelper = new DeployHelper(env.impersonatedAccounts[0]);
        let wbtc = await deployHelper.mock.getMockERC20Detailed(Contracts.WBTC);
        let amount = BigNumber.from(10)
            .pow(await wbtc.decimals())
            .mul(10);
        await wbtc.transfer(env.entities.borrower.address, amount);

        let usdt = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let lendAmount = BigNumber.from(10)
            .pow(await usdt.decimals())
            .mul(1000)
            .mul(env.entities.extraLenders.length);
        await usdt.connect(env.impersonatedAccounts[1]).transfer(env.entities.admin.address, lendAmount);

        return {
            env,
            admin: env.entities.admin,
            borrower: env.entities.borrower,
            lender: env.entities.lender,
            protocolFeeCollector: env.entities.protocolFeeCollector,
            extraLenders: env.entities.extraLenders,
            repayments: env.repayments,
        };
    }

    before(async () => {
        pair = [
            { asset: Contracts.DAI, liquidityToken: Contracts.cDAI },
            { asset: Contracts.WETH, liquidityToken: Contracts.cETH },
            { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
            { asset: Contracts.USDC, liquidityToken: Contracts.cUSDC },
            { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
        ];
        let result = await fixture();
        env = result.env;
        admin = result.admin;
        borrower = result.borrower;
        lender = result.lender;
        protocolFeeCollector = result.protocolFeeCollector;
        extraLenders = result.extraLenders;
        repayments = result.repayments;

        let salt = sha256(Buffer.from('salt-1'));
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let USDT = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        for (let index = 0; index < lendersToUse; index++) {
            const _lender = extraLenders[index];
            let lendAmount = BigNumber.from(10)
                .pow(await USDT.decimals())
                .mul(1000);
            await USDT.connect(admin).transfer(_lender.address, lendAmount);
        }
    });

    beforeEach(async () => {
        snapshotId = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });
    });

    afterEach(async () => {
        await hre.network.provider.request({
            method: 'evm_revert',
            params: [snapshotId],
        });
    });

    overFlowTest('Find max collateral', async () => {
        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        // 45825116160
        const maxPossibleCollateralAmount = await getMaxPossibleCollateralAmount(minInt256, maxInt256);
        console.log('max collateral possible', maxPossibleCollateralAmount.toString());
        expect(maxPossibleCollateralAmount).not.eq(minInt256);
        expect(maxPossibleCollateralAmount).not.eq(minInt256.add(1));
        expect(maxPossibleCollateralAmount).not.eq(maxInt256);
        expect(maxPossibleCollateralAmount).not.eq(maxInt256.sub(1));
    });

    overFlowTest('Max collateral ratio', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        // 193904140488827777398221698951063
        const maxCollateral = await getMaxCollateralRatio(wbtcMaxCollateral, minInt256, maxInt256);
        console.log('Max collateral ratio possible', maxCollateral.toString());
        expect(maxCollateral).not.eq(minInt256);
        expect(maxCollateral).not.eq(minInt256.add(1));
        expect(maxCollateral).not.eq(maxInt256);
        expect(maxCollateral).not.eq(maxInt256.sub(1));
    });

    it.skip('Max borrow rate', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        // 115792089237316195423570985008687907853269984665640564039457584007913129639934
        const maxBorrowRate = await getMaxBorrowRate(wbtcMaxCollateral, minInt256, maxInt256);
        console.log('Max borrow rate possible', maxBorrowRate.toString());
        expect(maxBorrowRate).not.eq(minInt256);
        expect(maxBorrowRate).not.eq(minInt256.add(1));
        expect(maxBorrowRate).not.eq(maxInt256);
        expect(maxBorrowRate).not.eq(maxInt256.sub(1));
    });

    overFlowTest('Get max repayments intervals', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        // 18446744073709551615
        const maxRepaymentIntervals = await getMaxRepaymentIntervals(wbtcMaxCollateral, minInt256, maxInt256);
        console.log('Max repayment intervals possible', maxRepaymentIntervals.toString());
        expect(maxRepaymentIntervals).not.eq(minInt256);
        expect(maxRepaymentIntervals).not.eq(minInt256.add(1));
        expect(maxRepaymentIntervals).not.eq(maxInt256);
        expect(maxRepaymentIntervals).not.eq(maxInt256.sub(1));
    });

    overFlowTest('Get max pool size', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        // 18446744073709551615
        const poolSize = await getMaxPoolSize(wbtcMaxCollateral, minInt256, maxInt256);
        console.log('max pool size', poolSize.toString());
        expect(poolSize).not.eq(minInt256);
        expect(poolSize).not.eq(minInt256.add(1));
        expect(poolSize).not.eq(maxInt256);
        expect(poolSize).not.eq(maxInt256.sub(1));
    });

    overFlowTest('Max Interest to Repay', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');
        let colAmount = wbtcMaxCollateral;

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        // const MAX_INT = '40013361014455680676789167538344654061827833831043890550';
        // const MAX_INT = "0xffffffffffff"
        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        let [interest, maxBorrowRate] = await getMaxInterestToRepay(colAmount, minInt256, maxInt256, BigNumber.from(0));
        console.log({ interest: interest.toString(), maxBorrowRate: maxBorrowRate.toString() });
    });

    overFlowTest('Borrow Rate to that min interest to pay is not zero', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');
        let colAmount = wbtcMaxCollateral;

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        let [interest, minBorrowRate] = await getMinInterestToRepay(colAmount, minInt256, maxInt256, BigNumber.from(0));
        console.log({ interest: interest.toString(), minBorrowRate: minBorrowRate.toString() });
    });

    overFlowTest('Interest Rate with given borrow rate', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');
        let colAmount = wbtcMaxCollateral;

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
        await WBTC.connect(admin).transfer(borrower.address, colAmount);
        await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

        let valueToTest = BigNumber.from('4001336101445568067678916753834465406182783383104389055').add(1);

        let pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(10).pow(6).mul(lendersToUse), // max possible borrow tokens in pool
            _borrowRate: valueToTest,
            _collateralAmount: colAmount,
            _collateralRatio: BigNumber.from(10).pow(16), // almost less collateral size
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: BigNumber.from(86400),
        });

        let blockChainTimeStamp = await latestTime(hre);

        for (let index = 0; index < lendersToUse; index++) {
            const element = extraLenders[index];
            let lendAmount = BigNumber.from(10)
                .pow(await USDT.decimals())
                .mul(1000);
            await USDT.connect(element).approve(pool.address, lendAmount);
            await pool.connect(element).lend(element.address, lendAmount, env.yields.noYield.address, false);
        }

        let loanStartTime = await (await pool.connect(admin).poolConstants()).loanStartTime.toString();
        let timeToSkip = BigNumber.from(loanStartTime).sub(blockChainTimeStamp).toNumber();
        await timeTravel(hre.network, timeToSkip);
        await pool.connect(borrower).withdrawBorrowedAmount();

        let SCALING_FACTOR = await repayments.connect(admin).SCALING_FACTOR();
        blockChainTimeStamp = await latestTime(hre);
        let nextInstallmentOn = await (await repayments.connect(admin).getNextInstalmentDeadline(pool.address))
            .div(SCALING_FACTOR)
            .toNumber();

        timeToSkip = BigNumber.from(nextInstallmentOn).sub(blockChainTimeStamp).toNumber();
        await timeTravel(hre.network, timeToSkip);
        await incrementChain(hre.network, 1);

        let interestToRepay = await pool.interestToPay();
        console.log({ interestToRepay: interestToRepay.toString() });
        expect(interestToRepay).not.eq(0);
    });

    overFlowTest('Max Equivalent tokens', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');
        let colAmount = wbtcMaxCollateral;

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
        await WBTC.connect(admin).transfer(borrower.address, colAmount);
        await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

        let pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(10).pow(6).mul(lendersToUse), // max possible borrow tokens in pool
            _borrowRate: BigNumber.from(10).pow(16).mul(5),
            _collateralAmount: colAmount,
            _collateralRatio: BigNumber.from(10).pow(16), // almost less collateral size
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: BigNumber.from(86400),
        });

        let [inputTokens, equivalentTokens] = await getMaxEquivalentTokens(pool, WBTC, USDT, minInt256, maxInt256, BigNumber.from(0));
        console.log({ inputTokens: inputTokens.toString(), equivalentTokens: equivalentTokens.toString() });
    });

    overFlowTest('Max Pool size', async () => {
        let wbtcMaxCollateral = BigNumber.from('45825116160');
        let colAmount = wbtcMaxCollateral;

        const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);

        let [numberOfBorrowTokens, maxPoolSizeLimit] = await getMaxPoolLimit(
            env.poolFactory,
            WBTC,
            minInt256,
            maxInt256,
            BigNumber.from(0)
        );
        console.log({ numberOfBorrowTokens: numberOfBorrowTokens.toString(), maxPoolSizeLimit: maxPoolSizeLimit.toString() });
    });

    async function getMaxPoolLimit(
        _poolFactor: PoolFactory,
        borrowToken: ERC20Detailed | ERC20,
        min: BigNumber,
        max: BigNumber,
        lastPoolSizeLimit: BigNumber
    ): Promise<[BigNumber, BigNumber]> {
        let diff = max.sub(min);
        // console.log({ diff: diff.toString(), lastPoolSizeLimit: lastPoolSizeLimit.toString() });
        if (diff.eq(0) || diff.eq(1)) {
            return [min, lastPoolSizeLimit];
        }
        let valueToTest = min.add(max).div('2');

        try {
            let limit = await _poolFactor.connect(admin).getPoolSizeLimitInUsd(borrowToken.address, valueToTest);
            return await getMaxPoolLimit(_poolFactor, borrowToken, valueToTest, max, limit);
        } catch (ex) {
            let exception = ex as Error;
            // console.log(exception.message);
            return getMaxPoolLimit(_poolFactor, borrowToken, min, valueToTest, lastPoolSizeLimit);
        }
    }

    async function getMaxEquivalentTokens(
        _pool: Pool,
        source: ERC20Detailed | ERC20,
        target: ERC20Detailed | ERC20,
        min: BigNumber,
        max: BigNumber,
        lastEquivalentTokens: BigNumber
    ): Promise<[BigNumber, BigNumber]> {
        let diff = max.sub(min);
        // console.log({ diff: diff.toString(), lastEquivalentTokens: lastEquivalentTokens.toString() });
        if (diff.eq(0) || diff.eq(1)) {
            return [min, lastEquivalentTokens];
        }
        let valueToTest = min.add(max).div('2');

        try {
            let equivalentTokens = await _pool.connect(admin).getEquivalentTokens(source.address, target.address, valueToTest);
            return await getMaxEquivalentTokens(_pool, source, target, valueToTest, max, equivalentTokens);
        } catch (ex) {
            let exception = ex as Error;
            // console.log(exception.message);
            return await getMaxEquivalentTokens(_pool, source, target, min, valueToTest, lastEquivalentTokens);
        }
    }

    // return [interestToPay, interestRateUsed]
    async function getMinInterestToRepay(
        colAmount: BigNumber,
        min: BigNumber,
        max: BigNumber,
        prevInterestToRepay: BigNumber
    ): Promise<[BigNumber, BigNumber]> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
        await WBTC.connect(admin).transfer(borrower.address, colAmount);
        await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

        let diff = max.sub(min);
        // console.log({ diff: diff.toString(), prevInterestToRepay: prevInterestToRepay.toString() });
        if (diff.eq(0) || diff.eq(1)) {
            return [prevInterestToRepay, min];
        }
        let valueToTest = min.add(max).div('2');

        try {
            let pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(10).pow(6).mul(lendersToUse), // max possible borrow tokens in pool
                _borrowRate: valueToTest,
                _collateralAmount: colAmount,
                _collateralRatio: BigNumber.from(10).pow(16), // almost less collateral size
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: BigNumber.from(86400),
            });

            let blockChainTimeStamp = await latestTime(hre);

            for (let index = 0; index < lendersToUse; index++) {
                const element = extraLenders[index];
                let lendAmount = BigNumber.from(10)
                    .pow(await USDT.decimals())
                    .mul(1000);
                await USDT.connect(element).approve(pool.address, lendAmount);
                await pool.connect(element).lend(element.address, lendAmount, env.yields.noYield.address, false);
            }

            let loanStartTime = await (await pool.connect(admin).poolConstants()).loanStartTime.toString();
            let timeToSkip = BigNumber.from(loanStartTime).sub(blockChainTimeStamp).toNumber();
            await timeTravel(hre.network, timeToSkip);
            await pool.connect(borrower).withdrawBorrowedAmount();

            let SCALING_FACTOR = await repayments.connect(admin).SCALING_FACTOR();
            blockChainTimeStamp = await latestTime(hre);
            let nextInstallmentOn = await (await repayments.connect(admin).getNextInstalmentDeadline(pool.address))
                .div(SCALING_FACTOR)
                .toNumber();

            timeToSkip = BigNumber.from(nextInstallmentOn).sub(blockChainTimeStamp).toNumber();
            await timeTravel(hre.network, timeToSkip);
            await incrementChain(hre.network, 1);

            let interestToRepay = await pool.interestToPay();
            // console.log('*************************************************');
            // console.log({ interestToRepay: interestToRepay.toString() });
            // console.log('*************************************************');
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });

            if (BigNumber.from(interestToRepay).lte(1)) {
                return await getMinInterestToRepay(colAmount, valueToTest, max, interestToRepay);
            } else {
                return await getMinInterestToRepay(colAmount, min, valueToTest, interestToRepay);
            }
        } catch (ex) {
            let exception = ex as Error;
            // console.log(exception.message);

            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            let [newInterestToRepay, _newValueToTest] = await getMinInterestToRepay(colAmount, min, valueToTest, prevInterestToRepay);
            return [newInterestToRepay, _newValueToTest];
        }
    }

    // return [interestToPay, interestRateUsed]
    async function getMaxInterestToRepay(
        colAmount: BigNumber,
        min: BigNumber,
        max: BigNumber,
        prevInterestToRepay: BigNumber
    ): Promise<[BigNumber, BigNumber]> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20Detailed(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
        await WBTC.connect(admin).transfer(borrower.address, colAmount);
        await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

        let diff = max.sub(min);
        // console.log({ diff: diff.toString(), prevInterestToRepay: prevInterestToRepay.toString() });
        if (diff.eq(0) || diff.eq(1)) {
            return [prevInterestToRepay, min];
        }
        let valueToTest = min.add(max).div('2');

        try {
            let pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(10).pow(6).mul(lendersToUse), // max possible borrow tokens in pool
                _borrowRate: valueToTest,
                _collateralAmount: colAmount,
                _collateralRatio: BigNumber.from(10).pow(16), // almost less collateral size
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: BigNumber.from(86400),
            });

            let blockChainTimeStamp = await latestTime(hre);

            for (let index = 0; index < lendersToUse; index++) {
                const element = extraLenders[index];
                let lendAmount = BigNumber.from(10)
                    .pow(await USDT.decimals())
                    .mul(1000);
                await USDT.connect(element).approve(pool.address, lendAmount);
                await pool.connect(element).lend(element.address, lendAmount, env.yields.noYield.address, false);
            }

            let loanStartTime = await (await pool.connect(admin).poolConstants()).loanStartTime.toString();
            let timeToSkip = BigNumber.from(loanStartTime).sub(blockChainTimeStamp).toNumber();
            await timeTravel(hre.network, timeToSkip);
            await pool.connect(borrower).withdrawBorrowedAmount();

            let SCALING_FACTOR = await repayments.connect(admin).SCALING_FACTOR();
            blockChainTimeStamp = await latestTime(hre);
            let nextInstallmentOn = await (await repayments.connect(admin).getNextInstalmentDeadline(pool.address))
                .div(SCALING_FACTOR)
                .toNumber();

            timeToSkip = BigNumber.from(nextInstallmentOn).sub(blockChainTimeStamp).toNumber();
            await timeTravel(hre.network, timeToSkip);
            await incrementChain(hre.network, 1);

            let interestToRepay = await pool.interestToPay();
            // console.log('*************************************************');
            // console.log({ interestToRepay: interestToRepay.toString() });
            // console.log('*************************************************');
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });

            let [newInterestToRepay, _newValueToTest] = await getMaxInterestToRepay(colAmount, valueToTest, max, interestToRepay);
            return [newInterestToRepay, _newValueToTest];
        } catch (ex) {
            let exception = ex as Error;
            // console.log(exception.message);

            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            let [newInterestToRepay, _newValueToTest] = await getMaxInterestToRepay(colAmount, min, valueToTest, prevInterestToRepay);
            return [newInterestToRepay, _newValueToTest];
        }
    }

    async function getMaxPoolSize(colAmount: BigNumber, min: BigNumber, max: BigNumber): Promise<BigNumber> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        let diff = max.sub(min);
        if (diff.eq(0) || diff.eq(1)) {
            return min;
        }
        let valueToTest = min.add(max).div(2);

        try {
            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
            await WBTC.connect(admin).transfer(borrower.address, colAmount);
            await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

            pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: valueToTest, // max possible borrow tokens in pool
                _borrowRate: BigNumber.from(10).pow(16).mul(5),
                _collateralAmount: colAmount,
                _collateralRatio: BigNumber.from(10).pow(16), // almost less collateral size
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: BigNumber.from(86400),
            });
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxPoolSize(colAmount, valueToTest, max);
        } catch (ex) {
            // console.log(ex);
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxPoolSize(colAmount, min, valueToTest);
        }
    }

    async function getMaxRepaymentIntervals(colAmount: BigNumber, min: BigNumber, max: BigNumber): Promise<BigNumber> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        let diff = max.sub(min);
        if (diff.eq(0) || diff.eq(1)) {
            return min;
        }
        let valueToTest = min.add(max).div(2);

        try {
            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
            await WBTC.connect(admin).transfer(borrower.address, colAmount);
            await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

            pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(100000).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
                _borrowRate: BigNumber.from(10).pow(18).mul(5),
                _collateralAmount: colAmount,
                _collateralRatio: BigNumber.from(10).pow(16),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: valueToTest,
                _repaymentInterval: BigNumber.from(86400),
            });
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxRepaymentIntervals(colAmount, valueToTest, max);
        } catch (ex) {
            // console.log(ex);
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxRepaymentIntervals(colAmount, min, valueToTest);
        }
    }

    async function getMaxBorrowRate(colAmount: BigNumber, min: BigNumber, max: BigNumber): Promise<BigNumber> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        let diff = max.sub(min);
        if (diff.eq(0) || diff.eq(1)) {
            return min;
        }
        let valueToTest = min.add(max).div(2);

        try {
            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
            await WBTC.connect(admin).transfer(borrower.address, colAmount);
            await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

            pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(100000).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
                _borrowRate: valueToTest,
                _collateralAmount: colAmount,
                _collateralRatio: BigNumber.from(10).pow(17),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxBorrowRate(colAmount, valueToTest, max);
        } catch (ex) {
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxBorrowRate(colAmount, min, valueToTest);
        }
    }

    async function getMaxCollateralRatio(colAmount: BigNumber, min: BigNumber, max: BigNumber): Promise<BigNumber> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        let diff = max.sub(min);
        if (diff.eq(0) || diff.eq(1)) {
            return min;
        }
        let valueToTest = min.add(max).div(2);

        try {
            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, colAmount);
            await WBTC.connect(admin).transfer(borrower.address, colAmount);
            await WBTC.connect(borrower).approve(generatedPoolAddress, colAmount);

            pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(100000).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
                _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(16)), // 100 * 10^28 in contract means 100% to outside
                _collateralAmount: colAmount,
                _collateralRatio: valueToTest, //250 * 10**28
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxCollateralRatio(colAmount, valueToTest, max);
        } catch (ex) {
            // console.log(ex);
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxCollateralRatio(colAmount, min, valueToTest);
        }
    }

    async function getMaxPossibleCollateralAmount(min: BigNumber, max: BigNumber): Promise<BigNumber> {
        let _tempSnapShot = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });

        let deployHelper: DeployHelper = new DeployHelper(admin);

        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let salt = sha256(Buffer.from('salt-1'));

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(env.entities.borrower.address, salt);

        let diff = max.sub(min);
        if (diff.eq(0) || diff.eq(1)) {
            return min;
        }
        let valueToTest = min.add(max).div(2);

        try {
            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, valueToTest);
            await WBTC.connect(admin).transfer(borrower.address, valueToTest);
            await WBTC.connect(borrower).approve(generatedPoolAddress, valueToTest);

            pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(100000).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
                _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(16)), // 100 * 10^28 in contract means 100% to outside
                _collateralAmount: valueToTest,
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(16)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxPossibleCollateralAmount(valueToTest, max);
        } catch (ex) {
            await hre.network.provider.request({
                method: 'evm_revert',
                params: [_tempSnapShot],
            });
            return await getMaxPossibleCollateralAmount(min, valueToTest);
        }
    }
});
