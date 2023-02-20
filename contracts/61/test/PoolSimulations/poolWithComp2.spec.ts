import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../utils/createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    VerificationParams,
    YearnPair,
} from '../../utils/types';
import hre from 'hardhat';
import { Contracts } from '../../existingContracts/compound.json';

import {
    WBTCWhale,
    WhaleAccount,
    Binance7,
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    creditLineFactoryParams,
    verificationParams,
} from '../../utils/constants';

import DeployHelper from '../../utils/deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

describe('Pool With Compound Strategy 2', async () => {
    let env: Environment;
    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: Contracts.DAI, liquidityToken: Contracts.cDAI },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.DAI, feedAggregator: ChainLinkAggregators['DAI/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
            ] as PriceOracleSource[],
            {
                votingPassRatio: extensionParams.votingPassRatio,
            } as ExtensionInitParams,
            {
                gracePenalityRate: repaymentParams.gracePenalityRate,
                gracePeriodFraction: repaymentParams.gracePeriodFraction,
            } as RepaymentsInitParams,
            {
                admin: '',
                _collectionPeriod: testPoolFactoryParams._collectionPeriod,
                _loanWithdrawalDuration: testPoolFactoryParams._loanWithdrawalDuration,
                _marginCallDuration: testPoolFactoryParams._marginCallDuration,
                _gracePeriodPenaltyFraction: testPoolFactoryParams._gracePeriodPenaltyFraction,
                _poolInitFuncSelector: getPoolInitSigHash(),
                _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                protocolFeeCollector: '',
                _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                noStrategy: '',
            } as PoolFactoryInitParams,
            CreditLineDefaultStrategy.Compound,
            {
                _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction,
            } as CreditLineInitParams,
            {
                activationDelay: verificationParams.activationDelay
            } as VerificationParams,
        );
    });

    it('Sample', async function () {
        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
        let { admin, borrower, lender } = env.entities;
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let DAI: ERC20 = await deployHelper.mock.getMockERC20(Contracts.DAI);
        let WBTC: ERC20 = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield: IYield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let poolAddress = await calculateNewPoolAddress(env, DAI, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(18)),
            _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(8)),
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ calculatedPoolAddress: poolAddress });

        console.log(env.mockTokenContracts[1].name);
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, '100000000');

        let pool = await createNewPool(env, DAI, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(18)),
            _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(8)),
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ actualPoolAddress: pool.address });
    });
});
