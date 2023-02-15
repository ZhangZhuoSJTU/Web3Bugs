import hre from 'hardhat';
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    Environment,
    CompoundPair,
    YearnPair,
    PriceOracleSource,
    ExtensionInitParams,
    RepaymentsInitParams,
    CreditLineDefaultStrategy,
    PoolFactoryInitParams,
    CreditLineInitParams,
    VerificationParams,
} from '../utils/types';
import DeployHelper from '../utils/deploys';
import { createEnvironment } from '../utils/createEnv';
import { getPoolInitSigHash } from '../utils/createEnv/poolLogic';
import { PriceOracle } from '../typechain/PriceOracle';
import { isAddress } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IUniswapV3Factory } from '../typechain/IUniswapV3Factory';

// kovan contracts
// const Token1 = '0xa36085F69e2889c224210F603D836748e7dC0088';
// const Token2 = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa';
// const Token1Token2Pool = '0x8b1DdC6596d69bc6425492dae4710D930e1027e7';

// mainnet contracts
const Token1 = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'; // WBTC
const Token2 = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI
// const Token1Token2Pool = "0x3209C64BF470FAFEcB8b87Db3D8ac1bAa3eCF629";

const uniswapV3FactoryContract = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

describe('Checking Uniswap Price Oracle', async () => {
    let env: Environment;
    let priceOracle: PriceOracle;
    let user: SignerWithAddress;
    let uniswapV3Factory: IUniswapV3Factory;

    before(async () => {
        env = await createEnvironment(
            hre,
            [],
            [] as CompoundPair[],
            [] as YearnPair[],
            [] as PriceOracleSource[],
            {
                votingPassRatio: '1000000',
            } as ExtensionInitParams,
            {
                gracePenalityRate: '2388900000000',
                gracePeriodFraction: '100000000000000000',
            } as RepaymentsInitParams,
            {
                admin: '',
                _collectionPeriod: '290238902300000',
                _loanWithdrawalDuration: '238923897444',
                _marginCallDuration: '19028923893934',
                _gracePeriodPenaltyFraction: '278933489765478654',
                _poolInitFuncSelector: getPoolInitSigHash(),
                _liquidatorRewardFraction: '23789237834783478347834',
                _poolCancelPenalityFraction: '237823783247843783487',
                _protocolFeeFraction: '43894895489075489549',
                protocolFeeCollector: '',
                _minBorrowFraction: '3498347893489754984985',
                noStrategy: '',
            } as PoolFactoryInitParams,
            CreditLineDefaultStrategy.Compound,
            {
                _protocolFeeFraction: '378934786347863478',
                _liquidatorRewardFraction: '378945786347868735',
            } as CreditLineInitParams,
            {
                activationDelay: 0
            } as VerificationParams,
        );
        priceOracle = env.priceOracle;
        user = env.entities.borrower;
        let deployHelper = new DeployHelper(env.entities.admin);
        uniswapV3Factory = await deployHelper.mock.getIUniswapV3Factory(uniswapV3FactoryContract);
    });

    it('Check Environment', async () => {
        expect(isAddress(priceOracle.address)).to.eq(true);
    });

    it('Should return (0,0) if no price oracle is added', async () => {
        const [price, decimals] = await priceOracle.connect(user).getUniswapLatestPrice(Token2, Token1);
        expect(price).to.eq(0);
        expect(decimals).to.eq(0);
    });

    it('Add new pool and set uniswap avg period', async () => {
        let poolAddress = await uniswapV3Factory.getPool(Token1, Token2, '500');
        await priceOracle.connect(env.entities.admin).setUniswapFeedAddress(Token1, Token2, poolAddress);
        await priceOracle.connect(env.entities.admin).setUniswapPriceAveragingPeriod('1000');
    });

    it('Cannot Add pool if the tokens are same', async () => {
        let poolAddress = await uniswapV3Factory.getPool(Token1, Token2, '500');
        await expect(priceOracle.connect(env.entities.admin).setUniswapFeedAddress(Token1, Token1, poolAddress)).to.be.revertedWith(
            'token1 and token2 should be different addresses'
        );
    });

    it('Fetch prices', async () => {
        const [price, decimals] = await priceOracle.connect(user).getUniswapLatestPrice(Token1, Token2);
        expect(price).to.gt(0);
        expect(decimals).to.eq(30);
        console.log({ price: price.toString() });
        console.log({ decimals: decimals.toString() });
    });
});
