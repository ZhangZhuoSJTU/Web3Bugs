import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Verification } from '@typechain/Verification';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { BigNumberish } from '@ethersproject/providers/node_modules/@ethersproject/bignumber';
import { VerificationParams } from '@utils/types';

export async function createVerificationWithInit(proxyAdmin: SignerWithAddress, admin: SignerWithAddress, verificationParams: VerificationParams): Promise<Verification> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let verificationLogic: Verification = await deployHelper.helper.deployVerification();
    let verificationProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(verificationLogic.address, proxyAdmin.address);
    let verification = await deployHelper.helper.getVerification(verificationProxy.address);
    await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
    return verification;
}

export async function createAdminVerifierWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    verification: Verification
): Promise<AdminVerifier> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let adminVerifierLogic: AdminVerifier = await deployHelper.helper.deployAdminVerifier();
    let adminVerifierProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(adminVerifierLogic.address, proxyAdmin.address);
    let adminVerifier = await deployHelper.helper.getAdminVerifier(adminVerifierProxy.address);
    await (await adminVerifier.connect(admin).initialize(admin.address, verification.address)).wait();
    // await verification.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')));
    return adminVerifier;
}
