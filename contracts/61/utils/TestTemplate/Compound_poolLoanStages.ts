import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    // PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    VerificationParams,
    YearnPair,
} from '../types';
import hre from 'hardhat';
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    creditLineFactoryParams,
    createPoolParams,
    zeroAddress,
    ChainLinkAggregators,
    verificationParams,
} from '../constants';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export async function compoundPoolCollectionStage(
    Amount: Number,
    WhaleAccount1: Address,
    WhaleAccount2: Address,
    BorrowToken: Address,
    CollateralToken: Address,
    liquidityBorrowToken: Address,
    liquidityCollateralToken: Address,
    chainlinkBorrow: Address,
    ChainlinkCollateral: Address
): Promise<any> {
    let snapshotId: any;

    describe('Create Snapshot', async () => {
        it('Trying Creating Snapshot', async () => {
            snapshotId = await network.provider.request({
                method: 'evm_snapshot',
                params: [],
            });
        });
    });

    describe('Pool Simulation: Collection Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            console.log('Borrow Token: ', env.mockTokenContracts[0].name);
            console.log('Collateral Token: ', env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            // console.log("Tokens present!");
            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('Borrower should be able to directly add more Collateral to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let Collateral = await env.mockTokenContracts[1].contract.address;
            let depositAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals));

            // Transfering again as the initial amount was used for initial deposit
            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, depositAmount);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, depositAmount);

            // Checking balance before deposit
            let SharesBefore = (await pool.poolVariables()).baseLiquidityShares;

            // Direct Collateral deposit
            await pool.connect(borrower).depositCollateral(depositAmount, false);

            // Checking balance after deposit
            let SharesAfter = (await pool.poolVariables()).baseLiquidityShares;

            // Getting additional Shares
            let SharesReceived = SharesAfter.sub(SharesBefore);
            // console.log({SharesReceived: SharesReceived.toNumber()});

            // Checking shares received and matching with the deposited amount
            let liquidityShares = await env.yields.compoundYield.callStatic.getSharesForTokens(depositAmount, Collateral);
            // console.log({ LiquidityShares: liquidityShares.toNumber() });
            expectApproxEqual(liquidityShares.toNumber(), SharesReceived, 50);

            let LoanStatus = (await pool.poolVariables()).loanStatus;
            // console.log(LoanStatus);
            assert(
                LoanStatus.toString() == BigNumber.from('0').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('0').toString()} 
                Actual: ${LoanStatus}`
            );
        });

        it('Borrower should be able to deposit Collateral to the pool using Savings Account', async function () {
            let { admin, borrower, lender } = env.entities;
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let Collateral = await env.mockTokenContracts[1].contract;
            let depositAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals));
            let AmountForDeposit = BigNumber.from(100);

            let liquidityShares = await env.yields.compoundYield.callStatic.getTokensForShares(AmountForDeposit, Collateral.address);
            // console.log({ LiquidityShares: liquidityShares.toString() });
            // console.log({ DepositAmount: AmountForDeposit.toString() });

            // Transfering again as the initial amount was used for initial deposit
            await Collateral.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
            await Collateral.connect(admin).transfer(borrower.address, depositAmount);
            await Collateral.connect(borrower).approve(env.yields.compoundYield.address, liquidityShares.mul(100));

            // Approving the Savings Account for deposit of tokens
            await env.savingsAccount.connect(borrower).approve(liquidityShares.mul(100), Collateral.address, pool.address);
            await env.savingsAccount
                .connect(borrower)
                .deposit(liquidityShares.mul(100), Collateral.address, env.yields.compoundYield.address, borrower.address);

            // Checking balance before deposit
            let SharesBefore = (await pool.poolVariables()).baseLiquidityShares;

            // Depositing Tokens
            await expect(pool.connect(borrower).depositCollateral(AmountForDeposit, true)).to.emit(env.savingsAccount, 'Transfer');

            // Checking balance after deposit
            let SharesAfter = (await pool.poolVariables()).baseLiquidityShares;

            // Getting additional Shares
            let SharesReceived = SharesAfter.sub(SharesBefore);
            // console.log({SharesReceived: SharesReceived.toNumber()});

            // Checking shares received and matching with the deposited amount
            expectApproxEqual(SharesReceived, AmountForDeposit, 50);
        });

        it('Lender should be able to lend the borrow tokens directly to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(1).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await pool.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await pool.totalSupply();
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );
        });

        it('Lender should be able to lend the borrow tokens with same account in savingsAccount to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(1).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await pool.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(env.yields.noYield.address, amount);
            await env.savingsAccount
                .connect(lender)
                .deposit(amount, env.mockTokenContracts[0].contract.address, env.yields.noYield.address, lender.address);
            await env.savingsAccount.connect(lender).approve(amount, env.mockTokenContracts[0].contract.address, pool.address);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, env.yields.noYield.address));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await pool.totalSupply();
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );
        });

        it('Lender should be able to lend the borrow tokens different account in savingsAccount to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[10];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(2).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await pool.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender1.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender1).approve(env.yields.noYield.address, amount);
            await env.savingsAccount
                .connect(lender1)
                .deposit(amount, env.mockTokenContracts[0].contract.address, env.yields.noYield.address, lender1.address);
            await env.savingsAccount.connect(lender1).approve(amount, env.mockTokenContracts[0].contract.address, pool.address);

            const lendExpect = expect(pool.connect(lender1).lend(lender.address, amount, env.yields.noYield.address));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await pool.totalSupply();
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );
        });

        it('Borrower should not be able to withdraw token when amount < minimum borrow amount', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let amountLend = BigNumber.from(1).mul(BigNumber.from(10).pow(BTDecimals)); // 1 Borrow Token

            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amountLend);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amountLend);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amountLend);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amountLend, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amountLend, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amountLend);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.be.revertedWith('WBA2');

            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('0').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('0').toString()} 
                Actual: ${LoanStatus}`
            );
        });
    });

    describe('Pool Simulations: Active Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        const scaler = BigNumber.from('10').pow(30);

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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

            let salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            let borrowToken = env.mockTokenContracts[0].contract;
            let collateralToken = env.mockTokenContracts[1].contract;
            let minBorrowAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            let amount = minBorrowAmount.mul(2).div(3);
            let amount1 = minBorrowAmount.add(10).div(3);

            let lender1 = env.entities.extraLenders[3];

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Approving Borrow tokens to the lender1
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount1);
            await borrowToken.connect(admin).transfer(lender1.address, amount1);
            await borrowToken.connect(lender1).approve(poolAddress, amount1);

            // Lender1 lends into the pool
            const lendExpect1 = expect(pool.connect(lender1).lend(lender1.address, amount1, zeroAddress));
            await lendExpect1.to.emit(pool, 'LiquiditySupplied').withArgs(amount1, lender1.address);
            await lendExpect1.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender1.address, amount1);
        });

        it('Borrower should be able to withdraw token when amount >= minimum borrow amount', async function () {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[3];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let borrowToken = await env.mockTokenContracts[0].contract;

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            const borrowAssetBalanceBorrower = await borrowToken.balanceOf(borrower.address);
            const borrowAssetBalancePool = await borrowToken.balanceOf(pool.address);

            const tokensLent = await pool.totalSupply();
            await pool.connect(borrower).withdrawBorrowedAmount();
            const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
            const borrowAssetBalancePoolAfter = await borrowToken.balanceOf(pool.address);

            const tokensLentAfter = await pool.totalSupply();
            const protocolFee = tokensLent.mul(testPoolFactoryParams._protocolFeeFraction).div(scaler);

            assert(tokensLent.toString() == tokensLentAfter.toString(), 'Tokens lent changing while withdrawing borrowed amount');
            assert(
                borrowAssetBalanceBorrower.add(tokensLent).sub(protocolFee).toString() == borrowAssetBalanceBorrowerAfter.toString(),
                `Borrower not receiving correct lent amount. Expected: ${borrowAssetBalanceBorrower
                    .add(tokensLent)
                    .toString()} Actual: ${borrowAssetBalanceBorrowerAfter.toString()}`
            );
            assert(
                borrowAssetBalancePool.toString() == borrowAssetBalancePoolAfter.add(tokensLentAfter).toString(),
                `Pool token balance is not changing correctly. Expected: ${borrowAssetBalancePoolAfter.toString()} Actual: ${borrowAssetBalancePool
                    .sub(tokensLentAfter)
                    .toString()}`
            );

            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('1').toString(),
                `Pool is not in Active Stage. Expected: ${BigNumber.from('1').toString()} 
            Actual: ${LoanStatus}`
            );
        });

        context('Pool Simulations: Margin calls', async function () {
            it('Lender should not be able to request margin call if price has not reached threshold', async function () {
                let { admin, borrower, lender } = env.entities;
                // Requesting margin call
                await expect(pool.connect(lender).requestMarginCall()).to.be.revertedWith('RMC3');
            });

            it('Lender should be able to request margin call only if the price goes down', async function () {
                let { admin, borrower, lender } = env.entities;
                // Reducing the collateral ratio
                await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);

                // Requesting margin call
                await pool.connect(lender).requestMarginCall();

                // Setting the collateral ratio to correct value
                await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
            });

            it('Any user should be able to liquidate margin call if call is not answered in time', async function () {
                let { admin, borrower, lender } = env.entities;
                let random = env.entities.extraLenders[10];
                let borrowToken = env.mockTokenContracts[0].contract;
                let collateralToken = env.mockTokenContracts[1].contract;
                let strategy = env.yields.compoundYield.address;

                // Setting a lower collateral ratio and requesting for margin call
                await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);
                // await pool.connect(lender).requestMarginCall();

                await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

                // Balance check before liquidation
                let lenderBorrowTokenBefore = await borrowToken.balanceOf(lender.address);
                let randomCollateralBefore = await collateralToken.balanceOf(random.address);
                let collateralBalancePoolBefore = await env.savingsAccount
                    .connect(admin)
                    .balanceInShares(pool.address, collateralToken.address, strategy);
                // console.log({collateralBalancePoolBefore: collateralBalancePoolBefore.toString()});

                const liquidationTokens = await pool.balanceOf(lender.address);
                // console.log({LiquidationToken: liquidationTokens.toString()});
                await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, liquidationTokens.mul(2));
                await borrowToken.connect(admin).transfer(random.address, liquidationTokens.mul(2));
                await borrowToken.connect(random).approve(pool.address, liquidationTokens.mul(2));

                // Liquidate lender after margin call duration is over
                let liquidateExpect = expect(pool.connect(random).liquidateForLender(lender.address, false, false, false));
                await liquidateExpect.to.emit(pool, 'LenderLiquidated');

                // Balance check after liquidation
                let lenderBorrowTokenAfter = await borrowToken.balanceOf(lender.address);
                let randomCollateralAfter = await collateralToken.balanceOf(random.address);
                let lenderPoolTokenAfter = await pool.balanceOf(lender.address);
                let collateralBalancePoolAfter = await env.savingsAccount
                    .connect(admin)
                    .balanceInShares(pool.address, collateralToken.address, strategy);

                // The pool Token balance of the lender should be zero after liquidation
                assert(
                    lenderPoolTokenAfter.toString() == BigNumber.from('0').toString(),
                    `Lender not liquidated Properly. Actual ${lenderPoolTokenAfter.toString()} Expected ${BigNumber.from('0').toString()}`
                );

                // Getting the Collateral Token balance of the pool
                let collateralBalancePoolDif = collateralBalancePoolBefore.sub(collateralBalancePoolAfter);
                // console.log({collateralBalancePoolDif: collateralBalancePoolDif.toString()});

                let collateralTokenBalance = await env.yields.compoundYield.callStatic.getTokensForShares(
                    collateralBalancePoolDif,
                    collateralToken.address
                );
                // console.log({ collateralTokenBalance: collateralTokenBalance.toString() });

                // Checking for correct liquidator reward
                let rewardReceived = randomCollateralAfter.sub(randomCollateralBefore);
                // console.log({ rewardReceived: rewardReceived.toString() });

                expectApproxEqual(collateralTokenBalance, rewardReceived, 10);

                // Checking the Borrow Tokens received by Lender
                let LenderReturn = lenderBorrowTokenAfter.sub(lenderBorrowTokenBefore);
                // console.log({LenderReturn: LenderReturn.toString()});

                await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
            });

            it('When all lenders request margin call, there should be no collateral left in pool', async function () {
                let { admin, borrower, lender } = env.entities;
                let lender1 = env.entities.extraLenders[3];
                let random = env.entities.extraLenders[10];
                let borrowToken = env.mockTokenContracts[0].contract;
                let collateralToken = env.mockTokenContracts[1].contract;
                let strategy = env.yields.compoundYield.address;

                // Setting a lower collateral ratio and requesting for margin call
                await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);
                await pool.connect(lender1).requestMarginCall();

                await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

                const liquidationTokens = await pool.balanceOf(lender1.address);
                // console.log({LiquidationToken: liquidationTokens.toString()});
                await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, liquidationTokens.mul(2));
                await borrowToken.connect(admin).transfer(random.address, liquidationTokens.mul(2));
                await borrowToken.connect(random).approve(pool.address, liquidationTokens.mul(2));

                // Liquidate lender after margin call duration is over
                let liquidateExpect = expect(pool.connect(random).liquidateForLender(lender1.address, false, false, false));
                await liquidateExpect.to.emit(pool, 'LenderLiquidated');

                let collateralBalancePoolAfter = await env.savingsAccount
                    .connect(admin)
                    .balanceInShares(pool.address, collateralToken.address, strategy);
                // console.log({collateralBalancePoolAfter: collateralBalancePoolAfter.toString()});

                expectApproxEqual(collateralBalancePoolAfter, 0, 100);

                await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
            });
        });
    });

    describe('Pool Simulations: Defaulted Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        const scaler = BigNumber.from('10').pow(30);

        beforeEach(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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

            let salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ actualPoolAddress: pool.address });
            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            // await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Borrower withdraws borrow tokens
            await pool.connect(borrower).withdrawBorrowedAmount();
        });

        it('Anyone should be able to Liquidate the loan, if borrower misses repayment. Directly using wallets', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Borrower should default payment, either misses or margin calls happen
            const interestForCurrentPeriod = (
                await env.repayments.connect(borrower).getInterestDueTillInstalmentDeadline(pool.address)
            ).div(scaler);

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            // Checking calculated and received interest to be paid
            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment done for period 1
            await env.repayments.connect(random).repay(pool.address, repayAmount);

            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);

            // Travel beyond the current repayment period, borrower misses next repayment
            await blockTravel(network, parseInt(endOfPeriod.add(1001).toString()));

            const collateralShares = await env.savingsAccount
                .connect(borrower)
                .balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            let collateralTokens = await poolStrategy.callStatic.getTokensForShares(collateralShares, collateralToken.address);
            let borrowTokensForCollateral = await pool.getEquivalentTokens(collateralToken.address, borrowToken.address, collateralTokens);

            // Calling liquidate pool
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, borrowTokensForCollateral);
            await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
            await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);

            const LiquidatorCollateralBalanceBefore = await collateralToken.balanceOf(random.address);
            const LenderBalanceBefore = await borrowToken.balanceOf(lender.address);
            const poolTotalSupply = await pool.totalSupply();
            // console.log({ LenderBalanceBefore: LenderBalanceBefore.toString() });
            await pool.connect(random).liquidatePool(false, false, false);

            // Loan status should be 4
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('4').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('4').toString()}
                Actual: ${LoanStatus}`
            );

            await pool.connect(lender).withdrawLiquidity();

            const LenderBalanceAfter = await borrowToken.balanceOf(lender.address);
            const LiquidatorCollateralBalanceAfter = await collateralToken.balanceOf(random.address);
            let LiquidatorCollateralBalDiff = LiquidatorCollateralBalanceAfter.sub(LiquidatorCollateralBalanceBefore);
            // let liquidatorRewardFraction = await env.poolFactory.connect(admin).liquidatorRewardFraction();
            console.log(env.poolFactory.address);
            const BorrowEquivalent = await pool
                .connect(admin)
                .correspondingBorrowTokens(
                    LiquidatorCollateralBalDiff,
                    env.priceOracle.address,
                    testPoolFactoryParams._liquidatorRewardFraction
                );
            // console.log({BorrowEquivalent: BorrowEquivalent.toString()});
            const protocolFee = poolTotalSupply.mul(testPoolFactoryParams._protocolFeeFraction).div(scaler);
            // console.log({ protocolFee: protocolFee.toString() });
            const FinalBorrowLender = BorrowEquivalent.sub(protocolFee);
            // console.log({ FinalBorrowLender: FinalBorrowLender.toString() });

            let LenderBalanaceDiff = LenderBalanceAfter.sub(LenderBalanceBefore);

            // console.log({ LenderBalanaceDiff: LenderBalanaceDiff.toString() });
            console.log({ LiquidatorCollateralBalDiff: LiquidatorCollateralBalDiff.toString() });
            console.log({ collateralTokens: collateralTokens.toString() });

            // TODO: Fix issues with the balance checks
            // expectApproxEqual(LiquidatorCollateralBalDiff, collateralTokens, 50);
        });

        xit('Anyone should be able to Liquidate the loan, if borrower misses repayment. From savings account', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[11]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Borrower should default payment, either misses or margin calls happen
            const interestForCurrentPeriod = (
                await env.repayments.connect(borrower).getInterestDueTillInstalmentDeadline(pool.address)
            ).div(scaler);

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            // Checking calculated and received interest to be paid
            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment done for period 1
            await env.repayments.connect(random).repay(pool.address, repayAmount);

            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);

            // Travel beyond the current repayment period, borrower misses next repayment
            await blockTravel(network, parseInt(endOfPeriod.add(1001).toString()));

            const collateralShares = await env.savingsAccount
                .connect(borrower)
                .balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            let collateralTokens = await poolStrategy.callStatic.getTokensForShares(collateralShares, collateralToken.address);
            let borrowTokensForCollateral = await pool.getEquivalentTokens(collateralToken.address, borrowToken.address, collateralTokens);

            // Calling liquidate pool
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, borrowTokensForCollateral);
            await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
            await borrowToken.connect(random).approve(env.yields.compoundYield.address, borrowTokensForCollateral);
            await env.savingsAccount
                .connect(random)
                .deposit(borrowTokensForCollateral, borrowToken.address, env.yields.compoundYield.address, random.address);
            await env.savingsAccount.connect(random).approve(borrowTokensForCollateral, borrowToken.address, pool.address);

            console.log('liquidatePool');
            console.log('btc', borrowTokensForCollateral.toString());
            const LiquidatorCollateralBalanceBefore = await collateralToken.balanceOf(random.address);
            await pool.connect(random).liquidatePool(true, false, false);

            // Loan status should be 4
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('4').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('4').toString()}
                Actual: ${LoanStatus}`
            );

            const LenderBalanceBefore = await borrowToken.balanceOf(lender.address);
            console.log('withdrawLiquidity');
            await pool.connect(lender).withdrawLiquidity();
            // await pool.connect(lender).withdrawRepayment();
            const LenderBalanceAfter = await borrowToken.balanceOf(lender.address);
            const LiquidatorCollateralBalanceAfter = await collateralToken.balanceOf(random.address);

            let LenderBalanaceDiff = LenderBalanceAfter.sub(LenderBalanceBefore);
            let LiquidatorCollateralBalDiff = LiquidatorCollateralBalanceAfter.sub(LiquidatorCollateralBalanceBefore);

            // console.log({ LenderBalanaceDiff: LenderBalanaceDiff.toString() });
            console.log({ LiquidatorCollateralBalDiff: LiquidatorCollateralBalDiff.toString() });
            console.log({ collateralTokens: collateralTokens.toString() });

            // TODO: Fix issues with the balance checks
            // expectApproxEqual(LiquidatorCollateralBalDiff, collateralTokens, 50);
        });

        it('Anyone should be able to Liquidate the loan, if borrower misses repayment. To savings account', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[12]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Borrower should default payment, either misses or margin calls happen
            const interestForCurrentPeriod = (
                await env.repayments.connect(borrower).getInterestDueTillInstalmentDeadline(pool.address)
            ).div(scaler);

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            // Checking calculated and received interest to be paid
            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment done for period 1
            await env.repayments.connect(random).repay(pool.address, repayAmount);

            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);

            // Travel beyond the current repayment period, borrower misses next repayment
            await blockTravel(network, parseInt(endOfPeriod.add(1001).toString()));

            const collateralShares = await env.savingsAccount
                .connect(borrower)
                .balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            let collateralTokens = await poolStrategy.callStatic.getTokensForShares(collateralShares.sub(2), collateralToken.address);
            let borrowTokensForCollateral = await pool.getEquivalentTokens(collateralToken.address, borrowToken.address, collateralTokens);

            // Calling liquidate pool
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, borrowTokensForCollateral);
            await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
            await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);

            // const LiquidatorCollateralBalanceBefore = await collateralToken.balanceOf(random.address);
            const LiquidatorCollateralSharesBefore = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, collateralToken.address, poolStrategy.address);
            await pool.connect(random).liquidatePool(false, true, false);

            // Loan status should be 4
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('4').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('4').toString()}
                Actual: ${LoanStatus}`
            );

            const LenderBalanceBefore = await borrowToken.balanceOf(lender.address);
            await pool.connect(lender).withdrawLiquidity();
            // await pool.connect(lender).withdrawRepayment();
            const LenderBalanceAfter = await borrowToken.balanceOf(lender.address);
            // const LiquidatorCollateralBalanceAfter = await collateralToken.balanceOf(random.address);
            const LiquidatorCollateralSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, collateralToken.address, poolStrategy.address);

            let LenderBalanaceDiff = LenderBalanceAfter.sub(LenderBalanceBefore);
            let LiquidatorCollateralSharesDiff = LiquidatorCollateralSharesAfter.sub(LiquidatorCollateralSharesBefore);
            let LiquidatorCollateralBalance = await env.yields.compoundYield.callStatic.getTokensForShares(
                LiquidatorCollateralSharesDiff,
                collateralToken.address
            );

            // console.log({ LenderBalanaceDiff: LenderBalanaceDiff.toString() });
            console.log({ LiquidatorCollateralBalance: LiquidatorCollateralBalance.toString() });
            console.log({ collateralTokens: collateralTokens.toString() });

            // TODO: Fix issues with the balance checks
            // expectApproxEqual(LiquidatorCollateralBalance, collateralTokens, 50);
        });

        xit('Anyone should be able to Liquidate the loan, if borrower misses repayment. From and to savings account', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[13]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Borrower should default payment, either misses or margin calls happen
            const interestForCurrentPeriod = (
                await env.repayments.connect(borrower).getInterestDueTillInstalmentDeadline(pool.address)
            ).div(scaler);

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            // Checking calculated and received interest to be paid
            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment done for period 1
            await env.repayments.connect(random).repay(pool.address, repayAmount);

            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);

            // Travel beyond the current repayment period, borrower misses next repayment
            await blockTravel(network, parseInt(endOfPeriod.add(1001).toString()));

            const collateralShares = await env.savingsAccount
                .connect(borrower)
                .balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            let collateralTokens = await poolStrategy.callStatic.getTokensForShares(collateralShares.sub(2), collateralToken.address);
            let borrowTokensForCollateral = await pool.getEquivalentTokens(collateralToken.address, borrowToken.address, collateralTokens);

            // Calling liquidate pool
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, borrowTokensForCollateral);
            await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
            await borrowToken.connect(random).approve(env.yields.noYield.address, borrowTokensForCollateral);
            await env.savingsAccount
                .connect(random)
                .deposit(borrowTokensForCollateral, borrowToken.address, env.yields.noYield.address, random.address);
            await env.savingsAccount.connect(random).approve(borrowTokensForCollateral, borrowToken.address, pool.address);
            // await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);

            // const LiquidatorCollateralBalanceBefore = await collateralToken.balanceOf(random.address);
            const LiquidatorCollateralSharesBefore = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, collateralToken.address, poolStrategy.address);
            await pool.connect(random).liquidatePool(true, true, false);

            // Loan status should be 4
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('4').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('4').toString()}
                Actual: ${LoanStatus}`
            );

            const LenderBalanceBefore = await borrowToken.balanceOf(lender.address);
            await pool.connect(lender).withdrawLiquidity();
            // await pool.connect(lender).withdrawRepayment();
            const LenderBalanceAfter = await borrowToken.balanceOf(lender.address);
            // const LiquidatorCollateralBalanceAfter = await collateralToken.balanceOf(random.address);
            const LiquidatorCollateralSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, collateralToken.address, poolStrategy.address);

            let LenderBalanaceDiff = LenderBalanceAfter.sub(LenderBalanceBefore);
            let LiquidatorCollateralSharesDiff = LiquidatorCollateralSharesAfter.sub(LiquidatorCollateralSharesBefore);
            let LiquidatorCollateralBalance = await env.yields.compoundYield.callStatic.getTokensForShares(
                LiquidatorCollateralSharesDiff,
                collateralToken.address
            );

            // console.log({ LenderBalanaceDiff: LenderBalanaceDiff.toString() });
            console.log({ LiquidatorCollateralBalance: LiquidatorCollateralBalance.toString() });
            console.log({ collateralTokens: collateralTokens.toString() });

            // TODO: Fix issues with the balance checks
            // expectApproxEqual(LiquidatorCollateralBalance, collateralTokens, 50);
        });
    });

    describe('Pool Simulations: Closed Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        const scaler = BigNumber.from('10').pow(30);

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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

            let salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            let borrowToken = env.mockTokenContracts[0].contract;
            let collateralToken = env.mockTokenContracts[1].contract;
            let minBorrowAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            let amount = minBorrowAmount.mul(2).div(3);
            let amount1 = minBorrowAmount.add(10).div(3);

            let lender1 = env.entities.extraLenders[3];

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Approving Borrow tokens to the lender1
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount1);
            await borrowToken.connect(admin).transfer(lender1.address, amount1);
            await borrowToken.connect(lender1).approve(poolAddress, amount1);

            // Lender1 lends into the pool
            const lendExpect1 = expect(pool.connect(lender1).lend(lender1.address, amount1, zeroAddress));
            await lendExpect1.to.emit(pool, 'LiquiditySupplied').withArgs(amount1, lender1.address);
            await lendExpect1.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender1.address, amount1);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
            await pool.connect(borrower).withdrawBorrowedAmount();
        });

        context('Pool Simulations: Borrower Requests Extension', async function () {
            it('Only borrower should be able to request extension', async function () {
                let { admin, borrower, lender } = env.entities;
                let random = env.entities.extraLenders[10];

                // Requesting margin call
                await expect(env.extenstion.connect(random).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
                await expect(env.extenstion.connect(lender).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
                await env.extenstion.connect(borrower).requestExtension(pool.address);
            });

            it('Extension passes only when majority lenders vote', async function () {
                let { admin, borrower, lender } = env.entities;
                let lender1 = env.entities.extraLenders[3];

                // await env.extenstion.connect(borrower).requestExtension(pool.address);
                await env.extenstion.connect(lender1).voteOnExtension(pool.address);
                await env.extenstion.connect(lender).voteOnExtension(pool.address);
                const { isLoanExtensionActive } = await env.repayments.connect(admin).repayVariables(pool.address);
                assert(isLoanExtensionActive, 'Extension not active');
            });

            it("Can't vote after extension is passed", async () => {
                let { admin, borrower, lender } = env.entities;
                let lender1 = env.entities.extraLenders[3];

                // await env.extenstion.connect(borrower).requestExtension(pool.address);
                // await env.extenstion.connect(lender).voteOnExtension(pool.address);
                // const { isLoanExtensionActive } = await env.repayments.connect(admin).repayVariables(pool.address);
                // assert(isLoanExtensionActive, 'Extension not active');
                await expect(env.extenstion.connect(lender1).voteOnExtension(pool.address)).to.be.revertedWith(
                    'Pool::voteOnExtension - Voting is over'
                );
            });

            it('Cannot liquidate pool after extension is passed', async () => {
                let { admin, borrower, lender } = env.entities;
                let random = env.entities.extraLenders[10];

                // await env.extenstion.connect(borrower).requestExtension(pool.address);
                // await env.extenstion.connect(lender).voteOnExtension(pool.address);
                // const { isLoanExtensionActive } = await env.repayments.connect(admin).repayVariables(pool.address);
                // assert(isLoanExtensionActive, 'Extension not active');
                await expect(pool.connect(random).liquidatePool(false, false, false)).to.be.revertedWith('LP2');
            });

            it('Should be able to repay after extension is passed', async () => {
                let { admin, borrower, lender } = env.entities;
                let random = env.entities.extraLenders[10];
                let borrowToken = env.mockTokenContracts[0].contract;
                const scaler = BigNumber.from(10).pow(30);

                // await env.extenstion.connect(borrower).requestExtension(pool.address);
                // await env.extenstion.connect(lender).voteOnExtension(pool.address);
                // const { isLoanExtensionActive } = await env.repayments.connect(admin).repayVariables(pool.address);
                // assert(isLoanExtensionActive, 'Extension not active');

                let interestForCurrentPeriod = (await env.repayments.connect(admin).getInterestDueTillInstalmentDeadline(pool.address)).div(
                    scaler
                );
                const endOfExtension: BigNumber = (await env.repayments.connect(admin).getNextInstalmentDeadline(pool.address)).div(scaler);

                await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, interestForCurrentPeriod.add(1));
                await borrowToken.connect(admin).transfer(random.address, interestForCurrentPeriod.add(1));
                await borrowToken.connect(random).approve(env.repayments.address, interestForCurrentPeriod.add(1));
                await env.repayments.connect(random).repay(pool.address, interestForCurrentPeriod.add(1));

                const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
                await blockTravel(network, parseInt(endOfExtension.add(gracePeriod).add(1).toString()));

                interestForCurrentPeriod = (await env.repayments.connect(admin).getInterestDueTillInstalmentDeadline(pool.address)).div(
                    scaler
                );

                await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, interestForCurrentPeriod);
                await borrowToken.connect(admin).transfer(random.address, interestForCurrentPeriod);
                await borrowToken.connect(random).approve(env.repayments.address, interestForCurrentPeriod);
                await env.repayments.connect(random).repay(pool.address, interestForCurrentPeriod);
            });
        });

        xit('Borrower should be able to close the pool, once repayment is done', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Token

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Borrower withdraws borrow tokens
            await pool.connect(borrower).withdrawBorrowedAmount();

            // Calculate repayment amount for period 1
            const interestForCurrentPeriod = (await env.repayments.connect(random).getInterestDueTillInstalmentDeadline(pool.address)).div(
                scaler
            );

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment of Interest for period 1
            await env.repayments.connect(random).repay(pool.address, repayAmount);
            console.log('Repayment for 1 period Done!');

            // Repayment of principal should be reverted as all repayments are not done
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(random.address, amount);
            await borrowToken.connect(random).approve(env.repayments.address, amount);

            await expect(env.repayments.connect(random).repayPrincipal(pool.address, { value: amount })).to.be.revertedWith(
                'Repayments:repayPrincipal Unpaid interest'
            );

            // Block travel to repayment period 2
            console.log('Timetravel to period 2');
            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);
            await blockTravel(network, parseInt(endOfPeriod.add(10).toString()));

            let loanduration = (await env.repayments.connect(random).repaymentConstants(pool.address)).loanDuration;
            let loandurationDone = (await env.repayments.connect(random).repaymentVars(pool.address)).loanDurationCovered;

            console.log('loan duration', loanduration.toString());
            console.log('Loan duration done', loandurationDone.toString());

            // Calculate repayment amount for period 2
            const interestForCurrentPeriod1 = (await env.repayments.connect(random).getInterestDueTillInstalmentDeadline(pool.address)).div(
                scaler
            );
            console.log('Interest for second period observed', interestForCurrentPeriod1.toString());
            const repayAmount2 = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount2);
            await borrowToken.connect(admin).transfer(random.address, repayAmount2);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount2);

            // Repayment of Interest for period 2
            await env.repayments.connect(random).repay(pool.address, repayAmount2);
            console.log('Repayment for 2 period Done!');

            // Block travel to beyond repayment period 2
            console.log('Timetravel to beyond period 2');
            const endOfPeriod1: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);
            console.log('EndOfPeriod2', endOfPeriod1.toString());
            // const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
            // await blockTravel(network, parseInt(endOfPeriod1.add(gracePeriod).add(10).toString()));
            await blockTravel(network, parseInt(endOfPeriod1.mul(2).toString()));

            loanduration = (await env.repayments.connect(random).repaymentConstants(pool.address)).loanDuration;
            loandurationDone = (await env.repayments.connect(random).repaymentVars(pool.address)).loanDurationCovered;

            console.log('Loan duration', loanduration.toString());
            console.log('Loan duration done', loandurationDone.toString());
            // Repayment of principal at the end of the loan
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(random.address, amount);
            await borrowToken.connect(random).approve(env.repayments.address, amount);

            // Should it be random or borrower?
            await env.repayments.connect(random).repayPrincipal(pool.address, { value: amount });

            // Loan status should be 2
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            console.log('Loan Status', LoanStatus);
            // assert(
            //     LoanStatus.toString() == BigNumber.from('2').toString(),
            //     `Pool should be in Collection Stage. Expected: ${BigNumber.from('2').toString()}
            //     Actual: ${LoanStatus}`
            // );
        });
    });

    describe('Pool Simulations: Cancellation Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('Borrower should be able to cancel the pool with penalty charges', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let Borrow = await env.mockTokenContracts[0].contract;

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await pool.totalSupply();

            //Lenders lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const borrowTokenBalancebefore = await Borrow.balanceOf(lender.address);
            const borrowTokenBalancePool = await Borrow.balanceOf(pool.address);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await pool.totalSupply();
            // const borrowTokenBalanceAfter = await Borrow.balanceOf(lender.address);
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );

            //borrower cancels the pool
            await pool.connect(borrower).cancelPool();

            // lender should be able to withdraw Liquidity
            await pool.connect(lender).withdrawLiquidity();

            // Checking balance after pool cancel and liquidation
            const poolTokenBalanceAfterCancel = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfterCancel = await pool.totalSupply();
            const borrowTokenBalanceAfterCancel = await Borrow.balanceOf(lender.address);

            assert(
                poolTokenBalanceAfterCancel.toString() == BigNumber.from('0').toString(),
                `Pool tokens not burnt correctly. amount: ${amount} Expected: ${BigNumber.from('0').toString()} 
                Actual: ${poolTokenBalanceAfterCancel}`
            );
            assert(
                poolTokenTotalSupplyAfterCancel.toString() == BigNumber.from('0').toString(),
                `Pool tokens not burnt correctly. amount: ${amount} Expected: ${BigNumber.from('0').toString()} 
                Actual: ${poolTokenTotalSupplyAfterCancel}`
            );
            assert(
                borrowTokenBalanceAfterCancel.toString() == borrowTokenBalancebefore.add(borrowTokenBalancePool).toString(),
                `Pool tokens not liquidated correctly and liquidation penalty not received. amount: ${amount} 
                Expected: ${borrowTokenBalancebefore.add(borrowTokenBalancePool).toString()} 
                Actual: ${borrowTokenBalanceAfterCancel}`
            );
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('3').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('3').toString()} 
                Actual: ${LoanStatus}`
            );
        });
    });

    describe('Pool Simulations: Termination Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('Pool Factory owner should be able to terminate the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, zeroAddress));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            await expect(pool.connect(admin).terminatePool()).to.emit(pool, 'PoolTerminated');

            // Check if loan status is set to 'TERMINATED' (5)
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('5').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('5').toString()} 
                Actual: ${LoanStatus}`
            );
        });
    });

    describe('Restore Snapshot', async () => {
        it('Trying to restore Snapshot', async () => {
            await network.provider.request({
                method: 'evm_revert',
                params: [snapshotId],
            });
        });
    });
}
