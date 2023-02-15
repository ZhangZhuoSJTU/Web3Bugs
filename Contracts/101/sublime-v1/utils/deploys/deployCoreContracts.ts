import { Signer } from 'ethers';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { NoYield } from '../../typechain/NoYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { CreditLine } from '../../typechain/CreditLine';
import { PooledCreditLine } from '../../typechain/PooledCreditLine';
import { LenderPool } from '../../typechain/LenderPool';

import { SavingsAccount__factory } from '../../typechain/factories/SavingsAccount__factory';
import { StrategyRegistry__factory } from '../../typechain/factories/StrategyRegistry__factory';
import { NoYield__factory } from '../../typechain/factories/NoYield__factory';
import { CompoundYield__factory } from '../../typechain/factories/CompoundYield__factory';
import { CreditLine__factory } from '../../typechain/factories/CreditLine__factory';
import { PooledCreditLine__factory } from '../../typechain/factories/PooledCreditLine__factory';
import { LenderPool__factory } from '../../typechain/factories/LenderPool__factory';

import { Address } from 'hardhat-deploy/dist/types';

export default class DeployCoreContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
    }

    public async deploySavingsAccount(): Promise<SavingsAccount> {
        return await (await new SavingsAccount__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getSavingsAccount(savingsAccountAddress: Address): Promise<SavingsAccount> {
        return await new SavingsAccount__factory(this._deployerSigner).attach(savingsAccountAddress);
    }

    public async deployStrategyRegistry(): Promise<StrategyRegistry> {
        return await (await new StrategyRegistry__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getStrategyRegistry(strategyRegistryAddress: Address): Promise<StrategyRegistry> {
        return await new StrategyRegistry__factory(this._deployerSigner).attach(strategyRegistryAddress);
    }

    public async deployNoYield(): Promise<NoYield> {
        return await (await new NoYield__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getNoYield(noYieldAddress: Address): Promise<NoYield> {
        return new NoYield__factory(this._deployerSigner).attach(noYieldAddress);
    }

    // public async deployAaveYield(weth: Address): Promise<AaveYield> {
    //     return await (await new AaveYield__factory(this._deployerSigner).deploy(weth)).deployed();
    // }

    // public async getAaveYield(aaveYieldAddress: Address): Promise<AaveYield> {
    //     return await new AaveYield__factory(this._deployerSigner).attach(aaveYieldAddress);
    // }

    public async deployCompoundYield(weth: Address): Promise<CompoundYield> {
        return await (await new CompoundYield__factory(this._deployerSigner).deploy(weth)).deployed();
    }

    public async getCompoundYield(compoundYieldAddress: Address): Promise<CompoundYield> {
        return await new CompoundYield__factory(this._deployerSigner).attach(compoundYieldAddress);
    }

    // public async deployYearnYield(weth: Address): Promise<YearnYield> {
    //     return await (await new YearnYield__factory(this._deployerSigner).deploy(weth)).deployed();
    // }

    // public async getYearnYield(yearnYieldAddress: Address): Promise<YearnYield> {
    //     return await new YearnYield__factory(this._deployerSigner).attach(yearnYieldAddress);
    // }

    public async deployCreditLines(usdc: Address): Promise<CreditLine> {
        return await (await new CreditLine__factory(this._deployerSigner).deploy(usdc)).deployed();
    }

    public async getCreditLines(creditLinesAddress: Address): Promise<CreditLine> {
        return await new CreditLine__factory(this._deployerSigner).attach(creditLinesAddress);
    }

    public async deployPooledCreditLines(lenderPoolAddress: Address, usdc: Address): Promise<PooledCreditLine> {
        return await (await new PooledCreditLine__factory(this._deployerSigner).deploy(lenderPoolAddress, usdc)).deployed();
    }

    public async getPooledCreditLines(pooledCreditLinesAddress: Address): Promise<PooledCreditLine> {
        return await new PooledCreditLine__factory(this._deployerSigner).attach(pooledCreditLinesAddress);
    }

    public async deployLenderPool(
        pooledCreditLineAddress: Address,
        savingsAccountAddress: Address,
        verificationAddress: Address,
        priceOracle: Address,
        usdc: Address
    ): Promise<LenderPool> {
        return await (
            await new LenderPool__factory(this._deployerSigner).deploy(pooledCreditLineAddress, savingsAccountAddress, verificationAddress)
        ).deployed();
    }

    public async getLenderPool(lenderPoolAddress: Address): Promise<LenderPool> {
        return await new LenderPool__factory(this._deployerSigner).attach(lenderPoolAddress);
    }
}
