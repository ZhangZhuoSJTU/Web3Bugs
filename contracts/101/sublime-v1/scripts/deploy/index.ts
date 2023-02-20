import hre from 'hardhat';

import { Environment, CreditLineDefaultStrategy } from '../../utils/types';
import { createEnvironment } from '../../utils/createEnv';

async function create(): Promise<any> {
    let env: Environment = await createEnvironment(
        hre,
        [],
        [],
        [],
        [],
        { votingPassRatio: 100 },
        { gracePenalityRate: 100, gracePeriodFraction: 100000 },
        {
            admin: '',
            _collectionPeriod: 86400, // 1 day
            _loanWithdrawalDuration: 86400, // 1 day
            _marginCallDuration: 1000000, // 1 day
            _liquidatorRewardFraction: '10000000000000000', // 1%
            _poolCancelPenalityFraction: '50000000000000000', // 5%
            _protocolFeeFraction: '30000000000000000', // 3%
            _minBorrowFraction: '100000000000000000', // 10%
            protocolFeeCollector: '',
            noStrategy: '',
            beacon: '',
        },
        CreditLineDefaultStrategy.NoStrategy,
        {
            _protocolFeeFraction: '40000000000000000', // 4%
            _liquidatorRewardFraction: '20000000000000000', // 2%
        },
        {
            activationDelay: '10', // 10 SECONDS
        },
        '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
        '0xb7a4F3E9097C08dA09517b5aB877F7a917224ede',
        true
    );

    return {
        savingsAccount: env.savingsAccount.address,
        strategyRegistry: env.strategyRegistry.address,
        creditLines: env.creditLine.address,
        proxyAdmin: env.entities.proxyAdmin.address,
        admin: env.entities.admin.address,
        noYield: env.yields.noYield.address,
        compoundYield: env.yields.compoundYield.address,
        verification: env.verification.address,
        twitterVerifier: env.twitterVerifier.address,
        adminVerifier: env.adminVerifier.address,
        priceOracle: env.priceOracle.address,
        poolLogic: env.poolLogic.address,
        repaymentLogic: env.repayments.address,
        poolFactory: env.poolFactory.address,
        weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
        usdc: '0xb7a4F3E9097C08dA09517b5aB877F7a917224ede',
        beacon: env.beacon.address,
        poolUtils: env.poolEthUtils.address,
        creditLineUtils: env.creditLineEthUtils.address,
        savingsAccountEthUtils: env.savingsAccountEthUtils.address,
        lenderPool: env.lenderPool.address,
        pooledCreditlines: env.pooledCreditLines.address,
        mockCEther: env.mockCEther.address,
        mockCToken: env.mockCToken.address,
    };
}

create().then(console.log);

// const contracts = {
//     savingsAccount: '0xD6d63E8c09175c3376C1E821f5EB92Ae451F9F51',
//     strategyRegistry: '0xc0C61AEf0157a14d6A614338AE45ad367b0C29b2',
//     creditLines: '0xBfd6CBa35dAe51Fdfc7DfDa07F734cA19d77945d',
//     proxyAdmin: '0x8DB2Ba87D5b08EE7f148558bdF8a6cD00b0441d0',
//     admin: '0xB63daad540f34Ada56da3390f2b9A9778bEe9066',
//     noYield: '0xD3601D2ec149B4acC1b8859018CC2c7d4A4c761D',
//     compoundYield: '0xf3230131FAF5228d86aaE867fd09048D19c9d8ad',
//     verification: '0x95d7f35D81864176E72C6f946C02DdECe5483848',
//     twitterVerifier: '0x18136Ce770DD1b36487FFEcC818723579e1487ED',
//     adminVerifier: '0xC41A02F2D07d35dA2257627669bE1eb9169C4350',
//     priceOracle: '0xC2FabB041cC93C5E7E2761fe3F06007099e4cD59',
//     poolLogic: '0xfAFAF2DdA5e89A64Dfd1Ee35AEEC4052B4Ad16cd',
//     repaymentLogic: '0xAbDd0A4F7A7f608C9b1178A5F961132053E99de5',
//     poolFactory: '0xF447EBA6eD9E5723157b9D660151C290B1Be0f93',
//     weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
//     usdc: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
//     beacon: '0x98bDE44681463Ae20991B0e46f6CAef445F7a292',
//     poolUtils: '0x5350EA7BD5c8524852da5334da4c247Aa76d7f2D',
//     creditLineUtils: '0xD9511d43C263Ae262c3683Bad2b86732e1582Ae3',
//     savingsAccountEthUtils: '0xD5E7BB66e28A9F11534Ac9A619FdAC092378f528',
//     lenderPool: '0x88c4Ca8891bC14134C1Cf455a5D0c883e0b08753',
//     pooledCreditlines: '0x6f741DF66595A87c48E187138Deaf65C96121A46',
//     mockCEther: '0x7a11609373dF44D8643bDed65183D0f496fA873E',
//     mockCToken: '0x2afeeA631110f42E8ec33229b5eC4B5029Ca3A2f'
//   };
