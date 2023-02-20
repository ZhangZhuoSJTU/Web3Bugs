import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { BigNumberish } from 'ethers';
import { Address } from 'hardhat-deploy/dist/types';

import { run } from 'hardhat';
const confirmations = 6;

export async function createStrategyRegistry(proxyAdmin: SignerWithAddress): Promise<StrategyRegistry> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying strategy registry');
    }
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    const strategyRegistryLogic: StrategyRegistry = await (await deployHelper.core.deployStrategyRegistry()).deployed();
    const strategyRegistryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(
        strategyRegistryLogic.address,
        proxyAdmin.address
    );
    if (chainid != 31337) {
        await strategyRegistryLogic.deployTransaction.wait(confirmations);
        await verifyStrategyRegistry(strategyRegistryLogic.address, []);
    }
    const strategyRegistry: StrategyRegistry = await deployHelper.core.getStrategyRegistry(strategyRegistryProxy.address);
    return strategyRegistry;
}

export async function initStrategyRegistry(
    strategyRegistry: StrategyRegistry,
    signer: SignerWithAddress,
    admin: Address,
    maxStrategies: BigNumberish
) {
    let chainid = await signer.getChainId();
    if (chainid != 31337) {
        console.log('initializing strategy registry');
    }
    await (await strategyRegistry.connect(signer).initialize(admin, maxStrategies)).wait();
    return;
}

async function verifyStrategyRegistry(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/yield/StrategyRegistry.sol:StrategyRegistry',
    }).catch(console.log);
}
