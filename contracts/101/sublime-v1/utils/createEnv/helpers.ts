import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CreditLineEthUtils } from '@typechain/CreditLineEthUtils';
import { MinimumBeaconProxy } from '@typechain/MinimumBeaconProxy';
import { PoolEthUtils } from '@typechain/PoolEthUtils';
import { SavingsAccountEthUtils } from '@typechain/SavingsAccountEthUtils';
import { Address } from 'hardhat-deploy/dist/types';
import DeployHelper from '../deploys';

import { run } from 'hardhat';
const confirmations = 6;

export async function createPoolUtils(proxyAdmin: SignerWithAddress, weth: Address): Promise<PoolEthUtils> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploy pool utils');
    }
    let deployHeler: DeployHelper = new DeployHelper(proxyAdmin);

    let utils = await deployHeler.helper.deployPoolUtils(weth);
    if (chainid != 31337) {
        await utils.deployTransaction.wait(confirmations);
        await verifyPoolUtils(utils.address, [weth.toString()]);
    }

    return utils;
}

async function verifyPoolUtils(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/Pool/PoolEthUtils.sol:PoolEthUtils',
    }).catch(console.log);
}

export async function createCreditLineUtils(
    proxyAdmin: SignerWithAddress,
    weth: Address,
    creditLineContractAddress: Address
): Promise<CreditLineEthUtils> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying credit line eth utils');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let utils = await deployHelper.helper.deployCreditLinesUtils(weth, creditLineContractAddress);
    if (chainid != 31337) {
        await utils.deployTransaction.wait(confirmations);
        await verifyCreditLineUtils(utils.address, [weth.toString(), creditLineContractAddress.toString()]);
    }

    return utils;
}

async function verifyCreditLineUtils(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/CreditLine/CreditLineEthUtils.sol:CreditLineEthUtils',
    }).catch(console.log);
}

export async function createSavingsAccountEthUtils(
    proxyAdmin: SignerWithAddress,
    weth: Address,
    savingsAccountContractAddress: Address
): Promise<SavingsAccountEthUtils> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying savings account eth utils');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let utils = await deployHelper.helper.deploySavingsAccountEthUtils(weth, savingsAccountContractAddress);

    if (chainid != 31337) {
        await utils.deployTransaction.wait(confirmations);
        await verifySavingsAccountUtils(utils.address, [weth.toString(), savingsAccountContractAddress.toString()]);
    }

    return utils;
}

async function verifySavingsAccountUtils(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/SavingsAccount/SavingsAccountEthUtils.sol:SavingsAccountEthUtils',
    }).catch(console.log);
}

export async function deployMinimumBeaconProxy(proxyAdmin: SignerWithAddress, beaconAddress: Address): Promise<MinimumBeaconProxy> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying minimum beacon proxy');
    }
    let utils = await deployHelper.helper.deployMinimumBeaconProxy(beaconAddress);
    if (chainid != 31337) {
        await utils.deployTransaction.wait(confirmations);
        await verifyMinimumBeaconProxy(utils.address, [beaconAddress]);
    }

    return utils;
}

async function verifyMinimumBeaconProxy(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/Pool/MinimumBeaconProxy2.sol:MinimumBeaconProxy',
    }).catch(console.log);
}
