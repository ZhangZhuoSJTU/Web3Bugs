import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Extension } from '@typechain/Extension';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { PoolFactory } from '@typechain/PoolFactory';
import { ExtensionInitParams } from '@utils/types';

export async function createExtenstionWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    poolFactory: PoolFactory,
    extensionInitParams: ExtensionInitParams
): Promise<Extension> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let extenstionLogic: Extension = await deployHelper.pool.deployExtenstion();
    let extenstionProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(extenstionLogic.address, proxyAdmin.address);
    let extenstion: Extension = await deployHelper.pool.getExtension(extenstionProxy.address);
    await (await extenstion.connect(admin).initialize(poolFactory.address, extensionInitParams.votingPassRatio)).wait();
    return extenstion;
}
