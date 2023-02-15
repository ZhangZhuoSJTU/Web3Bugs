import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { CreditLine } from '@typechain/CreditLine';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { PriceOracle } from '@typechain/PriceOracle';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { Address } from 'hardhat-deploy/dist/types';
import { CreditLineInitParams } from '../../utils/types';

import { run } from 'hardhat';
const confirmations = 6;

export async function createCreditLines(proxyAdmin: SignerWithAddress, usdc: Address): Promise<CreditLine> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('Deploying credit lines');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let creditLineLogic: CreditLine = await deployHelper.core.deployCreditLines(usdc);
    let creditLineProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(creditLineLogic.address, proxyAdmin.address);
    let creditLine: CreditLine = await deployHelper.core.getCreditLines(creditLineProxy.address);

    if (chainid != 31337) {
        console.log(`Waiting for ${confirmations} confirmation`);
        await creditLineLogic.deployTransaction.wait(confirmations);
        await verifyCreditLines(creditLineLogic.address, [usdc]);
    }
    return creditLine;
}

async function verifyCreditLines(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/CreditLine/CreditLine.sol:CreditLine',
    }).catch(console.log);
}

export async function initCreditLine(
    creditLine: CreditLine,
    admin: SignerWithAddress,
    defaultStrategy: Address,
    priceOracle: PriceOracle,
    savingsAccount: SavingsAccount,
    strategyRegistry: StrategyRegistry,
    creditLineInitParams: CreditLineInitParams,
    protocolFeeCollector: SignerWithAddress
) {
    let chainid = await admin.getChainId();
    if (chainid != 31337) {
        console.log('Initializing Credit Lines');
    }
    await (
        await creditLine
            .connect(admin)
            .initialize(
                defaultStrategy,
                priceOracle.address,
                savingsAccount.address,
                strategyRegistry.address,
                admin.address,
                creditLineInitParams._protocolFeeFraction,
                protocolFeeCollector.address,
                creditLineInitParams._liquidatorRewardFraction
            )
    ).wait();
}
