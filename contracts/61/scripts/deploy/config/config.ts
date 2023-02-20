import { ethers } from 'ethers';
import { DeploymentParams } from '../../../utils/types';

import kovanConfig from './kovan.json';
import rinkebyConfig from './rinkeby.json';

import { getPoolInitSigHash } from '../../../utils/createEnv/poolLogic';

function getConfig(network: string): DeploymentParams {
    let networkConfig;
    if (network.includes('kovan')) {
        networkConfig = kovanConfig;
    } else if (network.includes('rinkeby')) {
        networkConfig = rinkebyConfig;
    }
    return createConfig(networkConfig);
}

function createConfig(rawConfig: any): DeploymentParams {
    let config = {} as DeploymentParams;
    config.strategyRegistryParams = rawConfig.StrategyRegistry;
    config.aaveYieldParams = rawConfig.yields.aave;
    config.yearnYieldPairs = rawConfig.yields.yearn?.pairs;
    config.compoundPairs = rawConfig.yields.compound?.pairs;
    config.priceFeeds = rawConfig.priceFeeds;
    config.extensionInitParams = {
        votingPassRatio: ethers.utils.parseUnits(rawConfig.extension.votingPassRatio + '', 30),
    };
    config.repaymentsInitParams = {
        gracePenalityRate: ethers.utils.parseUnits(rawConfig.repayments.gracePenalityRate + '', 30),
        gracePeriodFraction: ethers.utils.parseUnits(rawConfig.repayments.gracePeriodFraction + '', 30),
    };
    config.poolFactoryInitParams = {
        admin: '',
        _collectionPeriod: rawConfig.poolFactory.collectionPeriod,
        _loanWithdrawalDuration: rawConfig.poolFactory.loanWithdrawalDuration,
        _marginCallDuration: rawConfig.poolFactory.marginCallDuration,
        _poolInitFuncSelector: getPoolInitSigHash(),
        _liquidatorRewardFraction: ethers.utils.parseUnits(rawConfig.poolFactory.liquidatorRewardFraction + '', 30),
        _poolCancelPenalityFraction: ethers.utils.parseUnits(rawConfig.poolFactory.poolCancelPenalityFraction + '', 30),
        _minBorrowFraction: ethers.utils.parseUnits(rawConfig.poolFactory.minBorrowFraction + '', 30),
        _protocolFeeFraction: ethers.utils.parseUnits(rawConfig.poolFactory.protocolFeeFraction + '', 30),
        protocolFeeCollector: rawConfig.poolFactory.protocolFeeCollector,
        noStrategy: ethers.constants.AddressZero,
    };
    return config;
}

export { getConfig };
