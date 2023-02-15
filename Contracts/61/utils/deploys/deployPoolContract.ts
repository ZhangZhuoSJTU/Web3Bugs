import { Signer } from 'ethers';

import { PoolFactory } from '../../typechain/PoolFactory';
import { Pool } from '../../typechain/Pool';
import { Extension } from '../../typechain/Extension';
import { Repayments } from '../../typechain/Repayments';

import { PoolFactory__factory } from '../../typechain/factories/PoolFactory__factory';
import { Pool__factory } from '../../typechain/factories/Pool__factory';
import { Extension__factory } from '../../typechain/factories/Extension__factory';
import { Repayments__factory } from '../../typechain/factories/Repayments__factory';

import { Address } from 'hardhat-deploy/dist/types';

export default class DeployPoolContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
    }

    public async deployRepayments(): Promise<Repayments> {
        return await (await new Repayments__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getRepayments(repaymentAddress: Address): Promise<Repayments> {
        return await new Repayments__factory(this._deployerSigner).attach(repaymentAddress);
    }

    public async deployExtenstion(): Promise<Extension> {
        return await (await new Extension__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getExtension(extensionAddress: Address): Promise<Extension> {
        return await new Extension__factory(this._deployerSigner).attach(extensionAddress);
    }

    public async deployPool(): Promise<Pool> {
        return await (await new Pool__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getPool(poolAddress: Address): Promise<Pool> {
        return await new Pool__factory(this._deployerSigner).attach(poolAddress);
    }

    public async deployPoolFactory(): Promise<PoolFactory> {
        return await (await new PoolFactory__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getPoolFactory(poolFactoryAddress: Address): Promise<PoolFactory> {
        return await new PoolFactory__factory(this._deployerSigner).attach(poolFactoryAddress);
    }
}
