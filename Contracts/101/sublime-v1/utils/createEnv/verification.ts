import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Verification } from '@typechain/Verification';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { TwitterVerifier } from '@typechain/TwitterVerifier';

import { MockTwitterVerifier__factory } from '../../typechain/factories/MockTwitterVerifier__factory';

import { VerificationParams } from '@utils/types';
import { BigNumberish } from 'ethers';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { AdminVerifier__factory } from '../../typechain/factories/AdminVerifier__factory';

import { run } from 'hardhat';
const confirmations = 6;

export async function createVerificationWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    verificationParams: VerificationParams
): Promise<Verification> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying verification with init');
    }
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let verificationLogic: Verification = await deployHelper.helper.deployVerification();
    let verificationProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(verificationLogic.address, proxyAdmin.address);
    let verification = await deployHelper.helper.getVerification(verificationProxy.address);
    if (chainid != 31337) {
        await verificationLogic.deployTransaction.wait(confirmations);
        await verifyVerification(verificationLogic.address, [], 'contracts/Verification/Verification.sol:Verification');
    }
    await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
    return verification;
}

export async function createTwitterVerifierWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    verification: Verification,
    signValidity: BigNumberish,
    name: string,
    version: string
): Promise<TwitterVerifier> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying twitter verifier');
    }
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let twitterVerifierLogic: TwitterVerifier = await deployHelper.helper.deployTwitterVerifier();
    let twitterVerifierProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(twitterVerifierLogic.address, proxyAdmin.address);
    let twitterVerifier = await deployHelper.helper.getTwitterVerifier(twitterVerifierProxy.address);

    if (chainid != 31337) {
        await twitterVerifierLogic.deployTransaction.wait(confirmations);
        await verifyVerification(twitterVerifierLogic.address, [], 'contracts/Verification/twitterVerifier.sol:TwitterVerifier');
    }

    await (await twitterVerifier.connect(admin).initialize(admin.address, verification.address, admin.address, name, version)).wait();
    // await verification.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')));
    return twitterVerifier;
}

export async function createAdminVerifierWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    verification: Verification,
    signValidity: BigNumberish,
    name: string,
    version: string
): Promise<AdminVerifier> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying admin verifier');
    }
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let adminVerifierLogic: AdminVerifier = await deployHelper.helper.deployAdminVerifier();
    let adminVerifierProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(adminVerifierLogic.address, proxyAdmin.address);
    let adminVerifier = await deployHelper.helper.getAdminVerifier(adminVerifierProxy.address);

    if (chainid != 31337) {
        await adminVerifierLogic.deployTransaction.wait(confirmations);
        await verifyVerification(adminVerifierLogic.address, [], 'contracts/Verification/adminVerifier.sol:AdminVerifier');
    }

    await (
        await adminVerifier.connect(admin).initialize(admin.address, verification.address, admin.address, signValidity, name, version)
    ).wait();
    return adminVerifier;
}

export async function addUserToTwitterVerifier(
    twitterVerifier: TwitterVerifier,
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    user: string
): Promise<void> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('adding user to twitter verifier');
    }
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let proxy = await deployHelper.helper.getSublimeProxy(twitterVerifier.address);
    let oldImplementation = await proxy.callStatic.implementation();
    let mockTwitterVerifier = await (await new MockTwitterVerifier__factory(admin).deploy()).deployed();
    if (chainid != 31337) {
        console.log('upgrading to mock verifier');
    }
    await (await proxy.upgradeTo(mockTwitterVerifier.address)).wait();
    mockTwitterVerifier = await new MockTwitterVerifier__factory(admin).attach(proxy.address);
    if (chainid != 31337) {
        console.log('registering user');
    }
    await (await mockTwitterVerifier.connect(admin).registerUserViaOwner(true, user, 'twitter id', 'tweet id')).wait();
    if (chainid != 31337) {
        console.log('switching back to old implementation');
    }
    await (await proxy.connect(proxyAdmin).upgradeTo(oldImplementation)).wait();
}

async function verifyVerification(address: string, constructorArguments: any[], contractPath: string) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: contractPath,
    }).catch(console.log);
}
