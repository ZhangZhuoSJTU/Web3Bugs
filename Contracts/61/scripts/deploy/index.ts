import { deployer } from './deploy';
import { getConfig } from './config/config';
import { DeploymentParams } from '../../utils/types';

import { ethers, network } from 'hardhat';

async function deploy(network: string) {
    const signers = await ethers.getSigners();
    console.log(signers[0].address, signers[1].address, signers[2].address);
    const config: DeploymentParams = getConfig(network);
    const deployedData = await deployer(signers, config);
    console.log(JSON.stringify(deployedData, null, 2));
}

deploy(network.name);
