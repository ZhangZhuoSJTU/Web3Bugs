import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { SavingsAccount } from '@typechain/SavingsAccount';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { StrategyRegistry } from '@typechain/StrategyRegistry';

export async function createSavingsAccount(proxyAdmin: SignerWithAddress): Promise<SavingsAccount> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    const savingsAccountLogic = await deployHelper.core.deploySavingsAccount();
    const savingsAccountProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(savingsAccountLogic.address, proxyAdmin.address);
    const savingsAccount: SavingsAccount = await deployHelper.core.getSavingsAccount(savingsAccountProxy.address);
    return savingsAccount;
}

export async function initSavingsAccount(
    savingsAccount: SavingsAccount,
    admin: SignerWithAddress,
    strategyRegistry: StrategyRegistry,
    creditLines: Address
) {
    await savingsAccount.connect(admin).initialize(admin.address, strategyRegistry.address, creditLines);
}
