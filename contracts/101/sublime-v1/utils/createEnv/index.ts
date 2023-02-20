import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Address } from 'hardhat-deploy/dist/types';

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
import { zeroAddress } from '../../config/constants';
import {
    // createAaveYieldWithInit,
    createCompoundYieldWithInit,
    createNoYieldWithInit,
    deployMockCompoundTokens,
    // createYearnYieldWithInit,
} from './yields';
import {
    addUserToTwitterVerifier,
    createAdminVerifierWithInit,
    createTwitterVerifierWithInit,
    createVerificationWithInit,
} from './verification';
import { createPriceOracle, setPriceOracleFeeds } from './priceOracle';
import { addSupportedTokens, createPoolFactory, initPoolFactory, setImplementations, createBeacon } from './poolFactory';
import { createRepaymentsWithInit } from './repayments';
import { createPool } from './poolLogic';
import { createCreditLines, initCreditLine } from './creditLines';
import { createCreditLineUtils, createPoolUtils, createSavingsAccountEthUtils } from './helpers';
import {
    createAndChangeImplementationAddressesForLenderPoolAndPooledCreditLines,
    createLenderPool,
    createPooledCreditLines,
} from './pooledCreditLines';

import DeployHelper from '../../utils/deploys';

import { ERC20 } from '../../typechain/ERC20';
import { IYield } from '../../typechain/IYield';
import { BytesLike } from 'ethers';
import { Pool } from '../../typechain/Pool';
import { ERC20Detailed } from '../../typechain/ERC20Detailed';

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
    weth: Address,
    usdc: Address,
    deployMockCompound: boolean = false
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

    const [mockCtoken, mockCEther] = await deployMockCompoundTokens(proxyAdmin, admin);
    env.mockCEther = mockCEther;
    env.mockCToken = mockCtoken;

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
    // yields.aaveYield = await createAaveYieldWithInit(proxyAdmin, admin, env.savingsAccount, weth);
    // yields.yearnYield = await createYearnYieldWithInit(proxyAdmin, admin, env.savingsAccount, supportedYearnTokens, weth);
    yields.compoundYield = await createCompoundYieldWithInit(proxyAdmin, admin, env.savingsAccount, supportedCompoundTokens, weth, [
        mockCtoken,
    ]);

    // await env.strategyRegistry.connect(admin).addStrategy(yields.aaveYield.address);
    // await env.strategyRegistry.connect(admin).addStrategy(yields.yearnYield.address);
    await env.strategyRegistry.connect(admin).addStrategy(yields.compoundYield.address);
    await env.strategyRegistry.connect(admin).addStrategy(yields.noYield.address);

    env.verification = await createVerificationWithInit(proxyAdmin, admin, verificationInitParams);
    env.twitterVerifier = await createTwitterVerifierWithInit(proxyAdmin, admin, env.verification, '99999999', 'sublime', 'v1');
    env.adminVerifier = await createAdminVerifierWithInit(proxyAdmin, admin, env.verification, '99999999', 'name', 'version');

    await env.verification.connect(admin).addVerifier(env.twitterVerifier.address);
    // TODO : registerSelf
    await addUserToTwitterVerifier(env.twitterVerifier, entities.proxyAdmin, entities.admin, entities.borrower.address);

    env.priceOracle = await createPriceOracle(proxyAdmin, admin, weth);
    await setPriceOracleFeeds(env.priceOracle, admin, priceFeeds);

    env.beacon = await createBeacon(proxyAdmin, admin.address, zeroAddress);
    env.poolFactory = await createPoolFactory(proxyAdmin, weth);
    env.repayments = await createRepaymentsWithInit(proxyAdmin, admin, env.poolFactory, env.savingsAccount, repaymentsInitParams);

    await initPoolFactory(env.poolFactory, admin, {
        ...poolFactoryInitParams,
        admin: admin.address,
        protocolFeeCollector: protocolFeeCollector.address,
        noStrategy: yields.noYield.address,
        beacon: env.beacon.address,
    });

    env.inputParams.poolFactoryInitParams = {
        ...poolFactoryInitParams,
        admin: admin.address,
        protocolFeeCollector: protocolFeeCollector.address,
    };

    env.poolLogic = await createPool(proxyAdmin, env.priceOracle.address, env.savingsAccount.address, env.repayments.address);

    await (await env.beacon.connect(admin).changeImpl(env.poolLogic.address)).wait();

    await addSupportedTokens(
        env.poolFactory,
        admin,
        [...supportedCompoundTokens, ...supportedYearnTokens].map((a) => a.asset),
        [...supportedCompoundTokens, ...supportedYearnTokens].map((a) => a.asset),
        [mockCtoken]
    );
    await setImplementations(
        env.poolFactory,
        admin,
        env.repayments,
        env.verification,
        env.strategyRegistry,
        env.priceOracle,
        env.savingsAccount
    );

    env.creditLine = await createCreditLines(proxyAdmin, usdc);

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

    env.poolEthUtils = await createPoolUtils(env.entities.proxyAdmin, weth);
    env.creditLineEthUtils = await createCreditLineUtils(env.entities.proxyAdmin, weth, env.creditLine.address);
    env.savingsAccountEthUtils = await createSavingsAccountEthUtils(env.entities.proxyAdmin, weth, env.savingsAccount.address);

    let lenderPoolProxy = await createLenderPool(env.entities.proxyAdmin, weth);
    let pooledCreditLinesProxy = await createPooledCreditLines(env.entities.proxyAdmin, weth);

    [env.lenderPool, env.pooledCreditLines] = await createAndChangeImplementationAddressesForLenderPoolAndPooledCreditLines(
        env.entities.proxyAdmin,
        env.entities.admin,
        env.entities.protocolFeeCollector,
        pooledCreditLinesProxy,
        lenderPoolProxy,
        env.savingsAccount.address,
        env.verification.address,
        env.priceOracle.address,
        usdc,
        env.strategyRegistry.address
    );

    return env;
}

export async function calculateNewPoolAddress(env: Environment, salt: BytesLike): Promise<Address> {
    let generatedPoolAddress = await env.poolFactory.connect(env.entities.borrower).preComputeAddress(env.entities.borrower.address, salt);

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

    let generatedPoolAddress = await env.poolFactory.connect(env.entities.borrower).preComputeAddress(env.entities.borrower.address, salt);

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
            env.twitterVerifier.address,
            zeroAddress
        );

    return deployHelper.pool.getPool(generatedPoolAddress);
}
