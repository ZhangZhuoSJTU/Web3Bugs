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

import { expect, assert } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    createPoolParams,
    creditLineFactoryParams,
    WhaleAccount,
    zeroAddress,
    ChainLinkAggregators,
    verificationParams,
} from '../constants';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CompoundYield } from '@typechain/CompoundYield';
import { getPoolInitSigHash } from '../createEnv/poolLogic';
import { CreditLine } from '../../typechain/CreditLine';
import { Contracts } from '../../existingContracts/compound.json';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20Detailed } from '@typechain/ERC20Detailed';
import { SavingsAccount } from '@typechain/SavingsAccount';

export async function CreditLines(
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
    const hre = require('hardhat');
    const { ethers, network } = hre;
    let snapshotId: any;

    describe('Create Snapshot', async () => {
        it('Trying Creating Snapshot', async () => {
            snapshotId = await network.provider.request({
                method: 'evm_snapshot',
                params: [],
            });
        });
    });

    describe(`CreditLines ${BorrowToken}/${CollateralToken}: Requesting credit lines`, async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let creditLine: CreditLine;
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
            // console.log(await env.mockTokenContracts[0].contract.decimals());
            // console.log(await env.mockTokenContracts[1].contract.decimals());

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

            // console.log({ actualPoolAddress: pool.address });
            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('CreditLine Request: Borrower and Lender cannot be same', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        lender.address,
                        borrowLimit,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            ).to.be.revertedWith('Lender and Borrower cannot be same addresses');
        });

        it('CreditLine Request: Should revert if price oracle does not exist', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine.connect(lender).request(
                    borrower.address,
                    borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    Contracts.BAT, // Using a different borrow token
                    _collateralAsset,
                    true
                )
            ).to.be.revertedWith('R: No price feed');
        });

        xit('CreditLine Request: Should revert if collateral ratio is less than liquidation threshold', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(50).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            ).to.be.revertedWith('CL: collateral ratio should be higher');
        });

        it('Creditline Request: Check for correct request', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);

            let StatusActual = (await creditLine.connect(admin).creditLineVariables(values)).status;
            assert(
                StatusActual.toString() == BigNumber.from('1').toString(),
                `Creditline should be in requested Stage. Expected: ${BigNumber.from('1').toString()} 
                Actual: ${StatusActual}`
            );
        });

        it('Creditline Active: Accepting credit lines', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);

            await expect(creditLine.connect(lender).accept(values)).to.be.revertedWith(
                "Only Borrower or Lender who hasn't requested can accept"
            );

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let StatusActual = (await creditLine.connect(admin).creditLineVariables(values)).status;
            assert(
                StatusActual.toString() == BigNumber.from('2').toString(),
                `Creditline should be in requested Stage. Expected: ${BigNumber.from('2').toString()} 
                Actual: ${StatusActual}`
            );
        });
    });

    describe(`Creditline ${BorrowToken}/${CollateralToken}: Active tests`, async function () {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let creditLine: CreditLine;
        let Compound: CompoundYield;

        let borrowLimit: BigNumber;
        let collateralAmout: BigNumber;
        let amountForDeposit: BigNumber;
        let _liquidationThreshold: BigNumberish;
        let _borrowRate: BigNumberish;
        let _autoLiquidation: boolean;
        let _collateralRatio: BigNumberish;
        let _borrowAsset: string;
        let _collateralAsset: string;
        let values: any;

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

            // console.log({ actualPoolAddress: pool.address });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            borrowLimit = BigNumber.from('10').mul(BigNumber.from('10').pow(BTDecimals));
            collateralAmout = BigNumber.from('10').mul(BigNumber.from('10').pow(CTDecimals));
            amountForDeposit = BigNumber.from('100');
            _liquidationThreshold = BigNumber.from(100);
            _borrowRate = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            _autoLiquidation = true;
            _collateralRatio = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            _borrowAsset = env.mockTokenContracts[0].contract.address;
            _collateralAsset = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);
        });

        it('Creditline Active: Cannot deposit collateral when credit line not in active stage', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(random).approve(creditLine.address, collateralAmout);

            await expect(
                creditLine.connect(random).depositCollateral(values, collateralAmout, env.yields.compoundYield.address, false)
            ).to.be.revertedWith('CreditLine not active');
        });

        it('Creditline Active: cannot borrow from creditline if not active', async function () {
            let { admin, borrower, lender } = env.entities;
            let amount: BigNumber = BigNumber.from('100');

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amount);
            await env.mockTokenContracts[1].contract.connect(admin).approve(borrower.address, amount);

            await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
                'CreditLine: The credit line is not yet active.'
            );
        });

        xit('Creditline Active: Deposit Collateral directly from wallet', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let liquidityShares = await env.yields.compoundYield.callStatic.getSharesForTokens(amountForDeposit, _collateralAsset);
            // console.log({ amountForDeposit: amountForDeposit.toString() });
            // console.log({ liquidityShares: liquidityShares.toString() });

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amountForDeposit);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, amountForDeposit);
            await env.mockTokenContracts[1].contract.connect(random).approve(creditLine.address, amountForDeposit);

            const collateralBalanceInShares = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInShares = await env.mockTokenContracts[1].contract.balanceOf(random.address);

            await creditLine.connect(random).depositCollateral(values, amountForDeposit, env.yields.compoundYield.address, false);

            const collateralBalanceInSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInSharesAfter = await env.mockTokenContracts[1].contract.balanceOf(random.address);

            const collateralBalanceInSharesDiff = collateralBalanceInSharesAfter.sub(collateralBalanceInShares);
            const randomBalanceInSharesDiff = randomBalanceInShares.sub(randomBalanceInSharesAfter);
            // console.log({ collateralBalanceInSharesDiff: collateralBalanceInSharesDiff.toString() });
            // console.log({ randomBalanceInSharesDiff: randomBalanceInSharesDiff.toString() });

            expectApproxEqual(liquidityShares, collateralBalanceInSharesDiff, 50);
            expectApproxEqual(randomBalanceInSharesDiff, amountForDeposit, 50);
        });

        it('Creditline Active: Deposit Collateral from savings account', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let liquidityShares = await env.yields.compoundYield.callStatic.getTokensForShares(amountForDeposit, _collateralAsset);
            // console.log({ amountForDeposit: amountForDeposit.toString() });
            // console.log({ liquidityShares: liquidityShares.toString() });

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(random).approve(env.yields.compoundYield.address, liquidityShares.mul(100));
            await env.savingsAccount.connect(random).approve(liquidityShares.mul(100), _collateralAsset, creditLine.address);
            await env.savingsAccount
                .connect(random)
                .deposit(liquidityShares.mul(100), _collateralAsset, env.yields.compoundYield.address, random.address);

            const collateralBalanceInShares = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInShares = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, _collateralAsset, env.yields.compoundYield.address);

            await creditLine.connect(random).depositCollateral(values, amountForDeposit, env.yields.compoundYield.address, true);

            const collateralBalanceInSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, _collateralAsset, env.yields.compoundYield.address);

            const collateralBalanceInSharesDiff = collateralBalanceInSharesAfter.sub(collateralBalanceInShares);
            const randomBalanceInSharesDiff = randomBalanceInShares.sub(randomBalanceInSharesAfter);
            // console.log({ collateralBalanceInSharesDiff: collateralBalanceInSharesDiff.toString() });
            // console.log({ randomBalanceInSharesDiff: randomBalanceInSharesDiff.toString() });

            let sharesReceived = await env.yields.compoundYield.callStatic.getSharesForTokens(amountForDeposit, _collateralAsset);
            // console.log({ amountForDeposit: amountForDeposit.toString() });
            // console.log({ sharesReceived: sharesReceived.toString() });

            expectApproxEqual(sharesReceived, collateralBalanceInSharesDiff, 50);
            expectApproxEqual(randomBalanceInSharesDiff, collateralBalanceInSharesDiff, 50);
        });

        it('Only borrower can borrow from creditline', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let random1 = env.entities.extraLenders[20];
            let amount: BigNumber = BigNumber.from('100');

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amount);
            await env.mockTokenContracts[1].contract.connect(admin).approve(random1.address, amount);

            await expect(creditLine.connect(random1).borrow(values, amount)).to.be.revertedWith('Only credit line Borrower can access');
        });

        it('Creditline Active: cannot borrow from creditline if borrow amount exceeds limit', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let amount: BigNumber = BigNumber.from('100').mul(BigNumber.from('10').pow(BTDecimals));

            await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
                "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
            );
        });

        xit('Creditline Active: collateral ratio should not go down after withdraw', async function () {
            let { admin, borrower, lender } = env.entities;
            let amount: BigNumber = BigNumber.from('100');

            await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
                "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
            );
        });

        xit('Creditline Active: Borrower borrows amount', async function () {
            let { admin, borrower, lender } = env.entities;
            let amount: BigNumber = BigNumber.from('100');
            let deposit: BigNumber = BigNumber.from('10000');

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, deposit);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, deposit);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(creditLine.address, deposit);

            await creditLine.connect(borrower).depositCollateral(values, deposit, env.yields.compoundYield.address, false);

            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(env.yields.compoundYield.address, amount);
            console.log('Savings Account');
            await env.savingsAccount.connect(lender).approve(amount, _borrowAsset, borrower.address);
            await env.savingsAccount.connect(lender).deposit(amount, _borrowAsset, env.yields.compoundYield.address, lender.address);
            console.log('Savings Account - transfer and deposit done');

            // let Lender_balance = await env.savingsAccount.connect(admin).callStatic.balanceInShares(lender.address, _borrowAsset, env.yields.compoundYield.address);
            // console.log(Lender_balance.toString());
            console.log('Test Lender - ', lender.address);
            await creditLine.connect(borrower).borrow(values, amount);
        });
    });

    describe(`Credit Lines ${BorrowToken}/${CollateralToken}: Calculate Borrowable Amount`, async () => {
        let env: Environment;
        let creditLine: CreditLine;
        let admin: SignerWithAddress;
        let lender: SignerWithAddress;
        let borrower: SignerWithAddress;

        let deployHelper: DeployHelper;

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

            creditLine = env.creditLine;
            admin = env.entities.admin;
            lender = env.entities.lender;
            borrower = env.entities.borrower;
            deployHelper = new DeployHelper(admin);
        });

        it('If no collateral is deposited, then borrowable amount should be 0, autoliquidation = false', async () => {
            let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            creditLine = creditLine.connect(borrower);

            let creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            let ba = await creditLine.callStatic.calculateBorrowableAmount(creditLineNumber);
            expectApproxEqual(ba, 0, 0);
        });
        it('Should revert if credit line is not (active) (requested)', async () => {
            let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            creditLine = creditLine.connect(borrower);

            let creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            await creditLine.connect(lender).accept(creditLineNumber);
            await creditLine.connect(lender).close(creditLineNumber);
            await expect(creditLine.calculateBorrowableAmount(creditLineNumber)).to.be.revertedWith(
                'CreditLine: Cannot only if credit line ACTIVE or REQUESTED'
            );
        });

        it('In no case borrowable amount(including interest) should be more than the borrow limit, imm.. after adding the collateral', async () => {
            let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));

            await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, borrowLimit);
            // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
            // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
            await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

            creditLine = creditLine.connect(borrower);

            let creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            await creditLine.connect(lender).accept(creditLineNumber);

            await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
            await creditLine
                .connect(borrower)
                .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

            let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

            expect(borrowableAmount).lte(borrowLimit);
        });

        it('In no case borrowable amount(including interest) should be more than the borrow limit, after borrowing some tokens and doing block/time travel, partial amount', async () => {
            let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));

            await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
            // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
            // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
            await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

            creditLine = creditLine.connect(borrower);

            let creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            await creditLine.connect(lender).accept(creditLineNumber);

            await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
            await creditLine
                .connect(borrower)
                .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

            await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
            await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address);

            await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
            await creditLine.connect(borrower).borrow(creditLineNumber, borrowLimit.div(10000)); // borrow a very small amount

            await timeTravel(network, 86400 * 10); // 10 days

            await creditLine.connect(borrower).calculateBorrowableAmount(creditLineNumber); // the call is only for triggering the console events
            let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

            expect(borrowableAmount).lte(borrowLimit);
        });

        it('In no case borrowable amount(including interest) should be more than the borrow limit, after borrowing some tokens and doing block/time travel, full borrow limit', async () => {
            let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));

            await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
            // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
            // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
            await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

            creditLine = creditLine.connect(borrower);

            let creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            await creditLine.connect(lender).accept(creditLineNumber);

            await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
            await creditLine
                .connect(borrower)
                .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

            await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
            await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address);

            await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
            let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);
            await creditLine.connect(borrower).borrow(creditLineNumber, borrowableAmount.mul(95).div(100)); // 95% of borrow limit

            await timeTravel(network, 86400 * 10); // 10 days

            borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

            expect(borrowableAmount).lte(borrowLimit);
        });
    });

    describe.skip(`Credit Lines ${BorrowToken}/${CollateralToken}: Liquidate Credit Lines`, async () => {
        let env: Environment;
        let creditLine: CreditLine;
        let admin: SignerWithAddress;
        let lender: SignerWithAddress;
        let borrower: SignerWithAddress;

        let deployHelper: DeployHelper;

        let creditLineNumber: BigNumber;

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

            creditLine = env.creditLine;
            admin = env.entities.admin;
            lender = env.entities.lender;
            borrower = env.entities.borrower;
            deployHelper = new DeployHelper(admin);
        });

        beforeEach(async () => {
            let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));

            await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
            // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
            // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
            await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

            creditLine = creditLine.connect(borrower);

            creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            await creditLine.connect(lender).accept(creditLineNumber);

            await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
            await creditLine
                .connect(borrower)
                .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

            await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
            await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address);

            await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
            let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);
            await creditLine.connect(borrower).borrow(creditLineNumber, borrowableAmount.mul(95).div(100)); // 95% of borrow limit

            await timeTravel(network, 86400 * 10); // 10 days

            borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

            expect(borrowableAmount).lte(borrowLimit);
        });
        it.skip('Test Liquidation', async () => {});
    });

    describe(`Credit Lines ${BorrowToken}/${CollateralToken}: Repay Credit Lines`, async () => {
        let env: Environment;
        let creditLine: CreditLine;
        let admin: SignerWithAddress;
        let lender: SignerWithAddress;
        let borrower: SignerWithAddress;

        let deployHelper: DeployHelper;

        let creditLineNumber: BigNumber;

        let BorrowAsset: ERC20Detailed;
        let CollateralAsset: ERC20Detailed;
        let savingsAccount: SavingsAccount;

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
                CreditLineDefaultStrategy.NoStrategy,
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction,
                } as CreditLineInitParams,
                {
                    activationDelay: verificationParams.activationDelay
                } as VerificationParams,
            );

            creditLine = env.creditLine;
            admin = env.entities.admin;
            lender = env.entities.lender;
            borrower = env.entities.borrower;
            savingsAccount = env.savingsAccount;
            deployHelper = new DeployHelper(admin);
        });

        beforeEach(async () => {
            BorrowAsset = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);

            let borrowDecimals = await BorrowAsset.decimals();
            let collateralDecimals = await CollateralAsset.decimals();

            let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
            let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

            let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));

            await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
            // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
            // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
            await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

            creditLine = creditLine.connect(borrower);

            creditLineNumber = await creditLine
                .connect(borrower)
                .callStatic.request(
                    lender.address,
                    borrowLimit,
                    borrowRate,
                    true,
                    colRatio,
                    BorrowAsset.address,
                    CollateralAsset.address,
                    false
                );

            await creditLine
                .connect(borrower)
                .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

            await creditLine.connect(lender).accept(creditLineNumber);

            await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
            await creditLine
                .connect(borrower)
                .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

            await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
            await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address);

            await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
            let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);
            await creditLine.connect(borrower).borrow(creditLineNumber, borrowableAmount.mul(95).div(100)); // 95% of borrow limit

            await timeTravel(network, 86400 * 10); // 10 days

            borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

            expect(borrowableAmount).lte(borrowLimit);
        });

        it('Repay from account directly', async () => {
            let borrowDecimals = await BorrowAsset.decimals();
            let amountToRepay = BigNumber.from(5).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens

            await BorrowAsset.connect(borrower).approve(creditLine.address, amountToRepay);
            const borrowerBalanceBeforeRepay = await BorrowAsset.balanceOf(borrower.address);
            const lenderSharesBeforeRepay = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
            await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, false);

            const borrowerBalanceAfterRepay = await BorrowAsset.balanceOf(borrower.address);

            const lenderSharesAfterRepay = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
            expectApproxEqual(borrowerBalanceBeforeRepay.sub(borrowerBalanceAfterRepay), amountToRepay, 0);
            expectApproxEqual(lenderSharesAfterRepay.sub(lenderSharesBeforeRepay), amountToRepay, 0);
        });

        it('Repay From Savings Account', async () => {
            let borrowDecimals = await BorrowAsset.decimals();
            let amountToRepay = BigNumber.from(5).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens

            await BorrowAsset.connect(borrower).approve(env.yields.noYield.address, amountToRepay);
            await savingsAccount
                .connect(borrower)
                .deposit(amountToRepay, BorrowAsset.address, env.yields.noYield.address, borrower.address);
            await savingsAccount.connect(borrower).approve(amountToRepay, BorrowAsset.address, creditLine.address);

            const borrowerSharesBeforeRepay = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);

            const lenderSharesBeforeRepay = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
            await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, true);

            const borrowerSharesAfterRepay = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);

            const lenderSharesAfterRepay = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
            expectApproxEqual(borrowerSharesBeforeRepay.sub(borrowerSharesAfterRepay), amountToRepay, 0);
            expectApproxEqual(lenderSharesAfterRepay.sub(lenderSharesBeforeRepay), amountToRepay, 0);
        });

        it('Repay from savings account with shares being deducted from 2 strategies', async () => {
            let borrowDecimals = await BorrowAsset.decimals();
            let amountToRepay = BigNumber.from(5).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
            await BorrowAsset.connect(borrower).approve(env.yields.noYield.address, amountToRepay.div(2));
            await BorrowAsset.connect(borrower).approve(env.yields.compoundYield.address, amountToRepay.div(2));
            await savingsAccount
                .connect(borrower)
                .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.noYield.address, borrower.address);

            await savingsAccount
                .connect(borrower)
                .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.compoundYield.address, borrower.address);
            await savingsAccount.connect(borrower).approve(amountToRepay, BorrowAsset.address, creditLine.address);

            let creditLineAllowanceBefore = await savingsAccount
                .connect(borrower)
                .allowance(lender.address, BorrowAsset.address, creditLine.address);

            let borrowerSharesInNoYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
            let lenderSharesInNoYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

            let borrowerSharesInNoCompoundYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
            let lenderSharesInCompoundYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

            await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, true);
            let borrowerSharesInNoYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
            let lenderSharesInNoYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

            let borrowerSharesInCompoundYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
            let lenderSharesInCompoundYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

            let creditLineAllowanceAfter = await savingsAccount
                .connect(borrower)
                .allowance(lender.address, BorrowAsset.address, creditLine.address);

            expectApproxEqual(
                borrowerSharesInNoYieldBefore.sub(borrowerSharesInNoYieldAfter),
                lenderSharesInNoYieldAfter.sub(lenderSharesInNoYieldBefore),
                0
            );
            expectApproxEqual(
                borrowerSharesInNoCompoundYieldBefore.sub(borrowerSharesInCompoundYieldAfter),
                lenderSharesInCompoundYieldAfter.sub(lenderSharesInCompoundYieldBefore),
                0
            );

            console.log({
                creditLineAllowanceBefore: creditLineAllowanceBefore.toString(),
                creditLineAllowanceAfter: creditLineAllowanceAfter.toString(),
            });
        });

        it('Repay total amounts from savings account with shares being deducted from 2 strategies', async () => {
            let borrowDecimals = await BorrowAsset.decimals();
            let amountToRepay = BigNumber.from(120).mul(BigNumber.from(10).pow(borrowDecimals)); // 120 units of borrow tokens
            await BorrowAsset.connect(borrower).approve(env.yields.noYield.address, amountToRepay.div(2));
            await BorrowAsset.connect(borrower).approve(env.yields.compoundYield.address, amountToRepay.div(2));
            await savingsAccount
                .connect(borrower)
                .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.noYield.address, borrower.address);

            await savingsAccount
                .connect(borrower)
                .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.compoundYield.address, borrower.address);
            await savingsAccount.connect(borrower).approve(amountToRepay, BorrowAsset.address, creditLine.address);

            let creditLineAllowanceBefore = await savingsAccount
                .connect(borrower)
                .allowance(lender.address, BorrowAsset.address, creditLine.address);

            let borrowerSharesInNoYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
            let lenderSharesInNoYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

            let borrowerSharesInNoCompoundYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
            let lenderSharesInCompoundYieldBefore = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

            await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, true);
            let borrowerSharesInNoYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
            let lenderSharesInNoYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

            let borrowerSharesInCompoundYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
            let lenderSharesInCompoundYieldAfter = await savingsAccount
                .connect(borrower)
                .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

            let creditLineAllowanceAfter = await savingsAccount
                .connect(borrower)
                .allowance(lender.address, BorrowAsset.address, creditLine.address);

            expectApproxEqual(
                borrowerSharesInNoYieldBefore.sub(borrowerSharesInNoYieldAfter),
                lenderSharesInNoYieldAfter.sub(lenderSharesInNoYieldBefore),
                0
            );
            expectApproxEqual(
                borrowerSharesInNoCompoundYieldBefore.sub(borrowerSharesInCompoundYieldAfter),
                lenderSharesInCompoundYieldAfter.sub(lenderSharesInCompoundYieldBefore),
                0
            );

            console.log({
                creditLineAllowanceBefore: creditLineAllowanceBefore.toString(),
                creditLineAllowanceAfter: creditLineAllowanceAfter.toString(),
            });
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
