import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../../utils/createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    VerificationParams,
    YearnPair,
} from '../../../utils/types';
import hre from 'hardhat';
const { ethers, network } = hre;
import { assert, expect } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    creditLineFactoryParams,
    createPoolParams,
    zeroAddress,
    ChainLinkAggregators,
    verificationParams,
} from '../../../utils/constants';
import { testVars as testCases } from './Pool_repayments_testEnv';

import DeployHelper from '../../../utils/deploys';
import { ERC20 } from '../../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../../../utils/helpers';
import { blockTravel } from '../../../utils/time';
import { getPoolInitSigHash } from '../../../utils/createEnv/poolLogic';
import { extendEnvironment } from 'hardhat/config';

describe('Pool Repayment cases', async function () {
    for (let index = 0; index < testCases.length; index++) {
        const testCase = testCases[index];
        await repaymentTests(
            testCase.Amount,
            testCase.Whale1,
            testCase.Whale2,
            testCase.BorrowToken,
            testCase.CollateralToken,
            testCase.liquidityBorrowToken,
            testCase.liquidityCollateralToken,
            testCase.chainlinkBorrow,
            testCase.chainlinkCollateral
        );
    }
});

export async function repaymentTests(
    amount: Number,
    whaleAccount1: Address,
    whaleAccount2: Address,
    borrowToken: Address,
    collateralToken: Address,
    liquidityBorrowToken: Address,
    liquidityCollateralToken: Address,
    chainlinkBorrow: Address,
    chainlinkCollateral: Address
): Promise<any> {
    // amount = BigNumber.from(amount).div(2).toNumber(); // reduce number by 2 for tests to pass
    return new Promise((resolve, reject) => {
        describe('Pool Repayment', async () => {
            let env: Environment;
            let pool: Pool;
            let poolAddress: Address;
    
            let deployHelper: DeployHelper;
            let borrowAsset: ERC20;
            let collateralAsset: ERC20;
            let iyield: IYield;
            let Compound: CompoundYield;
    
            const poolParams = {
                poolSize: BigNumber.from(100),
                borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                collateralAmount: BigNumber.from(amount),
                collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                collectionPeriod: 10000,
                loanWithdrawalDuration: 200,
                noOfRepaymentIntervals: 100,
                repaymentInterval: 1000,
            };
            const SCALER = BigNumber.from(10).pow(30);
    
            let snapshotId: any;
    
            before(async () => {
                snapshotId = await network.provider.request({
                    method: 'evm_snapshot',
                    params: [],
                });
            });
    
            after(async () => {
                await network.provider.request({
                    method: 'evm_revert',
                    params: [snapshotId],
                });
                resolve(1);
            });
    
            before(async () => {
                env = await createEnvironment(
                    hre,
                    [whaleAccount1, whaleAccount2],
                    [
                        { asset: borrowToken, liquidityToken: liquidityBorrowToken },
                        { asset: collateralToken, liquidityToken: liquidityCollateralToken },
                    ] as CompoundPair[],
                    [] as YearnPair[],
                    [
                        { tokenAddress: borrowToken, feedAggregator: chainlinkBorrow },
                        { tokenAddress: collateralToken, feedAggregator: chainlinkCollateral },
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
                        activationDelay: verificationParams.activationDelay
                    } as VerificationParams,
                );
    
                let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
                let { admin, borrower, lender } = env.entities;
                deployHelper = new DeployHelper(admin);
                borrowAsset = await deployHelper.mock.getMockERC20Detailed(borrowToken);
                collateralAsset = await deployHelper.mock.getMockERC20Detailed(collateralToken);
                iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);
    
                let BTDecimals = await borrowAsset.decimals();
                let CTDecimals = await collateralAsset.decimals();
    
                poolParams.poolSize = BigNumber.from(poolParams.poolSize).mul(BigNumber.from(10).pow(BTDecimals));
                poolParams.collateralAmount = BigNumber.from(poolParams.collateralAmount).mul(BigNumber.from(10).pow(CTDecimals));
    
                poolAddress = await calculateNewPoolAddress(env, borrowAsset, collateralAsset, iyield, salt, false, {
                    _poolSize: poolParams.poolSize,
                    _borrowRate: poolParams.borrowRate,
                    _collateralAmount: poolParams.collateralAmount,
                    _collateralRatio: poolParams.collateralRatio,
                    _collectionPeriod: poolParams.collectionPeriod,
                    _loanWithdrawalDuration: poolParams.loanWithdrawalDuration,
                    _noOfRepaymentIntervals: poolParams.noOfRepaymentIntervals,
                    _repaymentInterval: poolParams.repaymentInterval,
                });
    
                await collateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, poolParams.collateralAmount);
                await collateralAsset.connect(borrower).approve(poolAddress, poolParams.collateralAmount);
    
                // Note: Transferring 3 times the poolSize to lender from whale
                await borrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, poolParams.poolSize.mul(3));
                await borrowAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, poolParams.poolSize.mul(3));
                await borrowAsset
                    .connect(env.impersonatedAccounts[0])
                    .transfer(env.entities.extraLenders[1].address, poolParams.poolSize.mul(3));
    
                pool = await createNewPool(env, borrowAsset, collateralAsset, iyield, salt, false, {
                    _poolSize: poolParams.poolSize,
                    _borrowRate: poolParams.borrowRate,
                    _collateralAmount: poolParams.collateralAmount,
                    _collateralRatio: poolParams.collateralRatio,
                    _collectionPeriod: poolParams.collectionPeriod,
                    _loanWithdrawalDuration: poolParams.loanWithdrawalDuration,
                    _noOfRepaymentIntervals: poolParams.noOfRepaymentIntervals,
                    _repaymentInterval: poolParams.repaymentInterval,
                });
    
                assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
    
                // fix default signers
                pool = pool.connect(env.entities.borrower);
                env.repayments = env.repayments.connect(env.entities.lender);
                env.poolFactory = env.poolFactory.connect(env.entities.borrower);
                env.savingsAccount = env.savingsAccount.connect(env.entities.borrower);
            });
    
            describe('Repay interest', () => {
                let lentAmount: BigNumber, lentAmount1: BigNumber;
                let totalPoolInterest: BigNumber;
                before(async () => {
                    const minBorrowFraction = await env.poolFactory.minBorrowFraction();
                    const minPoolSize = poolParams.poolSize.mul(minBorrowFraction).div(SCALER);
                    lentAmount = minPoolSize.mul(4).div(3);
                    await borrowAsset.connect(env.entities.lender).approve(pool.address, lentAmount);
                    await pool.connect(env.entities.lender).lend(env.entities.lender.address, lentAmount, zeroAddress);
    
                    const { loanStartTime } = await pool.poolConstants();
                    await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
                    await pool.connect(env.entities.borrower).withdrawBorrowedAmount();
                    totalPoolInterest = (await env.repayments.getInterestLeft(pool.address)).div(SCALER);
                });
    
                it('repay interest for first period', async () => {
                    const instalmentNo = (await env.repayments.getCurrentInstalmentInterval(pool.address)).div(SCALER);
                    assert(instalmentNo.toString() == '1', 'Wrong instalment');
                    const interestForFirstPeriod = (await env.repayments.getInterestDueTillInstalmentDeadline(pool.address)).div(SCALER);
                    await borrowAsset.connect(env.entities.extraLenders[1]).approve(env.repayments.address, interestForFirstPeriod);
                    await env.repayments.connect(env.entities.extraLenders[1]).repay(pool.address, interestForFirstPeriod);
    
                    const { loanDurationCovered } = await env.repayments.repayVariables(pool.address);
                    const { repaymentInterval } = await env.repayments.repayConstants(pool.address);
    
                    expectApproxEqual(
                        loanDurationCovered.div(SCALER),
                        repaymentInterval.div(SCALER),
                        1,
                        `loanDurationCovered doesn't represent entire first period. Expected: ${repaymentInterval.div(
                            SCALER
                        )} Actual: ${loanDurationCovered.div(SCALER)}`
                    );
                });
    
                it("can't repay all interest for entire loan without repaying principal", async () => {
                    const interestLeft = (await env.repayments.getInterestLeft(pool.address)).div(SCALER);
                    // Note: interestLeft.add(1) is necessary as when div by SCALER we are cutting down the decimal parts and to ensure compelte repaymet, we should send little higher
                    await borrowAsset.connect(env.entities.extraLenders[1]).approve(env.repayments.address, interestLeft.add(1));
                    await expect(
                        env.repayments.connect(env.entities.extraLenders[1]).repay(pool.address, interestLeft.add(1))
                    ).to.be.revertedWith('Repayments::repay complete interest must be repaid along with principal');
                });
    
                it('should be able to repay slightly less than total interest', async () => {
                    const interestLeft = (await env.repayments.getInterestLeft(pool.address)).div(SCALER);
                    await borrowAsset.connect(env.entities.extraLenders[1]).approve(env.repayments.address, interestLeft);
                    await env.repayments.connect(env.entities.extraLenders[1]).repay(pool.address, interestLeft.sub(1));
                });
    
                it("can't repay some portion of principal", async () => {
                    const interestLeft = (await env.repayments.getInterestLeft(pool.address)).div(SCALER);
                    const principal = await pool.totalSupply();
                    await borrowAsset.connect(env.entities.extraLenders[1]).approve(env.repayments.address, interestLeft.add(principal).sub(1));
                    await expect(env.repayments.connect(env.entities.extraLenders[1]).repayPrincipal(pool.address)).to.be.revertedWith('');
                });
    
                it('close loan', async () => {
                    const interestLeft = (await env.repayments.getInterestLeft(pool.address)).div(SCALER);
                    const principal = await pool.totalSupply();
                    await borrowAsset.connect(env.entities.extraLenders[1]).approve(env.repayments.address, interestLeft.add(principal));
    
                    const collateralBeforeRepay = await env.savingsAccount.balanceInShares(
                        env.entities.borrower.address,
                        collateralAsset.address,
                        iyield.address
                    );
                    const { baseLiquidityShares, extraLiquidityShares } = await pool.poolVariables();
                    await env.repayments.connect(env.entities.extraLenders[1]).repayPrincipal(pool.address);
                    const collateralAfterRepay = await env.savingsAccount.balanceInShares(
                        env.entities.borrower.address,
                        collateralAsset.address,
                        iyield.address
                    );
                    const collateralIncrease = await iyield.callStatic.getTokensForShares(
                        collateralAfterRepay.sub(collateralBeforeRepay),
                        collateralAsset.address
                    );
    
                    assert(
                        collateralAfterRepay.sub(collateralBeforeRepay).eq(baseLiquidityShares.add(extraLiquidityShares)),
                        `Collateral shares not correctly returned to borrower Expected: ${baseLiquidityShares.add(
                            extraLiquidityShares
                        )} Actual: ${collateralAfterRepay.sub(collateralBeforeRepay)}`
                    );
                    assert(
                        collateralIncrease.gte(poolParams.collateralAmount),
                        `Collateral locked is returned back Expected: ${poolParams.collateralAmount} Actual: ${collateralIncrease}`
                    );
    
                    const loanStatus = await pool.getLoanStatus();
                    assert(loanStatus.eq(2), "Loan hasn't closed");
                    const borrowAssetAllowanceRemaining = await borrowAsset.allowance(
                        env.entities.extraLenders[1].address,
                        env.repayments.address
                    );
                    assert(
                        borrowAssetAllowanceRemaining.eq(0),
                        `Incorrect interest + principal transferred Expected: 0, Actual: ${borrowAssetAllowanceRemaining}`
                    );
                });
    
                it('lenders withdraw repayments and lent amount', async () => {
                    const balanceDetails = await pool.getBalanceDetails(env.entities.lender.address);
                    const balanceBefore = await borrowAsset.balanceOf(env.entities.lender.address);
                    await pool.connect(env.entities.lender).withdrawLiquidity();
                    const balanceAfter = await borrowAsset.balanceOf(env.entities.lender.address);
    
                    assert(
                        balanceAfter.sub(balanceBefore).eq(totalPoolInterest.mul(balanceDetails[0]).div(balanceDetails[1]).add(lentAmount)),
                        `Amount lent + interest not correctly received by lender Expected: ${totalPoolInterest
                            .mul(balanceDetails[0])
                            .div(balanceDetails[1])
                            .add(lentAmount)} Actual: ${balanceAfter.sub(balanceBefore)}`
                    );
                });
            });
        })
    })
}
