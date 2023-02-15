import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Pool } from '@typechain/Pool';
import poolContractMeta from '../../artifacts/contracts/Pool/Pool.sol/Pool.json';
import { BytesLike } from '@ethersproject/providers/node_modules/@ethersproject/bytes';
import { ethers } from 'ethers';

export async function createPool(proxyAdmin: SignerWithAddress): Promise<Pool> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let pool: Pool = await deployHelper.pool.deployPool();
    return pool;
}

export function getPoolInitSigHash(): BytesLike {
    const _interface = new ethers.utils.Interface(poolContractMeta.abi);
    const poolInitializeSigHash = _interface.getSighash('initialize');
    return poolInitializeSigHash;
}
