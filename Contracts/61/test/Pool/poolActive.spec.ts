import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { assert, expect } from 'chai';

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

describe('Pool Active stage', async () => {
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

    const scaler: BigNumberish = BigNumber.from(10).pow(30);

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
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(24)); // 100,000 DAI

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
        let amount1: BigNumber;

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

                amount = createPoolParams._poolSize.mul(testPoolFactoryParams._minborrowFraction).div(scaler).add(100).mul(2).div(3);
                amount1 = createPoolParams._poolSize.mul(testPoolFactoryParams._minborrowFraction).div(scaler).add(100).div(3);
                // console.log({amount: amount.toString(), amount1: amount1.toString()});
                await borrowToken.connect(admin).transfer(lender.address, amount);
                await borrowToken.connect(lender).approve(pool.address, amount);
                await pool.connect(lender).lend(lender.address, amount, zeroAddress);

                await borrowToken.connect(admin).transfer(lender1.address, amount1);
                await borrowToken.connect(lender1).approve(pool.address, amount1);
                await pool.connect(lender1).lend(lender1.address, amount1, zeroAddress);

                const { loanStartTime } = await pool.poolConstants();
                await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
                await pool.connect(borrower).withdrawBorrowedAmount();
                const { loanStatus } = await pool.poolVariables();
                assert(loanStatus == 1, 'Loan is not active');
                await borrowToken.connect(admin).transfer(random.address, BigNumber.from(10).pow(21));
            });

            it('Lender tokens should be transferable', async () => {
                const lenderBal = await pool.balanceOf(lender.address);
                const randomBal = await pool.balanceOf(random.address);

                const transferAmount = lenderBal.div(2);
                await pool.connect(lender).transfer(random.address, transferAmount);

                const lenderBalAfter = await pool.balanceOf(lender.address);
                const randomBalAfter = await pool.balanceOf(random.address);

                assert(
                    lenderBal.sub(lenderBalAfter).toString() == transferAmount.toString(),
                    `lender tokens not correctly deducted from sender`
                );
                assert(
                    randomBalAfter.sub(randomBal).toString() == transferAmount.toString(),
                    `lender tokens not correctly received by receiver`
                );
            });

            it("Borrower can't withdraw again", async () => {
                await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.be.revertedWith('WBA1');
            });

            it('Pool cannot be cancelled by anyone', async () => {
                await expect(pool.connect(borrower).cancelPool()).to.be.revertedWith('CP1');

                await expect(pool.connect(lender).cancelPool()).to.be.revertedWith('CP1');

                await expect(pool.connect(random).cancelPool()).to.be.revertedWith('CP1');
            });

            context('Borrower should repay interest', async () => {
                it('Repay interest for first  repay period', async () => {
                    const repayAmount = createPoolParams._borrowRate
                        .mul(amount.add(amount1))
                        .mul(createPoolParams._repaymentInterval)
                        .div(60 * 60 * 24 * 365)
                        .div(scaler);
                    const interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
                    assert(
                        interestForCurrentPeriod.toString() == repayAmount.toString(),
                        `Incorrect interest for period 1. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
                    );
                    await borrowToken.connect(random).approve(repaymentImpl.address, repayAmount);
                    await repaymentImpl.connect(random).repay(pool.address, repayAmount);
                });

                it('Can repay for second repayment period in first repay period', async () => {
                    const repayAmount = createPoolParams._borrowRate
                        .mul(amount.add(amount1))
                        .mul(createPoolParams._repaymentInterval)
                        .div(60 * 60 * 24 * 365)
                        .div(scaler);

                    await borrowToken.connect(random).approve(repaymentImpl.address, repayAmount.add(10));
                    await repaymentImpl.connect(random).repay(pool.address, repayAmount.add(10));

                    // assert((await repaymentImpl.getNextInstalmentDeadline(pool.address)).gt())
                });

                it('Repay in grace period, with penality', async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                    const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);

                    await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).sub(10).toString()));

                    const repayAmount = createPoolParams._borrowRate
                        .mul(amount.add(amount1))
                        .mul(createPoolParams._repaymentInterval)
                        .div(60 * 60 * 24 * 365);
                    const repayAmountWithPenality = repayAmount
                        .add(scaler)
                        .add(
                            repaymentParams.gracePenalityRate
                                .mul(await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address))
                                .div(scaler)
                        )
                        .div(scaler);
                    await borrowToken.connect(random).approve(repaymentImpl.address, repayAmountWithPenality);
                    // await expect(
                    //     repaymentImpl.connect(random).repay(pool.address, repayAmount)
                    // ).to.be.revertedWith("");
                    console.log('repayAmountWithPenality', repayAmountWithPenality.toString(), repayAmount.div(scaler).toString());
                    await repaymentImpl.connect(random).repay(pool.address, repayAmountWithPenality);
                    const interestForCurrentPeriod = await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address);
                    assert(
                        interestForCurrentPeriod.div(scaler).toString() == repayAmount.sub(scaler).div(scaler).toString(),
                        `Repay amount for the current period not correctly recorded. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
                    );
                });

                it('Repay for next period after repayment in grace period', async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                    const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);

                    await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).sub(10).toString()));

                    const repayAmount = createPoolParams._borrowRate
                        .mul(amount.add(amount1))
                        .mul(createPoolParams._repaymentInterval)
                        .div(60 * 60 * 24 * 365);
                    const repayAmountWithPenality = repayAmount
                        .add(scaler)
                        .add(
                            repaymentParams.gracePenalityRate
                                .mul(await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address))
                                .div(scaler)
                        )
                        .div(scaler);
                    await borrowToken.connect(random).approve(repaymentImpl.address, repayAmountWithPenality.add(20));
                    await repaymentImpl.connect(random).repay(pool.address, repayAmountWithPenality.add(20));
                    const interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
                    assert(
                        interestForCurrentPeriod.toString() == repayAmount.div(scaler).sub(1).sub(20).toString(),
                        `Extra repayment in grace period not correctly recorded. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount
                            .div(scaler)
                            .sub(1)
                            .sub(20)}`
                    );
                });

                it("Can't liquidate in grace period", async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);

                    await blockTravel(network, parseInt(endOfPeriod.add(10).toString()));

                    await expect(pool.liquidatePool(false, false, false)).to.be.revertedWith('LP2');
                });
            });

            context('Borrower requests extension', async () => {
                it('Request extension', async () => {
                    await expect(extenstion.connect(random).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
                    await expect(extenstion.connect(lender).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
                    await extenstion.connect(borrower).requestExtension(pool.address);
                });

                it('Extension passed', async () => {
                    await extenstion.connect(borrower).requestExtension(pool.address);
                    await extenstion.connect(lender1).voteOnExtension(pool.address);
                    await extenstion.connect(lender).voteOnExtension(pool.address);
                    const { isLoanExtensionActive } = await repaymentImpl.repayVariables(pool.address);
                    assert(isLoanExtensionActive, 'Extension not active');
                });

                it("Can't vote after extension passed", async () => {
                    await extenstion.connect(borrower).requestExtension(pool.address);
                    await extenstion.connect(lender).voteOnExtension(pool.address);
                    const { isLoanExtensionActive } = await repaymentImpl.repayVariables(pool.address);
                    assert(isLoanExtensionActive, 'Extension not active');
                    await expect(extenstion.connect(lender1).voteOnExtension(pool.address)).to.be.revertedWith(
                        'Pool::voteOnExtension - Voting is over'
                    );
                });

                context('Extension passed', async () => {
                    it("Shouldn't be liquidated for current period", async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender).voteOnExtension(pool.address);

                        await expect(pool.connect(random).liquidatePool(false, false, false)).to.be.revertedWith('LP2');
                    });

                    it('liquidate if repay less than interest for extended period', async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender).voteOnExtension(pool.address);

                        const interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(
                            scaler
                        );
                        await borrowToken.connect(admin).transfer(random.address, interestForCurrentPeriod);
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod);
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod);

                        const endOfExtension: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                        const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction
                            .mul(createPoolParams._repaymentInterval)
                            .div(scaler);
                        await blockTravel(network, parseInt(endOfExtension.add(gracePeriod).add(1).toString()));

                        const collateralShares = await savingsAccount.balanceInShares(
                            pool.address,
                            collateralToken.address,
                            poolStrategy.address
                        );

                        let collateralTokens = await poolStrategy.callStatic.getTokensForShares(
                            collateralShares.sub(2),
                            collateralToken.address
                        );
                        let borrowTokensForCollateral = await pool.getEquivalentTokens(
                            collateralToken.address,
                            borrowToken.address,
                            collateralTokens
                        );
                        await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                        await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                        await pool.connect(random).liquidatePool(false, false, false);
                    });

                    it("Can't liquidate if repay is more than interest for extended period", async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender).voteOnExtension(pool.address);

                        const interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(
                            scaler
                        );
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod.add(1));
                        const endOfExtension: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod.add(1));

                        const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction
                            .mul(createPoolParams._repaymentInterval)
                            .div(scaler);
                        await blockTravel(network, parseInt(endOfExtension.add(gracePeriod).add(1).toString()));
                        await expect(pool.connect(random).liquidatePool(false, false, false)).to.be.revertedWith('LP2');
                    });

                    it('Repay interest for period after extension', async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender).voteOnExtension(pool.address);

                        let interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
                        const endOfExtension: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod.add(1));
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod.add(1));

                        const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction
                            .mul(createPoolParams._repaymentInterval)
                            .div(scaler);
                        await blockTravel(network, parseInt(endOfExtension.add(gracePeriod).add(1).toString()));

                        interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod);
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod);
                    });
                });

                context('Extension failed', async () => {
                    it("Shouldn't be liquidated for current period if interest is repaid", async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender1).voteOnExtension(pool.address);

                        const { extensionVoteEndTime } = await extenstion.extensions(pool.address);

                        let interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod.add(1));
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod.add(1));
                        await blockTravel(network, parseInt(extensionVoteEndTime.add(1).toString()));

                        await expect(pool.connect(random).liquidatePool(false, false, false)).to.be.revertedWith('LP2');
                    });

                    it('liquidate if repay is less than interest for current period', async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender1).voteOnExtension(pool.address);

                        const interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(
                            scaler
                        );
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod);
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod.sub(1));

                        const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                        const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction
                            .mul(createPoolParams._repaymentInterval)
                            .div(scaler);
                        await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).add(1).toString()));

                        const collateralShares = await savingsAccount.balanceInShares(
                            pool.address,
                            collateralToken.address,
                            poolStrategy.address
                        );
                        let collateralTokens = await poolStrategy.callStatic.getTokensForShares(
                            collateralShares.sub(2),
                            collateralToken.address
                        );
                        let borrowTokensForCollateral = await pool.getEquivalentTokens(
                            collateralToken.address,
                            borrowToken.address,
                            collateralTokens
                        );
                        await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                        await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                        await pool.connect(random).liquidatePool(false, false, false);
                    });
                });

                context("Can't request another extension", async () => {
                    it('when extension is requested', async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await expect(extenstion.connect(borrower).requestExtension(pool.address)).to.be.revertedWith(
                            'Extension::requestExtension - Extension requested already'
                        );
                    });

                    it('after an extension passed', async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender1).voteOnExtension(pool.address);
                        await extenstion.connect(lender).voteOnExtension(pool.address);

                        await expect(extenstion.connect(borrower).requestExtension(pool.address)).to.be.revertedWith(
                            'Extension::requestExtension: Extension already availed'
                        );
                    });

                    it('after an extension passed and extended period is complete', async () => {
                        await extenstion.connect(borrower).requestExtension(pool.address);
                        await extenstion.connect(lender1).voteOnExtension(pool.address);
                        await extenstion.connect(lender).voteOnExtension(pool.address);

                        const interestForCurrentPeriod = (await repaymentImpl.getInterestDueTillInstalmentDeadline(pool.address)).div(
                            scaler
                        );
                        const endOfExtension: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                        await borrowToken.connect(random).approve(repaymentImpl.address, interestForCurrentPeriod);
                        await repaymentImpl.connect(random).repay(pool.address, interestForCurrentPeriod);

                        await blockTravel(network, parseInt(endOfExtension.add(1).toString()));

                        await expect(extenstion.connect(borrower).requestExtension(pool.address)).to.be.revertedWith(
                            'Extension::requestExtension: Extension already availed'
                        );
                    });
                });
            });

            context('Borrower defaulted repayment', async () => {
                // TODO: Check balances are correct when liquidation happens
                it('Liquidate pool', async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                    const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
                    await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).add(1).toString()));

                    const collateralShares = await savingsAccount.balanceInShares(
                        pool.address,
                        collateralToken.address,
                        poolStrategy.address
                    );
                    let collateralTokens = await poolStrategy.callStatic.getTokensForShares(
                        collateralShares.sub(2),
                        collateralToken.address
                    );
                    let borrowTokensForCollateral = await pool.getEquivalentTokens(
                        collateralToken.address,
                        borrowToken.address,
                        collateralTokens
                    );
                    await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                    await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                    await pool.connect(random).liquidatePool(false, false, false);
                });

                it('Lenders should be able to withdraw repayments till now', async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                    const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
                    await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).add(1).toString()));

                    const collateralShares = await savingsAccount.balanceInShares(
                        pool.address,
                        collateralToken.address,
                        poolStrategy.address
                    );
                    let collateralTokens = await poolStrategy.callStatic.getTokensForShares(
                        collateralShares.sub(2),
                        collateralToken.address
                    );
                    let borrowTokensForCollateral = await pool.getEquivalentTokens(
                        collateralToken.address,
                        borrowToken.address,
                        collateralTokens
                    );
                    await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                    await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                    await pool.connect(random).liquidatePool(false, false, false);

                    await pool.connect(lender).withdrawRepayment();
                });

                it('Lenders should be able to withdraw liquidated collateral', async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                    const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
                    await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).add(1).toString()));

                    const collateralShares = await savingsAccount.balanceInShares(
                        pool.address,
                        collateralToken.address,
                        poolStrategy.address
                    );
                    let collateralTokens = await poolStrategy.callStatic.getTokensForShares(
                        collateralShares.sub(2),
                        collateralToken.address
                    );
                    let borrowTokensForCollateral = await pool.getEquivalentTokens(
                        collateralToken.address,
                        borrowToken.address,
                        collateralTokens
                    );
                    await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
                    await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
                    await pool.connect(random).liquidatePool(false, false, false);

                    await pool.connect(lender).withdrawLiquidity();
                });

                it("Borrower can't withdraw collateral", async () => {
                    const endOfPeriod: BigNumber = (await repaymentImpl.getNextInstalmentDeadline(pool.address)).div(scaler);
                    const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
                    await blockTravel(network, parseInt(endOfPeriod.add(gracePeriod).add(1).toString()));

                    await expect(pool.cancelPool()).to.be.revertedWith('CP1');

                    await expect(pool.closeLoan()).to.be.revertedWith('OR1');
                });
            });

            context('Margin call when collateral ratio falls below ideal ratio', async () => {
                beforeEach(async () => {
                    await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['ETH/USD']);
                });

                afterEach(async () => {
                    await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);
                });

                it("Margin called lender, can't send pool tokens", async () => {
                    await pool.connect(lender).requestMarginCall();

                    await expect(pool.connect(lender).transfer(random.address, 5)).to.be.revertedWith('TT3');
                });

                it("Margin called lender, can't receive pool tokens", async () => {
                    await pool.connect(lender).requestMarginCall();

                    await expect(pool.connect(lender1).transfer(lender.address, 5)).to.be.revertedWith('TT4');
                });

                it('Multiple lender can initiate margin call', async () => {
                    await pool.connect(lender).requestMarginCall();

                    await pool.connect(lender1).requestMarginCall();
                });

                it('Only lender can initiate margin call', async () => {
                    await expect(pool.connect(random).requestMarginCall()).to.be.revertedWith('IL1');
                });

                it("Margin call can't be liquidated, if borrower adds collateral for margin call", async () => {
                    await pool.connect(lender).requestMarginCall();
                    const price = await priceOracle.getLatestPrice(Contracts.LINK, Contracts.DAI);
                    const totalDeficit: BigNumber = createPoolParams._poolSize
                        .mul(testPoolFactoryParams._minborrowFraction)
                        .div(scaler)
                        .mul(price[0])
                        .div(BigNumber.from(10).pow(price[1]))
                        .sub(createPoolParams._collateralAmount);
                    const amount: BigNumber = totalDeficit
                        .mul(await pool.balanceOf(lender.address))
                        .div(await pool.totalSupply())
                        .add(1);
                    await collateralToken.connect(admin).transfer(borrower.address, amount);

                    await collateralToken.connect(borrower).approve(pool.address, amount);

                    await pool.connect(borrower).addCollateralInMarginCall(lender.address, amount, false);

                    await expect(pool.liquidateForLender(lender.address, false, false, false)).to.be.revertedWith('CLBL2');
                });

                it("Margin call can't be liquidated, if collateral ratio goes above ideal ratio", async () => {
                    await pool.connect(lender).requestMarginCall();

                    await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

                    await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);

                    await expect(pool.liquidateForLender(lender.address, false, false, false)).to.be.revertedWith('CLBL4');
                });

                it("If collateral ratio below ideal after margin call time, Anyone can liquidate lender's part of collateral", async () => {
                    await pool.connect(lender).requestMarginCall();
                    const price = await priceOracle.getLatestPrice(Contracts.LINK, Contracts.DAI);
                    const totalDeficit: BigNumber = createPoolParams._poolSize
                        .mul(testPoolFactoryParams._minborrowFraction)
                        .div(scaler)
                        .mul(price[0])
                        .mul(createPoolParams._collateralRatio)
                        .div(scaler)
                        .div(BigNumber.from(10).pow(price[1]))
                        .sub(createPoolParams._collateralAmount);
                    let amount: BigNumber = totalDeficit.mul(await pool.balanceOf(lender.address)).div(await pool.totalSupply());
                    amount = amount.sub(amount.div(1000));

                    await collateralToken.connect(admin).transfer(borrower.address, amount);
                    await collateralToken.connect(borrower).approve(pool.address, amount);

                    await pool.connect(borrower).addCollateralInMarginCall(lender.address, amount, false);

                    await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

                    const liquidationTokens = await pool.balanceOf(lender.address);
                    await borrowToken.connect(admin).transfer(random.address, liquidationTokens);
                    await borrowToken.connect(random).approve(pool.address, liquidationTokens);

                    await pool.connect(random).liquidateForLender(lender.address, false, false, false);
                });

                context('Collateral added in margin call is specific to lender', async () => {
                    it('If pool liquidated, lender for whom collateral was added in margin call should get extra collateral', async () => {});
                });
            });
        });
    });
});
