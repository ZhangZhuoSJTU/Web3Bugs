import { Address } from 'hardhat-deploy/dist/types';
import { BytesLike, BigNumber } from 'ethers';

import { getPoolAddress } from '../../utils/helpers';
import DeployHelper from '../../utils/deploys';
import { PoolFactory } from '../../typechain/PoolFactory';
import { zeroAddress } from '../../utils/constants';
import { PoolCreateParams } from '../../utils/types';
import { Contracts, PoolData } from './types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20 } from '../../typechain/ERC20';

export async function precalculatePoolAddress(poolData: PoolData, contracts: Contracts): Promise<Address> {
    const { borrower, borrowToken, collateralToken, strategy, salt, transferFromSavingsAccount, poolCreateParams } = poolData;

    let generatedPoolAddress = await getPoolAddress(
        borrower.address,
        borrowToken,
        collateralToken,
        strategy,
        contracts.poolFactory,
        salt,
        contracts.poolLogic,
        transferFromSavingsAccount,
        {
            _poolSize: BigNumber.from(poolCreateParams._poolSize),
            _borrowRate: BigNumber.from(poolCreateParams._borrowRate),
            _collateralAmount: BigNumber.from(poolCreateParams._collateralAmount),
            _collateralRatio: BigNumber.from(poolCreateParams._collateralRatio),
            _collectionPeriod: BigNumber.from(poolCreateParams._collectionPeriod),
            _loanWithdrawalDuration: BigNumber.from(poolCreateParams._loanWithdrawalDuration),
            _noOfRepaymentIntervals: BigNumber.from(poolCreateParams._noOfRepaymentIntervals),
            _repaymentInterval: BigNumber.from(poolCreateParams._repaymentInterval),
        }
    );

    return generatedPoolAddress;
}

export async function deployPool(poolFactory: PoolFactory, poolData: PoolData, contracts: Contracts) {
    const { borrower, borrowToken, collateralToken, strategy, salt, transferFromSavingsAccount, poolCreateParams } = poolData;

    await (
        await poolFactory
            .connect(borrower)
            .createPool(
                poolCreateParams._poolSize,
                poolCreateParams._borrowRate,
                borrowToken,
                collateralToken,
                poolCreateParams._collateralRatio,
                poolCreateParams._repaymentInterval,
                poolCreateParams._noOfRepaymentIntervals,
                strategy,
                poolCreateParams._collateralAmount,
                transferFromSavingsAccount,
                salt,
                contracts.adminVerifier,
                zeroAddress,
                { value: collateralToken === zeroAddress ? poolCreateParams._collateralAmount : 0 }
            )
    ).wait();
}

export async function createPool(poolData: PoolData, contracts: Contracts) {
    let deployHelper: DeployHelper = new DeployHelper(poolData.borrower);
    const poolAddress: Address = await precalculatePoolAddress(poolData, contracts);

    if (poolData.collateralToken != zeroAddress) {
        const collateralToken: ERC20 = await deployHelper.mock.getMockERC20(poolData.collateralToken);

        await (await collateralToken.connect(poolData.borrower).approve(poolAddress, poolData.poolCreateParams._poolSize)).wait();
    }

    let poolFactory: PoolFactory = await deployHelper.pool.getPoolFactory(contracts.poolFactory);
    console.log('deploying pool ', poolAddress);
    await deployPool(poolFactory, poolData, contracts);
}
