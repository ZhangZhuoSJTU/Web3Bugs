import { Address } from 'hardhat-deploy/dist/types';
import { ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import contracts from './contracts.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { zeroAddress } from '../../utils/constants';

export async function addStrategy(strategy: Address) {
    let admin: SignerWithAddress = await ethers.getSigner(contracts.admin);
    let deployHelper: DeployHelper = new DeployHelper(admin);
    const strategyRegistry: StrategyRegistry = await deployHelper.core.getStrategyRegistry(contracts.strategyRegistry);
    await (await strategyRegistry.connect(admin).addStrategy(strategy)).wait();
}
