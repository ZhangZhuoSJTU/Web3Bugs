import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect, assert } from 'chai';

import {
    aaveYieldParams,
    depositValueToTest,
    zeroAddress,
    Binance7 as binance7,
    WhaleAccount as whaleAccount,
    DAI_Yearn_Protocol_Address,
    testPoolFactoryParams,
    createPoolParams,
    ChainLinkAggregators,
    repaymentParams,
    extensionParams,
    verificationParams,
} from '../../utils/constants';

import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { getPoolAddress, getRandomFromArray } from '../../utils/helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';
import { Address } from 'hardhat-deploy/dist/types';
import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { Pool } from '../../typechain/Pool';
import { Verification } from '../../typechain/Verification';
import { PoolFactory } from '../../typechain/PoolFactory';
import { ERC20 } from '../../typechain/ERC20';
import { PriceOracle } from '../../typechain/PriceOracle';
import { Extension } from '../../typechain/Extension';

import { Contracts } from '../../existingContracts/compound.json';
import { sha256 } from '@ethersproject/sha2';
import { Repayments } from '../../typechain/Repayments';
import { ContractTransaction } from '@ethersproject/contracts';
import { getContractAddress } from '@ethersproject/address';
import { IYield } from '../../typechain/IYield';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { NoYield } from '@typechain/NoYield';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

describe('Pool Borrow Withdrawal stage', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let mockCreditLines: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let lender1: SignerWithAddress;
    let random: SignerWithAddress;

    let extenstion: Extension;
    let poolImpl: Pool;
    let poolFactory: PoolFactory;
    let repaymentImpl: Repayments;

    let aaveYield: AaveYield;
    let yearnYield: YearnYield;
    let compoundYield: CompoundYield;
    let noYield: NoYield;

    let BatTokenContract: ERC20;
    let LinkTokenContract: ERC20;
    let DaiTokenContract: ERC20;

    let verification: Verification;
    let adminVerifier: AdminVerifier;
    let priceOracle: PriceOracle;

    let Binance7: any;
    let WhaleAccount: any;
    let protocolFeeCollector: any;

    const scaler = BigNumber.from('10').pow(30);

    before(async () => {
        [proxyAdmin, admin, mockCreditLines, borrower, lender, lender1, random, protocolFeeCollector] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        //initialize
        savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLines.address);
        strategyRegistry.initialize(admin.address, 10);

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAccount],
        });

        await admin.sendTransaction({
            to: whaleAccount,
            value: ethers.utils.parseEther('100'),
        });

        Binance7 = await ethers.provider.getSigner(binance7);
        WhaleAccount = await ethers.provider.getSigner(whaleAccount);

        BatTokenContract = await deployHelper.mock.getMockERC20(Contracts.BAT);
        await BatTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 BAT tokens

        LinkTokenContract = await deployHelper.mock.getMockERC20(Contracts.LINK);
        await LinkTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 LINK tokens

        DaiTokenContract = await deployHelper.mock.getMockERC20(Contracts.DAI);
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 DAI

        aaveYield = await deployHelper.core.deployAaveYield();
        await aaveYield
            .connect(admin)
            .initialize(
                admin.address,
                savingsAccount.address,
                aaveYieldParams._wethGateway,
                aaveYieldParams._protocolDataProvider,
                aaveYieldParams._lendingPoolAddressesProvider
            );

        await strategyRegistry.connect(admin).addStrategy(aaveYield.address);

        yearnYield = await deployHelper.core.deployYearnYield();
        await yearnYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(yearnYield.address);
        await yearnYield.connect(admin).updateProtocolAddresses(DaiTokenContract.address, DAI_Yearn_Protocol_Address);

        compoundYield = await deployHelper.core.deployCompoundYield();
        await compoundYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);

        noYield = await deployHelper.core.deployNoYield();
        await noYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(noYield.address);

        verification = await deployHelper.helper.deployVerification();
        await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
        adminVerifier = await deployHelper.helper.deployAdminVerifier();
        await verification.connect(admin).addVerifier(adminVerifier.address);
        await adminVerifier.connect(admin).initialize(admin.address, verification.address);
        await adminVerifier.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')), true);

        priceOracle = await deployHelper.helper.deployPriceOracle();
        await priceOracle.connect(admin).initialize(admin.address);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.DAI, ChainLinkAggregators['DAI/USD']);

        poolFactory = await deployHelper.pool.deployPoolFactory();
        extenstion = await deployHelper.pool.deployExtenstion();
        await extenstion.connect(admin).initialize(poolFactory.address, extensionParams.votingPassRatio);
        let {
            _collectionPeriod,
            _marginCallDuration,
            _minborrowFraction,
            _gracePeriodPenaltyFraction,
            _liquidatorRewardFraction,
            _loanWithdrawalDuration,
            _poolCancelPenalityFraction,
            _protocolFeeFraction,
        } = testPoolFactoryParams;
        await poolFactory
            .connect(admin)
            .initialize(
                admin.address,
                _collectionPeriod,
                _loanWithdrawalDuration,
                _marginCallDuration,
                getPoolInitSigHash(),
                _liquidatorRewardFraction,
                _poolCancelPenalityFraction,
                _minborrowFraction,
                _protocolFeeFraction,
                protocolFeeCollector.address,
                noYield.address
            );
        await poolFactory.connect(admin).updateSupportedBorrowTokens(Contracts.LINK, true);

        await poolFactory.connect(admin).updateSupportedCollateralTokens(Contracts.DAI, true);

        poolImpl = await deployHelper.pool.deployPool();
        repaymentImpl = await deployHelper.pool.deployRepayments();

        await repaymentImpl
            .connect(admin)
            .initialize(poolFactory.address, repaymentParams.gracePenalityRate, repaymentParams.gracePeriodFraction);

        await poolFactory
            .connect(admin)
            .setImplementations(
                poolImpl.address,
                repaymentImpl.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address,
                extenstion.address
            );
    });

    describe('Pool that borrows ERC20 with ERC20 as collateral', async () => {
        let pool: Pool;
        let collateralToken: ERC20;
        let borrowToken: ERC20;
        let amount: BigNumber;

        describe('Amount lent < minBorrowAmount at the end of collection period', async () => {
            let poolStrategy: IYield;
            beforeEach(async () => {
                let deployHelper: DeployHelper = new DeployHelper(borrower);
                collateralToken = await deployHelper.mock.getMockERC20(Contracts.DAI);

                borrowToken = await deployHelper.mock.getMockERC20(Contracts.LINK);
                poolStrategy = await deployHelper.mock.getYield(compoundYield.address);

                const salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));

                let generatedPoolAddress: Address = await getPoolAddress(
                    borrower.address,
                    Contracts.LINK,
                    Contracts.DAI,
                    poolStrategy.address,
                    poolFactory.address,
                    salt,
                    poolImpl.address,
                    false,
                    {}
                );

                let { _poolSize, _collateralRatio, _borrowRate, _repaymentInterval, _noOfRepaymentIntervals, _collateralAmount } =
                    createPoolParams;
                await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount); // Transfer quantity to borrower

                await collateralToken.connect(borrower).approve(generatedPoolAddress, _collateralAmount);

                await poolFactory
                    .connect(borrower)
                    .createPool(
                        _poolSize,
                        _borrowRate,
                        Contracts.LINK,
                        Contracts.DAI,
                        _collateralRatio,
                        _repaymentInterval,
                        _noOfRepaymentIntervals,
                        poolStrategy.address,
                        _collateralAmount,
                        false,
                        salt,
                        adminVerifier.address,
                        zeroAddress
                    );

                pool = await deployHelper.pool.getPool(generatedPoolAddress);

                amount = createPoolParams._poolSize.mul(testPoolFactoryParams._minborrowFraction).div(scaler).sub(10);
                await borrowToken.connect(admin).transfer(lender.address, amount);
                await borrowToken.connect(lender).approve(pool.address, amount);
                await pool.connect(lender).lend(lender.address, amount, zeroAddress);

                const { loanStartTime } = await pool.poolConstants();
                await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
            });

            it('Lender pool tokens should be transferrable', async () => {
                const balance = await pool.balanceOf(lender.address);
                const balanceBefore = await pool.balanceOf(lender1.address);
                await pool.connect(lender).transfer(lender1.address, balance);
                const balanceAfter = await pool.balanceOf(lender1.address);
                assert(balanceBefore.add(balance).toString() == balanceAfter.toString(), 'Pool token transfer not working');
                const balanceSenderAfter = await pool.balanceOf(lender.address);
                assert(
                    balanceSenderAfter.toString() == '0',
                    `Pool token not getting transferred correctly. Expected: 0, actual: ${balanceSenderAfter.toString()}`
                );
            });

            it('Lender cannot withdraw tokens', async () => {
                await expect(pool.connect(lender).withdrawLiquidity()).to.revertedWith('WL1');
            });

            it("Borrower can't withdraw", async () => {
                await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.revertedWith('');
            });

            it('Borrower can cancel pool without penality', async () => {
                const collateralBalanceBorrowerSavings = await savingsAccount.balanceInShares(
                    borrower.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalancePoolSavings = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const { baseLiquidityShares } = await pool.poolVariables();
                await pool.connect(borrower).cancelPool();
                const collateralBalanceBorrowerSavingsAfter = await savingsAccount.balanceInShares(
                    borrower.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalancePoolSavingsAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                assert(
                    collateralBalanceBorrowerSavingsAfter.sub(collateralBalanceBorrowerSavings).toString() ==
                        baseLiquidityShares.sub(1).toString(),
                    `Borrower didn't receive collateral back correctly Actual: ${collateralBalanceBorrowerSavingsAfter
                        .sub(collateralBalanceBorrowerSavings)
                        .toString()}, Expected: ${baseLiquidityShares.toString()}`
                );
                assert(
                    collateralBalancePoolSavings.sub(collateralBalancePoolSavingsAfter).toString() == baseLiquidityShares.sub(1).toString(),
                    `Pool shares didn't decrease correctly Actual: ${collateralBalancePoolSavings
                        .sub(collateralBalancePoolSavingsAfter)
                        .toString()} Expected: ${baseLiquidityShares.toString()}`
                );
            });
        });

        describe('Amount lent > minBorrowAmount at the end of collection period', async () => {
            let poolStrategy: IYield;
            beforeEach(async () => {
                let deployHelper: DeployHelper = new DeployHelper(borrower);
                collateralToken = await deployHelper.mock.getMockERC20(Contracts.DAI);

                borrowToken = await deployHelper.mock.getMockERC20(Contracts.LINK);
                poolStrategy = await deployHelper.mock.getYield(compoundYield.address);

                const salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));

                let generatedPoolAddress: Address = await getPoolAddress(
                    borrower.address,
                    Contracts.LINK,
                    Contracts.DAI,
                    poolStrategy.address,
                    poolFactory.address,
                    salt,
                    poolImpl.address,
                    false,
                    {}
                );

                let { _poolSize, _collateralRatio, _borrowRate, _repaymentInterval, _noOfRepaymentIntervals, _collateralAmount } =
                    createPoolParams;

                await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount); // Transfer quantity to borrower

                await collateralToken.connect(borrower).approve(generatedPoolAddress, _collateralAmount);

                await expect(
                    poolFactory
                        .connect(borrower)
                        .createPool(
                            _poolSize,
                            _borrowRate,
                            Contracts.LINK,
                            Contracts.DAI,
                            _collateralRatio,
                            _repaymentInterval,
                            _noOfRepaymentIntervals,
                            poolStrategy.address,
                            _collateralAmount,
                            false,
                            salt,
                            adminVerifier.address,
                            zeroAddress
                        )
                )
                    .to.emit(poolFactory, 'PoolCreated')
                    .withArgs(generatedPoolAddress, borrower.address);

                pool = await deployHelper.pool.getPool(generatedPoolAddress);

                amount = createPoolParams._poolSize.mul(testPoolFactoryParams._minborrowFraction).div(scaler).add(10);
                await borrowToken.connect(admin).transfer(lender.address, amount);
                await borrowToken.connect(lender).approve(pool.address, amount);
                await pool.connect(lender).lend(lender.address, amount, zeroAddress);

                const { loanStartTime } = await pool.poolConstants();
                await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
            });

            it('Lender pool tokens should be transferrable', async () => {
                const balance = await pool.balanceOf(lender.address);
                const balanceBefore = await pool.balanceOf(lender1.address);
                await pool.connect(lender).transfer(lender1.address, balance);
                const balanceAfter = await pool.balanceOf(lender1.address);
                assert(balanceBefore.add(balance).toString() == balanceAfter.toString(), 'Pool token transfer not working');
                const balanceSenderAfter = await pool.balanceOf(lender.address);
                assert(
                    balanceSenderAfter.toString() == '0',
                    `Pool token not getting transferred correctly. Expected: 0, actual: ${balanceSenderAfter.toString()}`
                );
            });

            it('Lender cannot withdraw tokens', async () => {
                await expect(pool.connect(lender).withdrawLiquidity()).to.revertedWith('WL1');
            });

            it('Borrower can withdraw', async () => {
                const borrowAssetBalanceBorrower = await borrowToken.balanceOf(borrower.address);
                const borrowAssetBalancePool = await borrowToken.balanceOf(pool.address);
                const borrowAssetBalancePoolSavings = await savingsAccount.balanceInShares(pool.address, borrowToken.address, zeroAddress);
                const tokensLent = await pool.totalSupply();
                await pool.connect(borrower).withdrawBorrowedAmount();
                const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
                const borrowAssetBalancePoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowAssetBalancePoolSavingsAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    borrowToken.address,
                    zeroAddress
                );
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
                assert(
                    borrowAssetBalancePoolSavings.toString() == borrowAssetBalancePoolSavingsAfter.toString(),
                    `Savings account changing instead of token balance`
                );
            });

            it('Borrower can cancel pool with penality before withdrawing', async () => {
                const collateralBalanceBorrowerSavings = await savingsAccount.balanceInShares(
                    borrower.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalancePoolSavings = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const { baseLiquidityShares } = await pool.poolVariables();
                await expect(pool.connect(lender).cancelPool()).to.revertedWith('CP2');
                const tx = await pool.connect(borrower).cancelPool();

                let blockTime = 0;
                if (tx.blockNumber) {
                    blockTime = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
                }
                const loanStartTime = (await pool.poolConstants()).loanStartTime;
                let extraPenalityTime = 0;
                if (loanStartTime.lt(blockTime)) {
                    extraPenalityTime = BigNumber.from(blockTime).sub(loanStartTime).toNumber();
                }

                const penality = baseLiquidityShares
                    .mul(testPoolFactoryParams._poolCancelPenalityFraction)
                    .mul(createPoolParams._borrowRate)
                    .mul(createPoolParams._repaymentInterval.add(extraPenalityTime))
                    .div(365 * 24 * 60 * 60)
                    .div(BigNumber.from(10).pow(60));

                const collateralBalanceBorrowerSavingsAfter = await savingsAccount.balanceInShares(
                    borrower.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalancePoolSavingsAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralAfterPenality = baseLiquidityShares.sub(penality);
                assert(
                    collateralBalanceBorrowerSavingsAfter.sub(collateralBalanceBorrowerSavings).toString() ==
                        collateralAfterPenality.sub(1).toString(),
                    `Borrower didn't receive collateral back correctly Actual: ${collateralBalanceBorrowerSavingsAfter
                        .sub(collateralBalanceBorrowerSavings)
                        .toString()}, Expected: ${baseLiquidityShares.toString()}`
                );
                assert(
                    collateralBalancePoolSavings.sub(collateralBalancePoolSavingsAfter).toString() ==
                        collateralAfterPenality.sub(1).toString(),
                    `Pool shares didn't decrease correctly Actual: ${collateralBalancePoolSavings
                        .sub(collateralBalancePoolSavingsAfter)
                        .toString()} Expected: ${baseLiquidityShares.toString()}`
                );
            });

            it('Borrower cannot cancel pool twice', async () => {
                await pool.connect(borrower).cancelPool();
                await expect(pool.connect(borrower).cancelPool()).to.revertedWith('CP1');
            });

            it('Pool tokens are not transferrable after pool cancel', async () => {
                await pool.connect(borrower).cancelPool();
                const balance = await pool.balanceOf(lender.address);
                await expect(pool.connect(lender).transfer(lender1.address, balance)).to.be.revertedWith('TT1');
            });

            it('Once pool is cancelled anyone can liquidate penality, direct penality withdrawal', async () => {
                await pool.connect(borrower).cancelPool();
                const collateralTokensRandom = await collateralToken.balanceOf(random.address);
                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                let collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(2),
                    collateralToken.address
                );
                let borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                const borrowTokenRandom = await borrowToken.balanceOf(random.address);
                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                await pool.connect(random).liquidateCancelPenalty(false, false);
                collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(2),
                    collateralToken.address
                );
                borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );

                const collateralTokensRandomAfter = await collateralToken.balanceOf(random.address);
                const collateralSharesPoolAfter = await await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralTokensPoolAfter = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPoolAfter.sub(2),
                    collateralToken.address
                );
                const borrowTokenRandomAfter = await borrowToken.balanceOf(random.address);
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);
                assert(
                    collateralTokensRandomAfter.sub(collateralTokensRandom).toString() == collateralTokensPool.toString(),
                    `Collateral tokens not correctly received by liquidator Actual: ${collateralTokensRandomAfter
                        .sub(collateralTokensRandom)
                        .toString()} Expected: ${collateralTokensPool.toString()}`
                );
                assert(
                    collateralTokensPool.sub(collateralTokensPoolAfter).toString() == collateralTokensPool.toString(),
                    `Collateral tokens not correctly taken from pool Actual: ${collateralTokensPool
                        .sub(collateralTokensPoolAfter)
                        .toString()} Expected: ${collateralTokensPool.toString()}`
                );
                collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(1),
                    collateralToken.address
                );
                borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                const borrowTokensToDeposit = borrowTokensForCollateral.sub(
                    borrowTokensForCollateral.mul(testPoolFactoryParams._liquidatorRewardFraction).div(BigNumber.from(10).pow(30))
                );

                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.gte(borrowTokensToDeposit.sub(500));
                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.lte(borrowTokensToDeposit.add(500));
                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.gte(borrowTokensToDeposit.sub(500));
                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.lte(borrowTokensToDeposit.add(500));
            });

            it('Once pool is cancelled anyone can liquidate penality, penality direct LP share', async () => {
                await pool.connect(borrower).cancelPool();
                let deployHelper: DeployHelper = new DeployHelper(borrower);
                const yToken: ERC20 = await deployHelper.mock.getMockERC20(await poolStrategy.liquidityToken(collateralToken.address));
                const collateralSharesRandom = await yToken.balanceOf(random.address);
                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                let collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(collateralSharesPool, collateralToken.address);
                let borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                const borrowTokenRandom = await borrowToken.balanceOf(random.address);
                const borrowTokenPool = await borrowToken.balanceOf(pool.address);

                await pool.connect(random).liquidateCancelPenalty(false, true);

                const collateralSharesRandomAfter = await yToken.balanceOf(random.address);
                const collateralSharesPoolAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const borrowTokenRandomAfter = await borrowToken.balanceOf(random.address);
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);

                assert(
                    collateralSharesRandomAfter.sub(collateralSharesRandom).toString() == collateralSharesPool.sub(2).toString(),
                    `Collateral shares not correctly received by liquidator. Actual: ${collateralSharesRandomAfter
                        .sub(collateralSharesRandom)
                        .toString()} Expected: ${collateralSharesPool.toString()}`
                );
                assert(
                    collateralSharesPool.sub(collateralSharesPoolAfter).toString() == collateralSharesPool.sub(2).toString(),
                    `Collateral tokens not correctly taken from pool`
                );
                collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(1),
                    collateralToken.address
                );
                borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                const borrowTokensToDeposit = borrowTokensForCollateral.sub(
                    borrowTokensForCollateral.mul(testPoolFactoryParams._liquidatorRewardFraction).div(BigNumber.from(10).pow(30))
                );

                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.gte(borrowTokensToDeposit.sub(10));

                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.lte(borrowTokensToDeposit.add(10));

                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.gte(borrowTokensToDeposit.sub(10));

                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.lte(borrowTokensToDeposit.add(10));
            });

            // Note: _receiveLiquidityShares doesn't matter when sending to savings account
            it('Once pool is cancelled anyone can liquidate penality, penality to savings', async () => {
                await pool.connect(borrower).cancelPool();
                const collateralSavingsRandom = await savingsAccount.balanceInShares(
                    random.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                let collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(collateralSharesPool, collateralToken.address);
                let borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                const borrowTokenRandom = await borrowToken.balanceOf(random.address);
                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                await pool.connect(random).liquidateCancelPenalty(true, true);

                const collateralSavingsRandomAfter = await savingsAccount.balanceInShares(
                    random.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralSharesPoolAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralTokensPoolAfter = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPoolAfter,
                    collateralToken.address
                );
                const borrowTokenRandomAfter = await borrowToken.balanceOf(random.address);
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);

                assert(
                    collateralSavingsRandomAfter.sub(collateralSavingsRandom).toString() == collateralSharesPool.sub(2).toString(),
                    `Collateral not correctly received by liquidator in savings account. Actual: ${collateralSavingsRandomAfter
                        .sub(collateralSavingsRandom)
                        .toString()} Expected: ${collateralSharesPool.toString()}`
                );
                assert(
                    collateralSharesPool.sub(collateralSharesPoolAfter).toString() == collateralSharesPool.sub(2).toString(),
                    `Collateral tokens not correctly taken from pool`
                );
                collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(1),
                    collateralToken.address
                );
                borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                const borrowTokensToDeposit = borrowTokensForCollateral.sub(
                    borrowTokensForCollateral.mul(testPoolFactoryParams._liquidatorRewardFraction).div(BigNumber.from(10).pow(30))
                );

                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.gte(borrowTokensToDeposit.sub(500));
                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.lte(borrowTokensToDeposit.add(500));

                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.gte(borrowTokensToDeposit.sub(500));
                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.lte(borrowTokensToDeposit.add(500));
            });

            it('Pool cancellation once liquidated cannot be liquidated again', async () => {
                await pool.connect(borrower).cancelPool();
                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool,
                    collateralToken.address
                );
                const borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                await pool.connect(random).liquidateCancelPenalty(false, false);
                await expect(pool.connect(random).liquidateCancelPenalty(false, false)).to.be.revertedWith('');
            });

            it("Lender who withdraws lent amount before pool cancel penality doesn't get share of cancel penality", async () => {
                await pool.connect(borrower).cancelPool();

                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                const borrowTokenLender = await borrowToken.balanceOf(lender.address);
                const totalPoolTokens = await pool.totalSupply();
                const poolTokenLender = await pool.balanceOf(lender.address);
                await pool.connect(lender).withdrawLiquidity();
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowTokenLenderAfter = await borrowToken.balanceOf(lender.address);
                const totalPoolTokensAfter = await pool.totalSupply();
                const poolTokenLenderAfter = await pool.balanceOf(lender.address);

                assert(
                    borrowTokenPool.sub(borrowTokenPoolAfter).toString() == amount.toString(),
                    `Borrow tokens not correctly collected from pool. Actual: ${borrowTokenPool
                        .sub(borrowTokenPoolAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    borrowTokenLenderAfter.sub(borrowTokenLender).toString() == amount.toString(),
                    `Borrow tokens not correctly receoved by lender. Actual: ${borrowTokenLenderAfter
                        .sub(borrowTokenLender)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    totalPoolTokens.sub(totalPoolTokensAfter).toString() == amount.toString(),
                    `Total pool tokens not correctly managed. Actual: ${totalPoolTokens
                        .sub(totalPoolTokensAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    poolTokenLender.sub(poolTokenLenderAfter).toString() == amount.toString(),
                    `Pool tokens of lender not correctly burnt. Actual: ${poolTokenLender
                        .sub(poolTokenLenderAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
            });

            it('Lender who withdraws lent amount after pool cancel penality gets share of cancel penality', async () => {
                await pool.connect(borrower).cancelPool();
                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool,
                    collateralToken.address
                );
                const borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                await pool.connect(random).liquidateCancelPenalty(false, false);

                const { penaltyLiquidityAmount: penalityLiquidityAmount } = await pool.poolVariables();
                const lenderCancelBonus = penalityLiquidityAmount.mul(await pool.balanceOf(lender.address)).div(await pool.totalSupply());

                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                const borrowTokenLender = await borrowToken.balanceOf(lender.address);
                const totalPoolTokens = await pool.totalSupply();
                const poolTokenLender = await pool.balanceOf(lender.address);
                await pool.connect(lender).withdrawLiquidity();
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowTokenLenderAfter = await borrowToken.balanceOf(lender.address);
                const totalPoolTokensAfter = await pool.totalSupply();
                const poolTokenLenderAfter = await pool.balanceOf(lender.address);

                assert(
                    borrowTokenPool.sub(borrowTokenPoolAfter).toString() == amount.add(lenderCancelBonus).toString(),
                    `Borrow tokens not correctly collected from pool. Actual: ${borrowTokenPool
                        .sub(borrowTokenPoolAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    borrowTokenLenderAfter.sub(borrowTokenLender).toString() == amount.add(lenderCancelBonus).toString(),
                    `Borrow tokens not correctly receoved by lender. Actual: ${borrowTokenLenderAfter
                        .sub(borrowTokenLender)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    totalPoolTokens.sub(totalPoolTokensAfter).toString() == amount.toString(),
                    `Total pool tokens not correctly managed. Actual: ${totalPoolTokens
                        .sub(totalPoolTokensAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    poolTokenLender.sub(poolTokenLenderAfter).toString() == amount.toString(),
                    `Pool tokens of lender not correctly burnt. Actual: ${poolTokenLender
                        .sub(poolTokenLenderAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
            });

            it('Non withdrawal Cancel - anyone can cancel pool and penalize borrower', async () => {
                const { loanWithdrawalDeadline } = await pool.poolConstants();
                assert(loanWithdrawalDeadline.toString() != '0', `Loan withdrawal deadline not set`);
                await blockTravel(network, parseInt(loanWithdrawalDeadline.add(1).toString()));

                const collateralBalanceRandomSavings = await savingsAccount.balanceInShares(
                    random.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalanceRandom = await collateralToken.balanceOf(random.address);
                const collateralBalanceBorrowerSavings = await savingsAccount.balanceInShares(
                    borrower.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalancePoolSavings = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const { baseLiquidityShares } = await pool.poolVariables();
                const tx = await pool.connect(borrower).cancelPool();

                let blockTime = 0;
                if (tx.blockNumber) {
                    blockTime = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
                }
                const loanStartTime = (await pool.poolConstants()).loanStartTime;
                let extraPenalityTime = 0;
                if (loanStartTime.lt(blockTime)) {
                    let penalityEndTime = BigNumber.from(blockTime);
                    if (loanWithdrawalDeadline.lt(blockTime)) {
                        penalityEndTime = loanWithdrawalDeadline;
                    }
                    extraPenalityTime = penalityEndTime.sub(loanStartTime).toNumber();
                }

                const penality = baseLiquidityShares
                    .mul(testPoolFactoryParams._poolCancelPenalityFraction)
                    .mul(createPoolParams._borrowRate)
                    .mul(createPoolParams._repaymentInterval.add(extraPenalityTime))
                    .div(365 * 24 * 60 * 60)
                    .div(BigNumber.from(10).pow(60));
                const collateralBalanceBorrowerSavingsAfter = await savingsAccount.balanceInShares(
                    borrower.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalancePoolSavingsAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalanceRandomSavingsAfter = await savingsAccount.balanceInShares(
                    random.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralBalanceRandomAfter = await collateralToken.balanceOf(random.address);
                const collateralAfterPenality = baseLiquidityShares.sub(penality);
                assert(
                    collateralBalanceBorrowerSavingsAfter.sub(collateralBalanceBorrowerSavings).toString() ==
                        collateralAfterPenality.sub(1).toString(),
                    `Borrower didn't receive collateral back correctly Actual: ${collateralBalanceBorrowerSavingsAfter
                        .sub(collateralBalanceBorrowerSavings)
                        .toString()}, Expected: ${baseLiquidityShares.toString()}`
                );
                assert(
                    collateralBalancePoolSavings.sub(collateralBalancePoolSavingsAfter).toString() ==
                        collateralAfterPenality.sub(1).toString(),
                    `Pool shares didn't decrease correctly Actual: ${collateralBalancePoolSavings
                        .sub(collateralBalancePoolSavingsAfter)
                        .toString()} Expected: ${baseLiquidityShares.toString()}`
                );
                assert(
                    collateralBalanceRandomSavings.toString() == collateralBalanceRandomSavingsAfter.toString(),
                    "User who cancels shouldn't get collateral shares"
                );
                assert(
                    collateralBalanceRandom.toString() == collateralBalanceRandomAfter.toString(),
                    "User who cancels shouldn't get collateral tokens"
                );
            });

            it('Non withdrawal Cancel - Anyone can liquidate penality', async () => {
                const { loanWithdrawalDeadline } = await pool.poolConstants();
                assert(loanWithdrawalDeadline.toString() != '0', `Loan withdrawal deadline not set`);
                await blockTravel(network, parseInt(loanWithdrawalDeadline.add(1).toString()));

                await pool.connect(random).cancelPool();
                const collateralTokensRandom = await collateralToken.balanceOf(random.address);
                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                let collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(2),
                    collateralToken.address
                );
                let borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                const borrowTokenRandom = await borrowToken.balanceOf(random.address);
                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                await pool.connect(random).liquidateCancelPenalty(false, false);
                collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(2),
                    collateralToken.address
                );
                borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );

                const collateralTokensRandomAfter = await collateralToken.balanceOf(random.address);
                const collateralSharesPoolAfter = await await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralTokensPoolAfter = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPoolAfter.sub(2),
                    collateralToken.address
                );
                const borrowTokenRandomAfter = await borrowToken.balanceOf(random.address);
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);
                assert(
                    collateralTokensRandomAfter.sub(collateralTokensRandom).toString() == collateralTokensPool.toString(),
                    `Collateral tokens not correctly received by liquidator Actual: ${collateralTokensRandomAfter
                        .sub(collateralTokensRandom)
                        .toString()} Expected: ${collateralTokensPool.toString()}`
                );
                assert(
                    collateralTokensPool.sub(collateralTokensPoolAfter).toString() == collateralTokensPool.toString(),
                    `Collateral tokens not correctly taken from pool Actual: ${collateralTokensPool
                        .sub(collateralTokensPoolAfter)
                        .toString()} Expected: ${collateralTokensPool.toString()}`
                );
                collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool.sub(1),
                    collateralToken.address
                );
                borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                const borrowTokensToDeposit = borrowTokensForCollateral.sub(
                    borrowTokensForCollateral.mul(testPoolFactoryParams._liquidatorRewardFraction).div(BigNumber.from(10).pow(30))
                );
                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.gte(borrowTokensToDeposit.sub(500));
                expect(borrowTokenRandom.sub(borrowTokenRandomAfter)).to.be.lte(borrowTokensToDeposit.add(500));

                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.gte(borrowTokensToDeposit.sub(500));
                expect(borrowTokenPoolAfter.sub(borrowTokenPool)).to.be.lte(borrowTokensToDeposit.add(500));
            });

            it('Non withdrawal Cancel - Before penality Liquidation, no rewards for lender', async () => {
                const { loanWithdrawalDeadline } = await pool.poolConstants();
                assert(loanWithdrawalDeadline.toString() != '0', `Loan withdrawal deadline not set`);
                await blockTravel(network, parseInt(loanWithdrawalDeadline.add(1).toString()));

                await pool.connect(random).cancelPool();

                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                const borrowTokenLender = await borrowToken.balanceOf(lender.address);
                const totalPoolTokens = await pool.totalSupply();
                const poolTokenLender = await pool.balanceOf(lender.address);
                await pool.connect(lender).withdrawLiquidity();
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowTokenLenderAfter = await borrowToken.balanceOf(lender.address);
                const totalPoolTokensAfter = await pool.totalSupply();
                const poolTokenLenderAfter = await pool.balanceOf(lender.address);

                assert(
                    borrowTokenPool.sub(borrowTokenPoolAfter).toString() == amount.toString(),
                    `Borrow tokens not correctly collected from pool. Actual: ${borrowTokenPool
                        .sub(borrowTokenPoolAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    borrowTokenLenderAfter.sub(borrowTokenLender).toString() == amount.toString(),
                    `Borrow tokens not correctly receoved by lender. Actual: ${borrowTokenLenderAfter
                        .sub(borrowTokenLender)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    totalPoolTokens.sub(totalPoolTokensAfter).toString() == amount.toString(),
                    `Total pool tokens not correctly managed. Actual: ${totalPoolTokens
                        .sub(totalPoolTokensAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    poolTokenLender.sub(poolTokenLenderAfter).toString() == amount.toString(),
                    `Pool tokens of lender not correctly burnt. Actual: ${poolTokenLender
                        .sub(poolTokenLenderAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
            });

            it('Non withdrawal Cancel - After penality Liquidation, rewards for lender', async () => {
                const { loanWithdrawalDeadline } = await pool.poolConstants();
                assert(loanWithdrawalDeadline.toString() != '0', `Loan withdrawal deadline not set`);
                await blockTravel(network, parseInt(loanWithdrawalDeadline.add(1).toString()));

                await pool.connect(random).cancelPool();

                const collateralSharesPool = await savingsAccount.balanceInShares(
                    pool.address,
                    collateralToken.address,
                    poolStrategy.address
                );
                const collateralTokensPool = await poolStrategy.callStatic.getTokensForShares(
                    collateralSharesPool,
                    collateralToken.address
                );
                const borrowTokensForCollateral = await pool.getEquivalentTokens(
                    collateralToken.address,
                    borrowToken.address,
                    collateralTokensPool
                );
                await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                await pool.connect(random).liquidateCancelPenalty(false, false);

                const { penaltyLiquidityAmount } = await pool.poolVariables();
                const lenderCancelBonus = penaltyLiquidityAmount.mul(await pool.balanceOf(lender.address)).div(await pool.totalSupply());

                const borrowTokenPool = await borrowToken.balanceOf(pool.address);
                const borrowTokenLender = await borrowToken.balanceOf(lender.address);
                const totalPoolTokens = await pool.totalSupply();
                const poolTokenLender = await pool.balanceOf(lender.address);
                await pool.connect(lender).withdrawLiquidity();
                const borrowTokenPoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowTokenLenderAfter = await borrowToken.balanceOf(lender.address);
                const totalPoolTokensAfter = await pool.totalSupply();
                const poolTokenLenderAfter = await pool.balanceOf(lender.address);

                assert(
                    borrowTokenPool.sub(borrowTokenPoolAfter).toString() == amount.add(lenderCancelBonus).toString(),
                    `Borrow tokens not correctly collected from pool. Actual: ${borrowTokenPool
                        .sub(borrowTokenPoolAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    borrowTokenLenderAfter.sub(borrowTokenLender).toString() == amount.add(lenderCancelBonus).toString(),
                    `Borrow tokens not correctly receoved by lender. Actual: ${borrowTokenLenderAfter
                        .sub(borrowTokenLender)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    totalPoolTokens.sub(totalPoolTokensAfter).toString() == amount.toString(),
                    `Total pool tokens not correctly managed. Actual: ${totalPoolTokens
                        .sub(totalPoolTokensAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
                assert(
                    poolTokenLender.sub(poolTokenLenderAfter).toString() == amount.toString(),
                    `Pool tokens of lender not correctly burnt. Actual: ${poolTokenLender
                        .sub(poolTokenLenderAfter)
                        .toString()} Expected: ${amount.toString()}`
                );
            });
        });

        describe('Amount lent == minBorrowAmount at the end of collection period', async () => {
            let poolStrategy: IYield;
            beforeEach(async () => {
                let deployHelper: DeployHelper = new DeployHelper(borrower);
                collateralToken = await deployHelper.mock.getMockERC20(Contracts.DAI);

                borrowToken = await deployHelper.mock.getMockERC20(Contracts.LINK);
                poolStrategy = await deployHelper.mock.getYield(compoundYield.address);

                const salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));

                let generatedPoolAddress: Address = await getPoolAddress(
                    borrower.address,
                    Contracts.LINK,
                    Contracts.DAI,
                    poolStrategy.address,
                    poolFactory.address,
                    salt,
                    poolImpl.address,
                    false,
                    {}
                );

                let { _poolSize, _collateralRatio, _borrowRate, _repaymentInterval, _noOfRepaymentIntervals, _collateralAmount } =
                    createPoolParams;

                await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount); // Transfer quantity to borrower

                await collateralToken.connect(borrower).approve(generatedPoolAddress, _collateralAmount);

                await expect(
                    poolFactory
                        .connect(borrower)
                        .createPool(
                            _poolSize,
                            _borrowRate,
                            Contracts.LINK,
                            Contracts.DAI,
                            _collateralRatio,
                            _repaymentInterval,
                            _noOfRepaymentIntervals,
                            poolStrategy.address,
                            _collateralAmount,
                            false,
                            salt,
                            adminVerifier.address,
                            zeroAddress
                        )
                )
                    .to.emit(poolFactory, 'PoolCreated')
                    .withArgs(generatedPoolAddress, borrower.address);

                pool = await deployHelper.pool.getPool(generatedPoolAddress);

                const amount = createPoolParams._poolSize.mul(testPoolFactoryParams._minborrowFraction).div(scaler);
                await borrowToken.connect(admin).transfer(lender.address, amount);
                await borrowToken.connect(lender).approve(pool.address, amount);
                await pool.connect(lender).lend(lender.address, amount, zeroAddress);

                const { loanStartTime } = await pool.poolConstants();
                await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
            });

            it('Lender pool tokens should be transferrable', async () => {
                const balance = await pool.balanceOf(lender.address);
                const balanceBefore = await pool.balanceOf(lender1.address);
                await pool.connect(lender).transfer(lender1.address, balance);
                const balanceAfter = await pool.balanceOf(lender1.address);
                assert(balanceBefore.add(balance).toString() == balanceAfter.toString(), 'Pool token transfer not working');
                const balanceSenderAfter = await pool.balanceOf(lender.address);
                assert(
                    balanceSenderAfter.toString() == '0',
                    `Pool token not getting transferred correctly. Expected: 0, actual: ${balanceSenderAfter.toString()}`
                );
            });

            it('Lender cannot withdraw tokens', async () => {
                await expect(pool.connect(lender).withdrawLiquidity()).to.revertedWith('WL1');
            });

            it('Borrower can withdraw', async () => {
                const borrowAssetBalanceBorrower = await borrowToken.balanceOf(borrower.address);
                const borrowAssetBalancePool = await borrowToken.balanceOf(pool.address);
                const borrowAssetBalancePoolSavings = await savingsAccount.balanceInShares(pool.address, borrowToken.address, zeroAddress);
                const tokensLent = await pool.totalSupply();
                await pool.connect(borrower).withdrawBorrowedAmount();
                const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
                const borrowAssetBalancePoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowAssetBalancePoolSavingsAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    borrowToken.address,
                    zeroAddress
                );
                const tokensLentAfter = await pool.totalSupply();
                const protocolFee = tokensLent.mul(testPoolFactoryParams._protocolFeeFraction).div(scaler);

                assert(tokensLent.toString() == tokensLentAfter.toString(), 'Tokens lent changing while withdrawing borrowed amount');
                assert(
                    tokensLent.toString() ==
                        createPoolParams._poolSize.mul(testPoolFactoryParams._minborrowFraction).div(scaler).toString(),
                    'TokensLent is not same as minBorrowAmount'
                );
                assert(
                    borrowAssetBalanceBorrower.add(tokensLent).sub(protocolFee).toString() == borrowAssetBalanceBorrowerAfter.toString(),
                    'Borrower not receiving correct lent amount'
                );
                assert(
                    borrowAssetBalancePool.toString() == borrowAssetBalancePoolAfter.add(tokensLentAfter).toString(),
                    'Pool token balance is changing instead of savings account balance'
                );
                assert(
                    borrowAssetBalancePoolSavings.toString() == borrowAssetBalancePoolSavingsAfter.toString(),
                    'Savings account balance of pool not changing correctly'
                );
            });
        });

        describe('Amount lent == amountRequested at the end of collection period', async () => {
            let poolStrategy: IYield;
            beforeEach(async () => {
                let deployHelper: DeployHelper = new DeployHelper(borrower);
                collateralToken = await deployHelper.mock.getMockERC20(Contracts.DAI);

                borrowToken = await deployHelper.mock.getMockERC20(Contracts.LINK);
                poolStrategy = await deployHelper.mock.getYield(compoundYield.address);

                const salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));

                let generatedPoolAddress: Address = await getPoolAddress(
                    borrower.address,
                    Contracts.LINK,
                    Contracts.DAI,
                    poolStrategy.address,
                    poolFactory.address,
                    salt,
                    poolImpl.address,
                    false,
                    {}
                );

                let { _poolSize, _collateralRatio, _borrowRate, _repaymentInterval, _noOfRepaymentIntervals, _collateralAmount } =
                    createPoolParams;

                await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount); // Transfer quantity to borrower

                await collateralToken.connect(borrower).approve(generatedPoolAddress, _collateralAmount);

                await expect(
                    poolFactory
                        .connect(borrower)
                        .createPool(
                            _poolSize,
                            _borrowRate,
                            Contracts.LINK,
                            Contracts.DAI,
                            _collateralRatio,
                            _repaymentInterval,
                            _noOfRepaymentIntervals,
                            poolStrategy.address,
                            _collateralAmount,
                            false,
                            salt,
                            adminVerifier.address,
                            zeroAddress
                        )
                )
                    .to.emit(poolFactory, 'PoolCreated')
                    .withArgs(generatedPoolAddress, borrower.address);

                pool = await deployHelper.pool.getPool(generatedPoolAddress);

                const amount = createPoolParams._borrowAmountRequested;
                await borrowToken.connect(admin).transfer(lender.address, amount);
                await borrowToken.connect(lender).approve(pool.address, amount);
                await pool.connect(lender).lend(lender.address, amount, zeroAddress);
            });

            async function subject() {
                const { loanStartTime } = await pool.poolConstants();
                await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
                return;
            }

            it('Lender pool tokens should be transferrable', async () => {
                await subject();
                const balance = await pool.balanceOf(lender.address);
                const balanceBefore = await pool.balanceOf(lender1.address);
                await pool.connect(lender).transfer(lender1.address, balance);
                const balanceAfter = await pool.balanceOf(lender1.address);
                assert(balanceBefore.add(balance).toString() == balanceAfter.toString(), 'Pool token transfer not working');
                const balanceSenderAfter = await pool.balanceOf(lender.address);
                assert(
                    balanceSenderAfter.toString() == '0',
                    `Pool token not getting transferred correctly. Expected: 0, actual: ${balanceSenderAfter.toString()}`
                );
            });

            it('Lender cannot withdraw tokens', async () => {
                await subject();
                await expect(pool.connect(lender).withdrawLiquidity()).to.revertedWith('WL1');
            });

            it('Borrower can withdraw', async () => {
                const borrowAssetBalanceBorrower = await borrowToken.balanceOf(borrower.address);
                const borrowAssetBalancePool = await borrowToken.balanceOf(pool.address);
                const borrowAssetBalancePoolSavings = await savingsAccount.balanceInShares(pool.address, borrowToken.address, zeroAddress);
                const tokensLent = await pool.totalSupply();
                let amount = createPoolParams._poolSize.sub(tokensLent);

                await borrowToken.connect(admin).transfer(lender.address, amount);
                await borrowToken.connect(lender).approve(pool.address, amount);
                await pool.connect(lender).lend(lender.address, amount, zeroAddress);
                await subject();

                await pool.connect(borrower).withdrawBorrowedAmount();
                const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
                const borrowAssetBalancePoolAfter = await borrowToken.balanceOf(pool.address);
                const borrowAssetBalancePoolSavingsAfter = await savingsAccount.balanceInShares(
                    pool.address,
                    borrowToken.address,
                    zeroAddress
                );
                const tokensLentAfter = await pool.totalSupply();
                const protocolFee = createPoolParams._poolSize.mul(testPoolFactoryParams._protocolFeeFraction).div(scaler);

                assert(
                    createPoolParams._poolSize.sub(protocolFee).toString() ==
                        borrowAssetBalanceBorrowerAfter.sub(borrowAssetBalanceBorrower).toString(),
                    `Borrower not receiving correct lent amount Actual: ${borrowAssetBalanceBorrowerAfter
                        .sub(borrowAssetBalanceBorrower)
                        .toString()} Expected: ${createPoolParams._poolSize.sub(protocolFee).toString()}`
                );

                assert(
                    borrowAssetBalancePool.add(amount).toString() == borrowAssetBalancePoolAfter.add(tokensLentAfter).toString(),
                    'Pool token balance is changing instead of savings account balance'
                );
                assert(
                    borrowAssetBalancePoolSavings.toString() == borrowAssetBalancePoolSavingsAfter.toString(),
                    'Savings account balance of pool not changing correctly'
                );
            });
        });
    });
});
