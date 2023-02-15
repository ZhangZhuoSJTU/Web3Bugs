import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Pool } from '@typechain/Pool';
import { Address } from 'hardhat-deploy/dist/types';

import { run } from 'hardhat';
const confirmations = 6;

export async function createPool(
    proxyAdmin: SignerWithAddress,
    priceOracle: Address,
    savingsAccount: Address,
    repaymentImpl: Address
): Promise<Pool> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying pool logic');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let pool: Pool = await deployHelper.pool.deployPool(priceOracle, savingsAccount, repaymentImpl);
    if (chainid != 31337) {
        await pool.deployTransaction.wait(confirmations);
        await verifyPool(pool.address, [priceOracle, savingsAccount, repaymentImpl]);
    }
    return pool;
}

async function verifyPool(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/Pool/Pool.sol:Pool',
    }).catch(console.log);
}
