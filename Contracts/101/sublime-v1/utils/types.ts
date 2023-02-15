import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { Address } from 'hardhat-deploy/dist/types';
import { Repayments } from '@typechain/Repayments';
import { PoolFactory } from '@typechain/PoolFactory';
import { CreditLine } from '@typechain/CreditLine';
import { ERC20 } from '@typechain/ERC20';
import { Verification } from '@typechain/Verification';
import { PriceOracle } from '@typechain/PriceOracle';
import { Pool } from '@typechain/Pool';
import { BigNumberish, BytesLike } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Beacon } from '@typechain/Beacon';
import { PoolEthUtils } from '@typechain/PoolEthUtils';
import { CreditLineEthUtils } from '@typechain/CreditLineEthUtils';
import { SavingsAccountEthUtils } from '@typechain/SavingsAccountEthUtils';
import { TwitterVerifier } from '@typechain/TwitterVerifier';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { PooledCreditLine } from '@typechain/PooledCreditLine';
import { LenderPool } from '@typechain/LenderPool';
import { MockCEther } from '@typechain/MockCEther';
import { MockCToken } from '@typechain/MockCToken';

export interface Environment {
    savingsAccount: SavingsAccount;
    strategyRegistry: StrategyRegistry;
    yields: Yields;
    verification: Verification;
    twitterVerifier: TwitterVerifier;
    adminVerifier: AdminVerifier;
    priceOracle: PriceOracle;
    repayments: Repayments;
    poolFactory: PoolFactory;
    beacon: Beacon;
    creditLine: CreditLine;
    entities: Entities;
    poolLogic: Pool;
    impersonatedAccounts: any[];
    mockTokenContracts: MockTokenContract[];
    inputParams: InputParams;
    poolEthUtils: PoolEthUtils;
    creditLineEthUtils: CreditLineEthUtils;
    savingsAccountEthUtils: SavingsAccountEthUtils;
    pooledCreditLines: PooledCreditLine;
    lenderPool: LenderPool;
    mockCEther: MockCEther;
    mockCToken: MockCToken;
}

export interface Entities {
    proxyAdmin: SignerWithAddress;
    admin: SignerWithAddress;
    borrower: SignerWithAddress;
    lender: SignerWithAddress;
    protocolFeeCollector: SignerWithAddress;
    extraLenders: SignerWithAddress[];
}

export interface Yields {
    aaveYield: IYield;
    yearnYield: IYield;
    compoundYield: IYield;
    noYield: IYield;
}

export interface MockTokenContract {
    name: string;
    contract: ERC20;
}

export enum CreditLineDefaultStrategy {
    Yearn,
    Compound,
    NoStrategy,
}

export interface DeploymentParams {
    signers: SignerWithAddress[];
    strategyRegistryParams: StrategyRegistryParams;
    aaveYieldParams: AaveYieldParams;
    yearnYieldPairs: YearnPair[];
    compoundPairs: CompoundPair[];
    priceFeeds: PriceOracleSource[];
    extensionInitParams: ExtensionInitParams;
    repaymentsInitParams: RepaymentsInitParams;
    poolFactoryInitParams: PoolFactoryInitParams;
    verificationParams: VerificationParams;
    weth: Address;
    usdc: Address;
}

export interface VerificationParams {
    activationDelay: BigNumberish;
}

export interface VerificationParams {
    activationDelay: BigNumberish;
}
export interface InputParams {
    extenstionInitParams: ExtensionInitParams;
    creditLineInitParams: CreditLineInitParams;
    poolFactoryInitParams: PoolFactoryInitParams;
    repaymentInitParams: RepaymentsInitParams;
    priceFeeds: PriceOracleSource[];
    supportedCompoundTokens: CompoundPair[];
    supportedYearnTokens: YearnPair[];
}

export interface ExtensionInitParams {
    votingPassRatio: BigNumberish;
}

export interface CreditLineInitParams {
    _protocolFeeFraction: BigNumberish;
    _liquidatorRewardFraction: BigNumberish;
    // protocolFeeCollector: Address;
}

export interface PoolFactoryInitParams {
    admin: Address;
    _collectionPeriod: BigNumberish;
    _loanWithdrawalDuration: BigNumberish;
    _marginCallDuration: BigNumberish;
    _liquidatorRewardFraction: BigNumberish;
    _poolCancelPenalityFraction: BigNumberish;
    _minBorrowFraction: BigNumberish;
    _protocolFeeFraction: BigNumberish;
    protocolFeeCollector: Address;
    noStrategy: Address;
    beacon: Address;
}

export interface PriceOracleSource {
    tokenAddress: Address;
    feedAggregator: Address;
}

export interface RepaymentsInitParams {
    gracePenalityRate: BigNumberish;
    gracePeriodFraction: BigNumberish;
}

export interface CompoundPair {
    asset: Address;
    liquidityToken: Address;
}

export interface YearnPair {
    asset: Address;
    liquidityToken: Address;
}

export interface PoolCreateParams {
    _poolSize: BigNumberish;
    _borrowRate: BigNumberish;
    _collateralAmount: BigNumberish;
    _collateralRatio: BigNumberish;
    _collectionPeriod: BigNumberish;
    _loanWithdrawalDuration: BigNumberish;
    _noOfRepaymentIntervals: BigNumberish;
    _repaymentInterval: BigNumberish;
}

export interface StrategyRegistryParams {
    maxStrategies: number;
}

export interface AaveYieldParams {
    wethGateway: Address;
    protocolDataProvider: Address;
    lendingPoolAddressesProvider: Address;
}

export interface ChainlinkPriceOracleData {
    token: Address;
    priceOracle: Address;
}

export interface UniswapPoolData {
    token1: Address;
    token2: Address;
    fee: BigNumberish;
}
