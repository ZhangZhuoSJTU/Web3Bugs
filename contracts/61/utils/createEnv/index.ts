import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Address } from 'hardhat-deploy/dist/types';
import { sha256 } from '@ethersproject/sha2';

import {
    CreditLineDefaultStrategy,
    Environment,
    Yields,
    ExtensionInitParams,
    CreditLineInitParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    CompoundPair,
    YearnPair,
    InputParams,
    Entities,
    MockTokenContract,
    PoolCreateParams,
    VerificationParams,
} from '../types';

import { createSavingsAccount, initSavingsAccount } from './savingsAccount';
import { createStrategyRegistry, initStrategyRegistry } from './strategyRegistry';
import { impersonateAccount, getImpersonatedAccounts } from './impersonationsAndTransfers';
import { randomAddress, zeroAddress } from '../../utils/constants';
import { createAaveYieldWithInit, createCompoundYieldWithInit, createNoYieldWithInit, createYearnYieldWithInit } from './yields';
import { createAdminVerifierWithInit, createVerificationWithInit } from './verification';
import { createPriceOracle, setPriceOracleFeeds } from './priceOracle';
import { addSupportedTokens, createPoolFactory, initPoolFactory, setImplementations } from './poolFactory';
import { createExtenstionWithInit } from './extension';
import { createRepaymentsWithInit } from './repayments';
import { createPool } from './poolLogic';
import { createCreditLines, initCreditLine } from './creditLines';
import DeployHelper from '../../utils/deploys';

import { getPoolAddress } from '../../utils/helpers';
import { ERC20 } from '@typechain/ERC20';
import { IYield } from '@typechain/IYield';
import { BytesLike, BigNumberish, BigNumber } from 'ethers';
import { Pool } from '@typechain/Pool';
import { ERC20Detailed } from '@typechain/ERC20Detailed';

export async function createEnvironment(
    hre: HardhatRuntimeEnvironment,
    whales: Address[],
    supportedCompoundTokens: CompoundPair[],
    supportedYearnTokens: YearnPair[],
    priceFeeds: PriceOracleSource[],
    extensionInitParams: ExtensionInitParams,
    repaymentsInitParams: RepaymentsInitParams,
    poolFactoryInitParams: PoolFactoryInitParams,
    creditLineDefaultStrategy: CreditLineDefaultStrategy,
    creditLineInitParams: CreditLineInitParams,
    verificationInitParams: VerificationParams,
): Promise<Environment> {
    const env = {} as Environment;
    const yields = {} as Yields;
    const inputs = {} as InputParams;
    const entities = {} as Entities;

    inputs.extenstionInitParams = extensionInitParams;
    inputs.creditLineInitParams = creditLineInitParams;
    inputs.poolFactoryInitParams = poolFactoryInitParams;
    inputs.repaymentInitParams = repaymentsInitParams;
    inputs.priceFeeds = priceFeeds;
    inputs.supportedCompoundTokens = supportedCompoundTokens;
    inputs.supportedYearnTokens = supportedYearnTokens;

    env.inputParams = inputs;
    const { ethers } = hre;
    const [proxyAdmin, admin, borrower, lender, protocolFeeCollector]: SignerWithAddress[] = await ethers.getSigners();

    let _tempMockTokensContractAddresses = [...supportedCompoundTokens, ...supportedYearnTokens].map((a) => a.asset.toLowerCase());
    env.mockTokenContracts = [] as MockTokenContract[];

    for (let index = 0; index < _tempMockTokensContractAddresses.length; index++) {
        const tokenAddress = _tempMockTokensContractAddresses[index];
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let contract: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(tokenAddress);
        try {
            let name = await contract.symbol();
            env.mockTokenContracts.push({ name, contract });
        } catch (e) {
            // console.log(e);
            env.mockTokenContracts.push({ name: 'name not found', contract });
        }
    }

    entities.admin = admin;
    entities.borrower = borrower;
    entities.lender = lender;
    entities.protocolFeeCollector = protocolFeeCollector;
    entities.proxyAdmin = proxyAdmin;
    entities.extraLenders = await (await ethers.getSigners()).slice(-100);

    env.savingsAccount = await createSavingsAccount(proxyAdmin);
    env.strategyRegistry = await createStrategyRegistry(proxyAdmin);
    // await initSavingsAccount(env.savingsAccount, admin, env.strategyRegistry, randomAddress);
    await initStrategyRegistry(env.strategyRegistry, admin, admin.address, 100);

    await impersonateAccount(hre, whales, admin);
    env.impersonatedAccounts = await getImpersonatedAccounts(hre, whales);

    yields.noYield = await createNoYieldWithInit(proxyAdmin, admin, env.savingsAccount);
    yields.aaveYield = await createAaveYieldWithInit(proxyAdmin, admin, env.savingsAccount);
    yields.yearnYield = await createYearnYieldWithInit(proxyAdmin, admin, env.savingsAccount, supportedYearnTokens);
    yields.compoundYield = await createCompoundYieldWithInit(proxyAdmin, admin, env.savingsAccount, supportedCompoundTokens);

    await env.strategyRegistry.connect(admin).addStrategy(yields.aaveYield.address);
    await env.strategyRegistry.connect(admin).addStrategy(yields.yearnYield.address);
    await env.strategyRegistry.connect(admin).addStrategy(yields.compoundYield.address);
    await env.strategyRegistry.connect(admin).addStrategy(yields.noYield.address);

    env.verification = await createVerificationWithInit(proxyAdmin, admin, verificationInitParams);
    env.adminVerifier = await createAdminVerifierWithInit(proxyAdmin, admin, env.verification);

    await env.verification.connect(admin).addVerifier(env.adminVerifier.address);
    await env.adminVerifier.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')), true);
    env.priceOracle = await createPriceOracle(proxyAdmin, admin);
    await setPriceOracleFeeds(env.priceOracle, admin, priceFeeds);

    env.poolFactory = await createPoolFactory(proxyAdmin);
    env.extenstion = await createExtenstionWithInit(proxyAdmin, admin, env.poolFactory, extensionInitParams);
    env.repayments = await createRepaymentsWithInit(proxyAdmin, admin, env.poolFactory, env.savingsAccount, repaymentsInitParams);

    await initPoolFactory(env.poolFactory, admin, {
        ...poolFactoryInitParams,
        admin: admin.address,
        protocolFeeCollector: protocolFeeCollector.address,
        noStrategy: yields.noYield.address,
    });

    env.inputParams.poolFactoryInitParams = {
        ...poolFactoryInitParams,
        admin: admin.address,
        protocolFeeCollector: protocolFeeCollector.address,
    };

    env.poolLogic = await createPool(proxyAdmin);

    await addSupportedTokens(
        env.poolFactory,
        admin,
        [...supportedCompoundTokens, ...supportedYearnTokens].map((a) => a.asset),
        [...supportedCompoundTokens, ...supportedYearnTokens].map((a) => a.asset)
    );
    await setImplementations(
        env.poolFactory,
        admin,
        env.poolLogic,
        env.repayments,
        env.verification,
        env.strategyRegistry,
        env.priceOracle,
        env.savingsAccount,
        env.extenstion
    );

    env.creditLine = await createCreditLines(proxyAdmin);

    if (creditLineDefaultStrategy === CreditLineDefaultStrategy.Compound) {
        await initCreditLine(
            env.creditLine,
            admin,
            yields.compoundYield.address,
            env.priceOracle,
            env.savingsAccount,
            env.strategyRegistry,
            creditLineInitParams,
            protocolFeeCollector
        );
    } else if (creditLineDefaultStrategy === CreditLineDefaultStrategy.Yearn) {
        await initCreditLine(
            env.creditLine,
            admin,
            yields.yearnYield.address,
            env.priceOracle,
            env.savingsAccount,
            env.strategyRegistry,
            creditLineInitParams,
            protocolFeeCollector
        );
    } else {
        await initCreditLine(
            env.creditLine,
            admin,
            yields.noYield.address,
            env.priceOracle,
            env.savingsAccount,
            env.strategyRegistry,
            creditLineInitParams,
            protocolFeeCollector
        );
    }

    await initSavingsAccount(env.savingsAccount, admin, env.strategyRegistry, env.creditLine.address);

    env.yields = yields;
    env.entities = entities;
    return env;
}

export async function calculateNewPoolAddress(
    env: Environment,
    borrowToken: ERC20,
    collateralToken: ERC20,
    strategy: IYield,
    salt: BytesLike,
    _transferFromSavingsAccount: Boolean,
    poolCreateParams: PoolCreateParams
): Promise<Address> {
    let generatedPoolAddress = await getPoolAddress(
        env.entities.borrower.address,
        borrowToken.address,
        collateralToken.address,
        strategy.address,
        env.poolFactory.address,
        salt,
        env.poolLogic.address,
        _transferFromSavingsAccount,
        {
            _poolSize: BigNumber.from(poolCreateParams._poolSize),
            _borrowRate: BigNumber.from(poolCreateParams._borrowRate),
            _collateralAmount: BigNumber.from(poolCreateParams._collateralAmount),
            _collateralRatio: BigNumber.from(poolCreateParams._collateralRatio),
            _collectionPeriod: BigNumber.from(poolCreateParams._collectionPeriod),
            _loanWithdrawalDuration: BigNumber.from(poolCreateParams._loanWithdrawalDuration),
            _noOfRepaymentIntervals: BigNumber.from(poolCreateParams._noOfRepaymentIntervals),
            _repaymentInterval: BigNumber.from(poolCreateParams._repaymentInterval),
        }
    );

    return generatedPoolAddress;
}

export async function createNewPool(
    env: Environment,
    borrowToken: ERC20,
    collateralToken: ERC20,
    strategy: IYield,
    salt: BytesLike,
    _transferFromSavingsAccount: boolean,
    poolCreateParams: PoolCreateParams
): Promise<Pool> {
    let deployHelper: DeployHelper = new DeployHelper(env.entities.borrower);

    let generatedPoolAddress = await getPoolAddress(
        env.entities.borrower.address,
        borrowToken.address,
        collateralToken.address,
        strategy.address,
        env.poolFactory.address,
        salt,
        env.poolLogic.address,
        _transferFromSavingsAccount,
        {
            _poolSize: BigNumber.from(poolCreateParams._poolSize),
            _borrowRate: BigNumber.from(poolCreateParams._borrowRate),
            _collateralAmount: BigNumber.from(poolCreateParams._collateralAmount),
            _collateralRatio: BigNumber.from(poolCreateParams._collateralRatio),
            _collectionPeriod: BigNumber.from(poolCreateParams._collectionPeriod),
            _loanWithdrawalDuration: BigNumber.from(poolCreateParams._loanWithdrawalDuration),
            _noOfRepaymentIntervals: BigNumber.from(poolCreateParams._noOfRepaymentIntervals),
            _repaymentInterval: BigNumber.from(poolCreateParams._repaymentInterval),
        }
    );

    await env.poolFactory
        .connect(env.entities.borrower)
        .createPool(
            poolCreateParams._poolSize,
            poolCreateParams._borrowRate,
            borrowToken.address,
            collateralToken.address,
            poolCreateParams._collateralRatio,
            poolCreateParams._repaymentInterval,
            poolCreateParams._noOfRepaymentIntervals,
            strategy.address,
            poolCreateParams._collateralAmount,
            _transferFromSavingsAccount,
            salt,
            env.adminVerifier.address,
            zeroAddress,
            { value: collateralToken.address === zeroAddress ? poolCreateParams._collateralAmount : 0 }
        );

    return deployHelper.pool.getPool(generatedPoolAddress);
}
