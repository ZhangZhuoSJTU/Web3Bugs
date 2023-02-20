import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from 'chai';

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
    OperationalAmounts,
    extensionParams,
    verificationParams,
} from '../utils/constants';
import DeployHelper from '../utils/deploys';

import { SavingsAccount } from '../typechain/SavingsAccount';
import { StrategyRegistry } from '../typechain/StrategyRegistry';

import { getPoolAddress, getRandomFromArray, incrementChain } from '../utils/helpers';

import { Address } from 'hardhat-deploy/dist/types';
import { AaveYield } from '../typechain/AaveYield';
import { YearnYield } from '../typechain/YearnYield';
import { CompoundYield } from '../typechain/CompoundYield';
import { Pool } from '../typechain/Pool';
import { Verification } from '../typechain/Verification';
import { PoolFactory } from '../typechain/PoolFactory';
import { ERC20 } from '../typechain/ERC20';
import { PriceOracle } from '../typechain/PriceOracle';
import { Extension } from '../typechain/Extension';

import { Contracts } from '../existingContracts/compound.json';
import { sha256 } from '@ethersproject/sha2';
import { Repayments } from '../typechain/Repayments';
import { ContractTransaction } from '@ethersproject/contracts';
import { getContractAddress } from '@ethersproject/address';

import { SublimeProxy } from '../typechain/SublimeProxy';
import { Token } from '../typechain/Token';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { NoYield } from '@typechain/NoYield';

import { getPoolInitSigHash } from '../utils/createEnv/poolLogic';

describe.skip('Template 2', async () => {
    let savingsAccount: SavingsAccount;
    let savingsAccountLogic: SavingsAccount;

    let strategyRegistry: StrategyRegistry;
    let strategyRegistryLogic: StrategyRegistry;

    let mockCreditLines: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;

    let aaveYield: AaveYield;
    let aaveYieldLogic: AaveYield;

    let yearnYield: YearnYield;
    let yearnYieldLogic: YearnYield;

    let compoundYield: CompoundYield;
    let compoundYieldLogic: CompoundYield;

    let noYield: NoYield;
    let noYieldLogic: NoYield;

    let BatTokenContract: ERC20;
    let LinkTokenContract: ERC20;
    let DaiTokenContract: ERC20;

    let verificationLogic: Verification;
    let verification: Verification;
    let adminVerifierLogic: AdminVerifier;
    let adminVerifier: AdminVerifier;

    let priceOracleLogic: PriceOracle;
    let priceOracle: PriceOracle;

    let Binance7: any;
    let WhaleAccount: any;
    let protocolFeeCollector: any;

    let extenstionLogic: Extension;
    let extenstion: Extension;

    let poolLogic: Pool;
    let repaymentLogic: Repayments;

    let poolFactoryLogic: PoolFactory;
    let poolFactory: PoolFactory;

    let pool: Pool;
    let testToken1: Token;
    let testToken2: Token;

    before(async () => {
        [proxyAdmin, admin, mockCreditLines, borrower, lender, protocolFeeCollector] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        console.log('Deploying savings account logic');
        savingsAccountLogic = await deployHelper.core.deploySavingsAccount();
        let savingsAccountProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(
            savingsAccountLogic.address,
            proxyAdmin.address
        );
        savingsAccount = await deployHelper.core.getSavingsAccount(savingsAccountProxy.address);

        console.log('Deploying strategy registry');
        strategyRegistryLogic = await deployHelper.core.deployStrategyRegistry();
        let strategyRegistryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(
            strategyRegistryLogic.address,
            proxyAdmin.address
        );
        strategyRegistry = await deployHelper.core.getStrategyRegistry(strategyRegistryProxy.address);

        //initialize
        await savingsAccount.connect(admin).initialize(admin.address, strategyRegistry.address, mockCreditLines.address);
        await strategyRegistry.connect(admin).initialize(admin.address, 10);

        if (network.name === 'hardhat') {
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

            aaveYieldLogic = await deployHelper.core.deployAaveYield();
            let aaveYieldProxy = await deployHelper.helper.deploySublimeProxy(aaveYieldLogic.address, proxyAdmin.address);
            aaveYield = await deployHelper.core.getAaveYield(aaveYieldProxy.address);

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

            yearnYieldLogic = await deployHelper.core.deployYearnYield();
            let yearnYieldProxy = await deployHelper.helper.deploySublimeProxy(yearnYieldLogic.address, proxyAdmin.address);
            yearnYield = await deployHelper.core.getYearnYield(yearnYieldProxy.address);

            await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address);
            await strategyRegistry.connect(admin).addStrategy(yearnYield.address);
            await yearnYield.connect(admin).updateProtocolAddresses(DaiTokenContract.address, DAI_Yearn_Protocol_Address);

            compoundYieldLogic = await deployHelper.core.deployCompoundYield();
            let compoundYieldProxy = await deployHelper.helper.deploySublimeProxy(compoundYieldLogic.address, proxyAdmin.address);
            compoundYield = await deployHelper.core.getCompoundYield(compoundYieldProxy.address);

            await compoundYield.connect(admin).initialize(admin.address, savingsAccount.address);
            await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
            await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);
        }

        noYieldLogic = await deployHelper.core.deployNoYield();
        let noYieldProxy = await deployHelper.helper.deploySublimeProxy(noYieldLogic.address, proxyAdmin.address);
        noYield = await deployHelper.core.getNoYield(noYieldProxy.address);
        await noYield.connect(admin).initialize(admin.address, savingsAccount.address);

        await strategyRegistry.connect(admin).addStrategy(noYield.address);

        console.log('Deploying verification');
        verificationLogic = await deployHelper.helper.deployVerification();
        let verificationProxy = await deployHelper.helper.deploySublimeProxy(verificationLogic.address, proxyAdmin.address);
        verification = await deployHelper.helper.getVerification(verificationProxy.address);
        adminVerifierLogic = await deployHelper.helper.deployAdminVerifier();
        let adminVerificationProxy = await deployHelper.helper.deploySublimeProxy(adminVerifierLogic.address, proxyAdmin.address);
        adminVerifier = await deployHelper.helper.getAdminVerifier(adminVerificationProxy.address);
        await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
        await adminVerifier.connect(admin).initialize(admin.address, verification.address);
        await verification.connect(admin).addVerifier(adminVerifier.address);
        await adminVerifier.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')), true);

        console.log('Deploying price oracle');
        priceOracleLogic = await deployHelper.helper.deployPriceOracle();
        let priceOracleProxy = await deployHelper.helper.deploySublimeProxy(priceOracleLogic.address, proxyAdmin.address);
        priceOracle = await deployHelper.helper.getPriceOracle(priceOracleProxy.address);
        await priceOracle.connect(admin).initialize(admin.address);

        if (network.name == 'hardhat') {
            await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);
            await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.DAI, ChainLinkAggregators['DAI/USD']);
        }

        console.log('Deploying pool factory');
        poolFactoryLogic = await deployHelper.pool.deployPoolFactory();
        let poolFactoryProxy = await deployHelper.helper.deploySublimeProxy(poolFactoryLogic.address, proxyAdmin.address);
        poolFactory = await deployHelper.pool.getPoolFactory(poolFactoryProxy.address);

        console.log('Deploying extenstions');
        extenstionLogic = await deployHelper.pool.deployExtenstion();
        let extenstionProxy = await deployHelper.helper.deploySublimeProxy(extenstionLogic.address, proxyAdmin.address);
        extenstion = await deployHelper.pool.getExtension(extenstionProxy.address);
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
        console.log('Deploying pool logic');
        poolLogic = await deployHelper.pool.deployPool();
        console.log('Deploying pool token logic');
        console.log('Deploying repayment logic');
        repaymentLogic = await deployHelper.pool.deployRepayments();

        if (network.name == 'hardhat') {
            await poolFactory.connect(admin).updateSupportedBorrowTokens(Contracts.DAI, true);
            await poolFactory.connect(admin).updateSupportedCollateralTokens(Contracts.LINK, true);
        }

        await poolFactory
            .connect(admin)
            .setImplementations(
                poolLogic.address,
                repaymentLogic.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address,
                extenstion.address
            );

        if (network.name === 'hardhat') {
            deployHelper = new DeployHelper(borrower);
            let collateralToken: ERC20 = await deployHelper.mock.getMockERC20(Contracts.LINK);

            let generatedPoolAddress: Address = await getPoolAddress(
                borrower.address,
                Contracts.DAI,
                Contracts.LINK,
                zeroAddress,
                poolFactory.address,
                sha256(Buffer.from('borrower')),
                poolLogic.address,
                false,
                {}
            );

            let { _poolSize, _collateralRatio, _borrowRate, _repaymentInterval, _noOfRepaymentIntervals, _collateralAmount } =
                createPoolParams;

            await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount.mul(2)); // Transfer quantity to borrower

            await collateralToken.approve(generatedPoolAddress, _collateralAmount.mul(2));

            await expect(
                poolFactory
                    .connect(borrower)
                    .createPool(
                        _poolSize,
                        _borrowRate,
                        Contracts.DAI,
                        Contracts.LINK,
                        _collateralRatio,
                        _repaymentInterval,
                        _noOfRepaymentIntervals,
                        zeroAddress,
                        _collateralAmount,
                        false,
                        sha256(Buffer.from('borrower')),
                        adminVerifier.address,
                        zeroAddress
                    )
            )
                .to.emit(poolFactory, 'PoolCreated')
                .withArgs(generatedPoolAddress, borrower.address);

            pool = await deployHelper.pool.getPool(generatedPoolAddress);

            expect(await pool.name()).eq('Pool Tokens');
            expect(await pool.symbol()).eq('PT');
            expect(await pool.decimals()).eq(18);

            await pool.connect(borrower).depositCollateral(_collateralAmount, false);
        } else {
            let tokenDeployer = new DeployHelper(admin);
            console.log('Deploying test token 1, for kovan');
            testToken1 = await tokenDeployer.mock.deployToken('Test Token 1', 'TST1', BigNumber.from('1000000000000000000000000'));
            console.log('Deploying test token 2, for kovan');
            testToken2 = await tokenDeployer.mock.deployToken('Test Token 2', 'TST2', BigNumber.from('1000000000000000000000000'));

            console.log('Setting Feed Addresses');
            await priceOracle.connect(admin).setChainlinkFeedAddress(testToken1.address, '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541');
            await priceOracle.connect(admin).setChainlinkFeedAddress(testToken2.address, '0x9326BFA02ADD2366b30bacB125260Af641031331');

            console.log('Pool Factory Updating Borrow Tokens');
            await poolFactory.connect(admin).updateSupportedBorrowTokens(testToken1.address, true); //test token 1
            await poolFactory.connect(admin).updateSupportedBorrowTokens(testToken2.address, true); // test token 2
            await poolFactory.connect(admin).updateSupportedBorrowTokens(zeroAddress, true); // for ether

            console.log('Pool Factory Updating Collateral Tokens');
            await poolFactory.connect(admin).updateSupportedCollateralTokens(testToken1.address, true); // test token 1
            await poolFactory.connect(admin).updateSupportedCollateralTokens(testToken2.address, true); // test token 2
            await poolFactory.connect(admin).updateSupportedCollateralTokens(zeroAddress, true); // for ether

            deployHelper = new DeployHelper(borrower);
            let collateralToken: ERC20 = await deployHelper.mock.getMockERC20(testToken2.address); // test token 1

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));

            let generatedPoolAddress: Address = await getPoolAddress(
                borrower.address,
                testToken2.address, // test token 2
                testToken1.address, // test token 1
                zeroAddress,
                poolFactory.address,
                salt,
                poolLogic.address,
                false,
                {}
            );

            let { _poolSize, _collateralRatio, _borrowRate, _repaymentInterval, _noOfRepaymentIntervals, _collateralAmount } =
                createPoolParams;

            console.log('Transfering from admin to borrower');
            await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount.mul(2)); // Transfer quantity to borrower

            console.log('Borrower approving to pool');
            await collateralToken.connect(borrower).approve(generatedPoolAddress, _collateralAmount.mul(2));

            console.log('Token and generated pool address');
            console.log({ collateralToken: collateralToken.address, generatedPoolAddress });

            console.log('Need to create Pool with params');
            console.log({
                _poolSize: _poolSize.toString(),
                topken1Address: testToken1.address, // test token 1
                topken2Address: testToken2.address, // test token 2
                _collateralRatio: _collateralRatio.toString(),
                _borrowRate: _borrowRate.toString(),
                _repaymentInterval: _repaymentInterval.toString(),
                _noOfRepaymentIntervals: _noOfRepaymentIntervals.toString(),
                zeroAddress,
                _collateralAmount: _collateralAmount.toString(),
                _savingsAccount: false,
                salt,
            });

            // await expect(
            //     poolFactory.connect(borrower).createPool(
            //         _poolSize,
            //         _borrowRate,
            //         testToken1.address, // test token 1
            //         testToken2.address, // test token 2
            //         _collateralRatio,
            //         _repaymentInterval,
            //         _noOfRepaymentIntervals,
            //         zeroAddress,
            //         _collateralAmount,
            //         false,
            //         salt
            //     )
            // )
            //     .to.emit(poolFactory, 'PoolCreated')
            //     .withArgs(generatedPoolAddress, borrower.address);

            // pool = await deployHelper.pool.getPool(generatedPoolAddress);

            // expect(await pool.name()).eq('Pool Tokens');
            // expect(await pool.symbol()).eq('PT');
            // expect(await pool.decimals()).eq(18);

            // console.log('Depositing Collateral');
            // await pool.connect(borrower).depositCollateral(_collateralAmount, false);
        }
    });

    it('Print Add Addresses', async () => {
        console.log({
            network: network.name,
            savingsAccount: savingsAccount.address,
            savingsAccountLogic: savingsAccountLogic.address,
            strategyRegistry: strategyRegistry.address,
            strategyRegistryLogic: strategyRegistryLogic.address,
            mockCreditLines: mockCreditLines.address,
            proxyAdmin: proxyAdmin.address,
            admin: admin.address,
            borrower: borrower.address,
            lender: lender.address,
            aaveYield: aaveYield ? aaveYield.address : 'Contract not deployed in this network',
            aaveYieldLogic: aaveYieldLogic ? aaveYieldLogic.address : 'Contract not deployed in this network',
            yearnYield: yearnYield ? yearnYield.address : 'Contract not deployed in this network',
            yearnYieldLogic: yearnYieldLogic ? yearnYieldLogic.address : 'Contract not deployed in this network',
            compoundYield: compoundYield ? compoundYield.address : 'Contract not deployed in this network',
            compoundYieldLogic: compoundYieldLogic ? compoundYield.address : 'Contract not deployed in this network',
            verificationLogic: verificationLogic.address,
            verification: verification.address,
            priceOracleLogic: priceOracleLogic.address,
            priceOracle: priceOracle.address,
            extenstionLogic: extenstionLogic.address,
            testToken1: testToken1 ? testToken1.address : 'Contract not deployed in this network',
            testToken2: testToken2 ? testToken2.address : 'Contract not deployed in this network',
            extenstion: extenstion.address,
            poolLogic: poolLogic.address,
            repaymentLogic: repaymentLogic.address,
            poolFactoryLogic: poolFactoryLogic.address,
            poolFactory: poolFactory.address,
            pool: pool ? pool.address : 'Contract not deployed in this network',
        });
    });
});
