import { Signer } from 'ethers';

import { PoolFactory } from '../../typechain/PoolFactory';
import { Pool } from '../../typechain/Pool';
import { Repayments } from '../../typechain/Repayments';

import { PoolFactory__factory } from '../../typechain/factories/PoolFactory__factory';
import { Pool__factory } from '../../typechain/factories/Pool__factory';
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

    public async deployPool(priceOracle: Address, savingsAccount: Address, repayment: Address): Promise<Pool> {
        return await (await new Pool__factory(this._deployerSigner).deploy(priceOracle, savingsAccount, repayment)).deployed();
    }

    public async getPool(poolAddress: Address): Promise<Pool> {
        return await new Pool__factory(this._deployerSigner).attach(poolAddress);
    }

    public async deployPoolFactory(usdcContract: Address): Promise<PoolFactory> {
        return await (await new PoolFactory__factory(this._deployerSigner).deploy(usdcContract)).deployed();
    }

    public async getPoolFactory(poolFactoryAddress: Address): Promise<PoolFactory> {
        return await new PoolFactory__factory(this._deployerSigner).attach(poolFactoryAddress);
    }
}
