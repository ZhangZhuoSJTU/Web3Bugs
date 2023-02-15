import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { SublimeProxy } from '@typechain/SublimeProxy';
import { Repayments } from '@typechain/Repayments';
import { PoolFactory } from '@typechain/PoolFactory';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { RepaymentsInitParams } from '@utils/types';

import { run } from 'hardhat';
const confirmations = 6;

export async function createRepaymentsWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    poolFactory: PoolFactory,
    savingsAccount: SavingsAccount,
    repaymentsInitParams: RepaymentsInitParams
): Promise<Repayments> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying repayments with init');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let repaymentLogic: Repayments = await deployHelper.pool.deployRepayments();
    let repaymentProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(repaymentLogic.address, proxyAdmin.address);
    let repayments: Repayments = await deployHelper.pool.getRepayments(repaymentProxy.address);

    if (chainid != 31337) {
        await repaymentLogic.deployTransaction.wait(confirmations);
        await verifyRepayments(repaymentLogic.address, []);
    }

    await (
        await repayments
            .connect(admin)
            .initialize(poolFactory.address, repaymentsInitParams.gracePenalityRate, repaymentsInitParams.gracePeriodFraction)
    ).wait();
    return repayments;
}

async function verifyRepayments(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/Pool/Repayments.sol:Repayments',
    }).catch(console.log);
}
