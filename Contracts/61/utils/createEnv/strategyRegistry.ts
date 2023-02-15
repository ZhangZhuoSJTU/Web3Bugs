import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { BigNumberish } from 'ethers';
import { Address } from 'hardhat-deploy/dist/types';

export async function createStrategyRegistry(proxyAdmin: SignerWithAddress): Promise<StrategyRegistry> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    const strategyRegistryLogic: StrategyRegistry = await (await deployHelper.core.deployStrategyRegistry()).deployed();
    const strategyRegistryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(
        strategyRegistryLogic.address,
        proxyAdmin.address
    );
    const strategyRegistry: StrategyRegistry = await deployHelper.core.getStrategyRegistry(strategyRegistryProxy.address);
    return strategyRegistry;
}

export async function initStrategyRegistry(
    strategyRegistry: StrategyRegistry,
    signer: SignerWithAddress,
    admin: Address,
    maxStrategies: BigNumberish
) {
    await strategyRegistry.connect(signer).initialize(admin, maxStrategies);
    return;
}
