import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createEnvironment } from '../../utils/createEnv';
import { CreditLineDefaultStrategy, Environment } from '../../utils/types';

import hre from 'hardhat';
import { CreditLine } from '../../typechain/CreditLine';
import { Contracts } from '../../existingContracts/compound.json';
const { waffle } = hre;
const { loadFixture } = waffle;

describe('Credit Lines with No Yield', async () => {
    let env: Environment;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraLenders: SignerWithAddress[];
    let creditLine: CreditLine;

    async function fixture() {
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
                _collectionPeriod: 1000000,
                _loanWithdrawalDuration: 1000000,
                _marginCallDuration: 1000000,
                _liquidatorRewardFraction: 1000000,
                _poolCancelPenalityFraction: 10000000,
                _protocolFeeFraction: 10000000,
                protocolFeeCollector: '',
                _minBorrowFraction: 100000000,
                noStrategy: '',
                beacon: '',
            },
            CreditLineDefaultStrategy.NoStrategy,
            {
                _protocolFeeFraction: 10000000,
                _liquidatorRewardFraction: 1000000000,
            },
            {
                activationDelay: 1000000000,
            },
            Contracts.WETH,
            Contracts.USDC
        );
        return {
            env,
            admin: env.entities.admin,
            borrower: env.entities.borrower,
            lender: env.entities.lender,
            protocolFeeCollector: env.entities.protocolFeeCollector,
            extraLenders: env.entities.extraLenders,
        };
    }

    beforeEach(async () => {
        let result = await loadFixture(fixture);
        env = result.env;
        admin = result.admin;
        borrower = result.borrower;
        lender = result.lender;
        protocolFeeCollector = result.protocolFeeCollector;
        extraLenders = result.extraLenders;
        creditLine = result.env.creditLine;
    });

    it('Test 1', async () => {});
    it('Test 2', async () => {});
    it('Test 3', async () => {});
});
