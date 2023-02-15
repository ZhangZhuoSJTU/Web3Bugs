import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { CreditLine } from '@typechain/CreditLine';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { PriceOracle } from '@typechain/PriceOracle';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { Address } from 'hardhat-deploy/dist/types';
import { CreditLineInitParams } from '../../utils/types';
import { creditLineFactoryParams } from '../../utils/constants';

export async function createCreditLines(proxyAdmin: SignerWithAddress): Promise<CreditLine> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let creditLineLogic: CreditLine = await deployHelper.core.deployCreditLines();
    let creditLineProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(creditLineLogic.address, proxyAdmin.address);
    let creditLine: CreditLine = await deployHelper.core.getCreditLines(creditLineProxy.address);
    return creditLine;
}

export async function initCreditLine(
    creditLine: CreditLine,
    admin: SignerWithAddress,
    defaultStrategy: Address,
    priceOracle: PriceOracle,
    savingsAccount: SavingsAccount,
    strategyRegistry: StrategyRegistry,
    creditLineInitParams: CreditLineInitParams,
    protocolFeeCollector: SignerWithAddress
) {
    await (
        await creditLine
            .connect(admin)
            .initialize(
                defaultStrategy,
                priceOracle.address,
                savingsAccount.address,
                strategyRegistry.address,
                admin.address,
                creditLineInitParams._protocolFeeFraction,
                protocolFeeCollector.address,
                creditLineInitParams._liquidatorRewardFraction
            )
    ).wait();
}
