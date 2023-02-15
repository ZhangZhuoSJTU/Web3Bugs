import { Address } from 'hardhat-deploy/dist/types';
import { ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import contracts from './contracts.json';
import { AdminVerifier } from '../../typechain/AdminVerifier';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export async function verify(address: Address, metadata: string, isMasterLinked: boolean) {
    let admin: SignerWithAddress = await ethers.getSigner(contracts.admin);
    let deployHelper: DeployHelper = new DeployHelper(admin);
    const adminVerifier: AdminVerifier = await deployHelper.helper.getAdminVerifier(contracts.adminVerifier);
    await (await adminVerifier.connect(admin).registerUser(address, metadata, isMasterLinked)).wait();
}
