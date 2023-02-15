import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    AaveYieldParams,
    CompoundPair,
    CreditLineInitParams,
    DeploymentParams,
    ExtensionInitParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    StrategyRegistryParams,
    YearnPair,
} from '../../utils/types';

import { createSavingsAccount, initSavingsAccount } from '../../utils/createEnv/savingsAccount';
import { createStrategyRegistry, initStrategyRegistry } from '../../utils/createEnv/strategyRegistry';
import { createCreditLines, initCreditLine } from '../../utils/createEnv/creditLines';
import {
    createAaveYieldWithInit,
    createCompoundYieldWithInit,
    createYearnYieldWithInit,
    createNoYieldWithInit,
} from '../../utils/createEnv/yields';
import { createAdminVerifierWithInit, createVerificationWithInit } from '../../utils/createEnv/verification';
import { createPriceOracle, setPriceOracleFeeds } from '../../utils/createEnv/priceOracle';
import { addSupportedTokens, createPoolFactory, initPoolFactory, setImplementations } from '../../utils/createEnv/poolFactory';
import { createExtenstionWithInit } from '../../utils/createEnv/extension';
import { createRepaymentsWithInit } from '../../utils/createEnv/repayments';
import { createPool } from '../../utils/createEnv/poolLogic';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { Pool } from '../../typechain/Pool';
import { Verification } from '../../typechain/Verification';
import { PoolFactory } from '../../typechain/PoolFactory';
import { PriceOracle } from '../../typechain/PriceOracle';
import { Extension } from '../../typechain/Extension';
import { Repayments } from '../../typechain/Repayments';
import { AdminVerifier } from '../../typechain/AdminVerifier';
import { CreditLine } from '../../typechain/CreditLine';
import { IYield } from '../../typechain/IYield';
import { zeroAddress } from '../../utils/constants';
import { IYield__factory } from '../../typechain/factories/IYield__factory';
import { YearnYield__factory } from '../../typechain/factories/YearnYield__factory';

import { induceDelay } from '../../utils/helpers';

export async function deployer(signers: SignerWithAddress[], config: DeploymentParams) {
    const {
        strategyRegistryParams,
        aaveYieldParams,
        yearnYieldPairs,
        compoundPairs,
        priceFeeds,
        extensionInitParams,
        repaymentsInitParams,
        poolFactoryInitParams,
        // creditLineInitParams,
        verificationParams
    } = config;
    let [proxyAdmin, admin, deployer]: SignerWithAddress[] = signers;

    console.log('Deploying savings account');

    const savingsAccount: SavingsAccount = await createSavingsAccount(proxyAdmin);

    console.log('Deploying Strategy Registry');

    const strategyRegistry: StrategyRegistry = await createStrategyRegistry(proxyAdmin);

    console.log('Deploying credit line');

    const creditLine: CreditLine = await createCreditLines(proxyAdmin);

    console.log('initialize savings account');

    await initSavingsAccount(savingsAccount, admin, strategyRegistry, creditLine.address);

    console.log('Initialize strategy registry');

    await initStrategyRegistry(strategyRegistry, deployer, admin.address, strategyRegistryParams.maxStrategies);

    console.log('Deploy and initialize noYield');

    const noYield: IYield = await createNoYieldWithInit(proxyAdmin, admin, savingsAccount);
    await (await strategyRegistry.connect(admin).addStrategy(noYield.address)).wait();

    let aaveYield: IYield;
    if (aaveYieldParams?.wethGateway) {
        console.log('Deploy and initialize aaveYield');

        aaveYield = await createAaveYieldWithInit(proxyAdmin, admin, savingsAccount, aaveYieldParams);
        await (await strategyRegistry.connect(admin).addStrategy(aaveYield.address)).wait();
    } else {
        aaveYield = IYield__factory.connect(zeroAddress, admin);
    }

    let yearnYield: IYield;
    if (yearnYieldPairs && yearnYieldPairs.length != 0) {
        console.log('Deploy and initialize yearnYield');

        yearnYield = await createYearnYieldWithInit(proxyAdmin, admin, savingsAccount, yearnYieldPairs);
        await (await strategyRegistry.connect(admin).addStrategy(yearnYield.address)).wait();
    } else {
        yearnYield = IYield__factory.connect(zeroAddress, admin);
    }

    let compoundYield: IYield;
    if (compoundPairs && compoundPairs?.length != 0) {
        console.log('Deploy and initialize compoundYield');

        compoundYield = await createCompoundYieldWithInit(proxyAdmin, admin, savingsAccount, compoundPairs);
        await (await strategyRegistry.connect(admin).addStrategy(compoundYield.address)).wait();
    } else {
        compoundYield = IYield__factory.connect(zeroAddress, admin);
    }

    console.log('Deploying verification');

    const verification: Verification = await createVerificationWithInit(proxyAdmin, admin, verificationParams);
    const adminVerifier: AdminVerifier = await createAdminVerifierWithInit(proxyAdmin, admin, verification);
    await (await verification.connect(admin).addVerifier(adminVerifier.address)).wait();

    console.log('Deploying price oracle');

    const priceOracle: PriceOracle = await createPriceOracle(proxyAdmin, admin);

    console.log('setting price feeds');

    await setPriceOracleFeeds(priceOracle, admin, priceFeeds);

    console.log('Deploy and initialize pool factory');

    const poolFactory: PoolFactory = await createPoolFactory(proxyAdmin);

    await initPoolFactory(poolFactory, admin, {
        ...poolFactoryInitParams,
        admin: admin.address,
    });

    console.log('Deploying extenstions');

    const extension: Extension = await createExtenstionWithInit(proxyAdmin, admin, poolFactory, extensionInitParams);

    console.log('Deploying pool logic');

    const poolLogic: Pool = await createPool(proxyAdmin);

    console.log('Deploying repayment logic');

    const repaymentLogic: Repayments = await createRepaymentsWithInit(proxyAdmin, admin, poolFactory, savingsAccount, repaymentsInitParams);

    console.log('Set implementations in Pool Factory');

    await induceDelay(123);

    await setImplementations(
        poolFactory,
        admin,
        poolLogic,
        repaymentLogic,
        verification,
        strategyRegistry,
        priceOracle,
        savingsAccount,
        extension
    );

    console.log('set supported borrow and collateral tokens');

    await addSupportedTokens(
        poolFactory,
        admin,
        // [...compoundPairs, ...yearnYieldPairs].map((a) => a.asset),
        // [...compoundPairs, ...yearnYieldPairs].map((a) => a.asset)
        compoundPairs.map((a) => a.asset),
        compoundPairs.map((a) => a.asset)
    );

    console.log('initialize credit lines');
    // TODO
    await initCreditLine(
        creditLine,
        admin,
        noYield.address,
        priceOracle,
        savingsAccount,
        strategyRegistry,
        {
            _protocolFeeFraction: '1750000000000000000000000000',
            _liquidatorRewardFraction: '92000000000000000000000000000',
        },
        admin
    );

    return {
        savingsAccount: savingsAccount.address,
        strategyRegistry: strategyRegistry.address,
        creditLines: creditLine.address,
        proxyAdmin: proxyAdmin.address,
        admin: admin.address,
        noYield: noYield ? noYield.address : 'Contract not deplyed in this network',
        aaveYield: aaveYield ? aaveYield.address : 'Contract not deployed in this network',
        yearnYield: yearnYield ? yearnYield.address : 'Contract not deployed in this network',
        compoundYield: compoundYield ? compoundYield.address : 'Contract not deployed in this network',
        verification: verification.address,
        adminVerifier: adminVerifier.address,
        priceOracle: priceOracle.address,
        extension: extension.address,
        poolLogic: poolLogic.address,
        repaymentLogic: repaymentLogic.address,
        poolFactory: poolFactory.address,
    };
}

// {
//   "savingsAccount": "0x69A634cE54588ba06b7813dA31C26832aa2ffa8c",
//   "strategyRegistry": "0xA4366F7376A5425F9Bc0226ced35ad8f4536FD56",
//   "creditLines": "0xA102E6f5Bda8d1222520345a759D298B68938e5C",
//   "proxyAdmin": "0x03f484190bc6889B28739Af182D996df57B02CC9",
//   "admin": "0x4813CB98f2322CFb9fbf2f2dAFe01297FD70D19e",
//   "noYield": "0x85858349d12946a6538353a794ab267E311856f4",
//   "aaveYield": "0x34Db1C4a5CF324Dc2231C1C725A869eaF205b2Ee",
//   "yearnYield": "0x0000000000000000000000000000000000000000",
//   "compoundYield": "0xBc2e7Bcf4fe46d14a19ccfE2e2D72146c579A06a",
//   "verification": "0x4256a2722d60c90c39515E0Adb3E731b91480996",
//   "adminVerifier": "0x24E444Bb965769E962e52B21612699612AE33F8a",
//   "priceOracle": "0x66C876639d1C48dB02A3687BE6Cf089Ac5118742",
//   "extension": "0xb931beE03892cA2f8d26f52E78945F0c643cEb4b",
//   "poolLogic": "0x4329912bFb77D109F7647197390f42291E5571A5",
//   "repaymentLogic": "0x8F990286B3B3A4a73161723a0B4E5fc80B539DD5",
//   "poolFactory": "0xfbd30d70Da78901b36F263D7bca0b4099B3D4680"
// }
