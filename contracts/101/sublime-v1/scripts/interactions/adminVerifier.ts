import { Address } from 'hardhat-deploy/dist/types';
import { ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import contracts from './contracts.json';
import { TwitterVerifier } from '../../typechain/TwitterVerifier';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export async function verify(address: Address, metadata: string, isMasterLinked: boolean) {
    let admin: SignerWithAddress = await ethers.getSigner(contracts.admin);
    let deployHelper: DeployHelper = new DeployHelper(admin);
    const twitterVerifier: TwitterVerifier = await deployHelper.helper.getTwitterVerifier(contracts.twitterVerifier);
    // await (await twitterVerifier.connect(admin).registerSelf(address, metadata, isMasterLinked)).wait();
}
