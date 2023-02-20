import { Signer } from 'ethers';

import { Verification } from '../../typechain/Verification';
import { AdminVerifier } from '../../typechain/AdminVerifier';
import { PriceOracle } from '../../typechain/PriceOracle';
import { SublimeProxy } from '../../typechain/SublimeProxy';

import { Verification__factory } from '../../typechain/factories/Verification__factory';
import { AdminVerifier__factory } from '../../typechain/factories/AdminVerifier__factory';
import { PriceOracle__factory } from '../../typechain/factories/PriceOracle__factory';
import { SublimeProxy__factory } from '../../typechain/factories/SublimeProxy__factory';

import { Address } from 'hardhat-deploy/dist/types';

export default class DeployHelperContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
    }

    public async deployVerification(): Promise<Verification> {
        return await (await new Verification__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getVerification(verificationAddress: Address): Promise<Verification> {
        return await new Verification__factory(this._deployerSigner).attach(verificationAddress);
    }

    public async deployAdminVerifier(): Promise<AdminVerifier> {
        return await (await new AdminVerifier__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getAdminVerifier(adminVerifierAddress: Address): Promise<AdminVerifier> {
        return await new AdminVerifier__factory(this._deployerSigner).attach(adminVerifierAddress);
    }

    public async deployPriceOracle(): Promise<PriceOracle> {
        return await (await new PriceOracle__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getPriceOracle(priceOracleAddress: Address): Promise<PriceOracle> {
        return await new PriceOracle__factory(this._deployerSigner).attach(priceOracleAddress);
    }

    public async deploySublimeProxy(logic: Address, admin: Address): Promise<SublimeProxy> {
        return await (await new SublimeProxy__factory(this._deployerSigner).deploy(logic, admin, Buffer.from(''))).deployed();
    }
    public async getSublimeProxy(proxy: Address): Promise<SublimeProxy> {
        return await new SublimeProxy__factory(this._deployerSigner).attach(proxy);
    }
}
