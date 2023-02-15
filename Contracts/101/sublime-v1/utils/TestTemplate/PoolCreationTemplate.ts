import { createEnvironment, calculateNewPoolAddress, createNewPool } from '../createEnv';

import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    VerificationParams,
    YearnPair,
} from '../types';

import {
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    aaveYieldParams,
    createPoolParams,
    zeroAddress,
    creditLineFactoryParams,
} from '../constants-rahul';

import { verificationParams } from '../constants';

import hre from 'hardhat';
const { ethers, network } = hre;
import { Contracts } from '../../existingContracts/compound.json';
import { assert, expect } from 'chai';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '../../typechain/IYield';
import { Context } from 'mocha';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '../../typechain/Pool';
import { create } from 'underscore';
import { OperationalAmounts } from '@utils/constants';
import { getProxyAdminFactory } from '@openzeppelin/hardhat-upgrades/dist/utils';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

export async function poolCreationTest(
    Amount: Number,
    Whale1: Address,
    Whale2: Address,
    BorrowTokenParam: Address,
    CollateralTokenParam: Address,
    liquidityBorrowTokenParam: Address,
    liquidityCollateralTokenParam: Address,
    chainlinkBorrowParam: Address,
    chainlinkCollateralParam: Address
): Promise<any> {
    describe('Pool', async () => {
        let env: Environment;
        let deployHelper: DeployHelper;
        let borrowToken: ERC20;
        let collateralToken: ERC20;
        let iYield: IYield;
        let generatedPoolAddress: Address;
        let pool: Pool;
        before(async () => {
            env = await createEnvironment(
                hre,
                [Whale1, Whale2],
                [
                    { asset: BorrowTokenParam, liquidityToken: liquidityBorrowTokenParam },
                    { asset: CollateralTokenParam, liquidityToken: liquidityCollateralTokenParam },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowTokenParam, feedAggregator: chainlinkBorrowParam },
                    { tokenAddress: CollateralTokenParam, feedAggregator: chainlinkCollateralParam },
                ] as PriceOracleSource[],
                {
                    votingPassRatio: extensionParams.votingPassRatio,
                } as ExtensionInitParams,
                {
                    gracePenalityRate: repaymentParams.gracePenalityRate,
                    gracePeriodFraction: repaymentParams.gracePeriodFraction,
                } as RepaymentsInitParams,
                {
                    admin: '',
                    _collectionPeriod: testPoolFactoryParams._collectionPeriod,
                    _loanWithdrawalDuration: testPoolFactoryParams._loanWithdrawalDuration,
                    _marginCallDuration: testPoolFactoryParams._marginCallDuration,
                    _gracePeriodPenaltyFraction: testPoolFactoryParams._gracePeriodPenaltyFraction,
                    _poolInitFuncSelector: getPoolInitSigHash(),
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                    noStrategy: '',
                } as PoolFactoryInitParams,
                CreditLineDefaultStrategy.Compound,
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction,
                } as CreditLineInitParams,
                {
                    activationDelay: verificationParams.activationDelay,
                } as VerificationParams
            );

            console.log('createEnvironment() executed successfully.');

            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            borrowToken = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address); //DAI
            collateralToken = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address); //LINK
            iYield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let BorrowDecimals: BigNumber = await env.mockTokenContracts[0].contract.decimals();
            let CollateralDecimals: BigNumber = await env.mockTokenContracts[1].contract.decimals();

            console.log('Params for calculateNewPoolAddress generated.');

            generatedPoolAddress = await calculateNewPoolAddress(env, borrowToken, collateralToken, iYield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BorrowDecimals)), // max possible borrow tokens in DAI pool ~1000 DAI
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside,,
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CollateralDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            console.log('Borrow Token: ', env.mockTokenContracts[0].name);
            console.log('Collateral Token: ', env.mockTokenContracts[1].name);
            console.log('Generated Pool address is: ', generatedPoolAddress);
            console.log('calculateNewPoolAddress() is executed successfully.');

            let collateralAmount = BigNumber.from(Amount).mul(BigNumber.from(10).pow(CollateralDecimals));
            console.log(await collateralToken.balanceOf(admin.address));
            console.log(collateralAmount);
            console.log(await collateralToken.balanceOf(borrower.address));
            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmount.mul(2));
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, collateralAmount);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(generatedPoolAddress, collateralAmount);
            console.log(await collateralToken.balanceOf(borrower.address));

            console.log('collateralToken transfers took place.');

            console.log(BorrowDecimals, CollateralDecimals);

            pool = await createNewPool(env, borrowToken, collateralToken, iYield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BorrowDecimals)), // max possible borrow tokens in DAI pool ~1000 DAI
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside,,
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CollateralDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });
        });

        it('Pool created successfully for this pair', async function () {
            assert.equal(generatedPoolAddress, pool.address, 'Generated and Actual pool address are the same');
        });
    });
}
