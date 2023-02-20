import { Signer } from 'ethers';

import { Verification } from '../../typechain/Verification';
import { TwitterVerifier } from '../../typechain/TwitterVerifier';
import { AdminVerifier } from '../../typechain/AdminVerifier';
import { PriceOracle } from '../../typechain/PriceOracle';
import { SublimeProxy } from '../../typechain/SublimeProxy';
import { IWETH9 } from '../../typechain/IWETH9';
import { PoolEthUtils } from '../../typechain/PoolEthUtils';
import { CreditLineEthUtils } from '../../typechain/CreditLineEthUtils';
import { SavingsAccountEthUtils } from '../../typechain/SavingsAccountEthUtils';
import { Beacon } from '../../typechain/Beacon';
import { MinimumBeaconProxy } from '../../typechain/MinimumBeaconProxy';

import { Verification__factory } from '../../typechain/factories/Verification__factory';
import { TwitterVerifier__factory } from '../../typechain/factories/TwitterVerifier__factory';
import { AdminVerifier__factory } from '../../typechain/factories/AdminVerifier__factory';
import { PriceOracle__factory } from '../../typechain/factories/PriceOracle__factory';
import { SublimeProxy__factory } from '../../typechain/factories/SublimeProxy__factory';
import { IWETH9__factory } from '../../typechain/factories/IWETH9__factory';
import { PoolEthUtils__factory } from '../../typechain/factories/PoolEthUtils__factory';
import { CreditLineEthUtils__factory } from '../../typechain/factories/CreditLineEthUtils__factory';
import { SavingsAccountEthUtils__factory } from '../../typechain/factories/SavingsAccountEthUtils__factory';
import { Beacon__factory } from '../../typechain/factories/Beacon__factory';
import { MinimumBeaconProxy__factory } from '../../typechain/factories/MinimumBeaconProxy__factory';

import { Address } from 'hardhat-deploy/dist/types';

export default class DeployHelperContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
    }

    public async deployPoolUtils(weth: Address): Promise<PoolEthUtils> {
        return await (await new PoolEthUtils__factory(this._deployerSigner).deploy(weth)).deployed();
    }

    public async getPoolUtils(contractAddress: Address): Promise<PoolEthUtils> {
        return await new PoolEthUtils__factory(this._deployerSigner).attach(contractAddress);
    }

    public async deploySavingsAccountEthUtils(weth: Address, savingsAccount: Address): Promise<SavingsAccountEthUtils> {
        return await (await new SavingsAccountEthUtils__factory(this._deployerSigner).deploy(weth, savingsAccount)).deployed();
    }

    public async getSavingsAccountEthUtils(contractAddress: Address): Promise<SavingsAccountEthUtils> {
        return await new SavingsAccountEthUtils__factory(this._deployerSigner).attach(contractAddress);
    }

    public async deployCreditLinesUtils(weth: Address, creditlines: Address): Promise<CreditLineEthUtils> {
        return await (await new CreditLineEthUtils__factory(this._deployerSigner).deploy(weth, creditlines)).deployed();
    }

    public async getCreditlinesUtils(contractAddress: Address): Promise<CreditLineEthUtils> {
        return await new CreditLineEthUtils__factory(this._deployerSigner).attach(contractAddress);
    }

    public async getIWETH9(contractAddress: Address): Promise<IWETH9> {
        return await IWETH9__factory.connect(contractAddress, this._deployerSigner);
    }

    public async deployMinimumBeaconProxy(beacon: Address): Promise<MinimumBeaconProxy> {
        return await await (await new MinimumBeaconProxy__factory(this._deployerSigner).deploy(beacon)).deployed();
    }

    public async deployBeacon(owner: Address, implementation: Address): Promise<Beacon> {
        return await await (await new Beacon__factory(this._deployerSigner).deploy(owner, implementation)).deployed();
    }

    public async deployVerification(): Promise<Verification> {
        return await (await new Verification__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getVerification(verificationAddress: Address): Promise<Verification> {
        return await new Verification__factory(this._deployerSigner).attach(verificationAddress);
    }

    public async deployTwitterVerifier(): Promise<TwitterVerifier> {
        return await (await new TwitterVerifier__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getTwitterVerifier(twitterVerifierAddress: Address): Promise<TwitterVerifier> {
        return await new TwitterVerifier__factory(this._deployerSigner).attach(twitterVerifierAddress);
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
