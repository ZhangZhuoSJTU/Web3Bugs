import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { SavingsAccount } from '@typechain/SavingsAccount';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { StrategyRegistry } from '@typechain/StrategyRegistry';

import { run } from 'hardhat';
const confirmations = 6;

export async function createSavingsAccount(proxyAdmin: SignerWithAddress): Promise<SavingsAccount> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying savings account');
    }
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    const savingsAccountLogic = await deployHelper.core.deploySavingsAccount();
    const savingsAccountProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(savingsAccountLogic.address, proxyAdmin.address);
    const savingsAccount: SavingsAccount = await deployHelper.core.getSavingsAccount(savingsAccountProxy.address);
    if (chainid != 31337) {
        await savingsAccountLogic.deployTransaction.wait(confirmations);
        await verifySavingsAccounts(savingsAccountLogic.address, []);
    }
    return savingsAccount;
}

export async function initSavingsAccount(
    savingsAccount: SavingsAccount,
    admin: SignerWithAddress,
    strategyRegistry: StrategyRegistry,
    creditLines: Address
) {
    let chainid = await admin.getChainId();
    if (chainid != 31337) {
        console.log('initializing savings account');
    }
    await (await savingsAccount.connect(admin).initialize(admin.address, strategyRegistry.address)).wait();
}

async function verifySavingsAccounts(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/SavingsAccount/SavingsAccount.sol:SavingsAccount',
    }).catch(console.log);
}
