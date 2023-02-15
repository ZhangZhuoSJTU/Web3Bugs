import { BytesLike } from '@ethersproject/providers/node_modules/@ethersproject/bytes';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Address } from 'hardhat-deploy/dist/types';
import { PoolCreateParams } from '../../utils/types';

export interface Contracts {
    savingsAccount: Address;
    strategyRegistry: Address;
    creditLines: Address;
    proxyAdmin: Address;
    admin: Address;
    aaveYield: Address;
    compoundYield: Address;
    verification: Address;
    twitterVerifier: Address;
    priceOracle: Address;
    extension: Address;
    poolLogic: Address;
    repaymentLogic: Address;
    poolFactory: Address;
}

export interface PoolData {
    borrower: SignerWithAddress;
    borrowToken: Address;
    collateralToken: Address;
    strategy: Address;
    salt: BytesLike;
    transferFromSavingsAccount: boolean;
    poolCreateParams: PoolCreateParams;
}
