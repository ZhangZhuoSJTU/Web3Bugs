import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { SublimeProxy } from '@typechain/SublimeProxy';
import { Repayments } from '@typechain/Repayments';
import { PoolFactory } from '@typechain/PoolFactory';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { RepaymentsInitParams } from '@utils/types';

export async function createRepaymentsWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    poolFactory: PoolFactory,
    savingsAccount: SavingsAccount,
    repaymentsInitParams: RepaymentsInitParams
): Promise<Repayments> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let repaymentLogic: Repayments = await deployHelper.pool.deployRepayments();
    let repaymentProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(repaymentLogic.address, proxyAdmin.address);
    let repayments: Repayments = await deployHelper.pool.getRepayments(repaymentProxy.address);

    await repayments
        .connect(admin)
        .initialize(poolFactory.address, repaymentsInitParams.gracePenalityRate, repaymentsInitParams.gracePeriodFraction);
    return repayments;
}
