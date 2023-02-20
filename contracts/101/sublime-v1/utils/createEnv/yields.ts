import { CompoundYield } from '@typechain/CompoundYield';
import { NoYield } from '@typechain/NoYield';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';

import { aaveYieldParams as defaultAaveYieldParams, zeroAddress } from '../../config/constants';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { AaveYieldParams, CompoundPair, YearnPair } from '../../utils/types';
import { IYield } from '@typechain/IYield';
import { IYield__factory } from '../../typechain/factories/IYield__factory';
import { BigNumber } from 'ethers';

import { run } from 'hardhat';
import { MockCToken } from '@typechain/MockCToken';
import { MockCEther } from '@typechain/MockCEther';
const confirmations = 6;

// export async function createAaveYieldWithInit(
//     proxyAdmin: SignerWithAddress,
//     admin: SignerWithAddress,
//     savingsAccount: SavingsAccount,
//     weth: Address,
//     aaveYieldParams?: AaveYieldParams
// ): Promise<IYield> {
//     let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);

//     let aaveYieldLogic: AaveYield = await deployHelper.core.deployAaveYield(weth);
//     let aaveYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(aaveYieldLogic.address, proxyAdmin.address);
//     let aaveYield: AaveYield = await deployHelper.core.getAaveYield(aaveYieldProxy.address);

//     if (!aaveYieldParams) {
//         aaveYieldParams = {
//             wethGateway: defaultAaveYieldParams._wethGateway,
//             protocolDataProvider: defaultAaveYieldParams._protocolDataProvider,
//             lendingPoolAddressesProvider: defaultAaveYieldParams._lendingPoolAddressesProvider,
//         };
//     }

//     await (
//         await aaveYield
//             .connect(admin)
//             .initialize(
//                 admin.address,
//                 savingsAccount.address,
//                 aaveYieldParams.wethGateway,
//                 aaveYieldParams.protocolDataProvider,
//                 aaveYieldParams.lendingPoolAddressesProvider
//             )
//     ).wait();

//     return IYield__factory.connect(aaveYield.address, admin);
// }

export async function deployMockCompoundTokens(proxyAdmin: SignerWithAddress, admin: SignerWithAddress): Promise<[MockCToken, MockCEther]> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let chainid = await proxyAdmin.getChainId();
    if (chainid == 31337 || chainid == 1) {
        return [await deployHelper.mock.getMockCToken(zeroAddress), await deployHelper.mock.getMockCEther(zeroAddress)];
    }

    console.log('Deploying mock usd');
    let mockUnderlyingToken1 = await deployHelper.mock.deployToken('Mock USD', 'MoUSD', '1000000000000000000000000', admin.address);
    console.log('deploying mock cusd');
    let mockCToken1 = await deployHelper.mock.deployMockCToken(mockUnderlyingToken1.address);
    console.log('deploying mock ceth');
    let mockEther = await deployHelper.mock.deployMockCEther();

    await mockEther.deployTransaction.wait(6);

    await verifyYield(
        mockUnderlyingToken1.address,
        ['Mock USD', 'MoUSD', '18', '1000000000000000000000000', admin.address],
        'contracts/mocks/Token.sol:Token'
    );
    await verifyYield(mockCToken1.address, [mockUnderlyingToken1.address], 'contracts/mocks/MockCToken.sol:MockCToken');
    await verifyYield(mockEther.address, [], 'contracts/mocks/MockCEther.sol:MockCEther');

    return [mockCToken1, mockEther];
}

export async function createCompoundYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount,
    pairs: CompoundPair[],
    weth: Address,
    mockCTokens: MockCToken[]
): Promise<IYield> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying compound yield with init');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let compoundYieldLogic: CompoundYield = await deployHelper.core.deployCompoundYield(weth);
    let compoundYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(compoundYieldLogic.address, proxyAdmin.address);
    if (chainid != 31337) {
        await compoundYieldLogic.deployTransaction.wait(confirmations);
        await verifyYield(compoundYieldLogic.address, [weth], 'contracts/yield/CompoundYield.sol:CompoundYield');
    }
    let compoundYield: CompoundYield = await deployHelper.core.getCompoundYield(compoundYieldProxy.address);

    await (await compoundYield.connect(admin).initialize(admin.address, savingsAccount.address)).wait();

    for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];
        if (chainid != 31337) {
            console.log('adding pair to compound yield', pair.asset, pair.liquidityToken);
        }
        await (await compoundYield.connect(admin).updateTokenAddresses(pair.asset, pair.liquidityToken)).wait();
        if (chainid != 31337) {
            console.log('setting limit');
        }
        await (await compoundYield.connect(admin).setDepositLimit(pair.asset, BigNumber.from(10).pow(77))).wait(); // set to almost max uint
    }

    if (chainid == 31337 || chainid == 1) {
    } else {
        for (let index = 0; index < mockCTokens.length; index++) {
            const element = mockCTokens[index];
            let underlying = await element.underlying();
            await (await compoundYield.connect(admin).updateTokenAddresses(underlying, element.address)).wait();
            await (await compoundYield.connect(admin).setDepositLimit(underlying, BigNumber.from(10).pow(77))).wait(); // set to almost max uint
        }
    }
    return IYield__factory.connect(compoundYield.address, admin);
}

// export async function createYearnYieldWithInit(
//     proxyAdmin: SignerWithAddress,
//     admin: SignerWithAddress,
//     savingsAccount: SavingsAccount,
//     pairs: YearnPair[],
//     weth: Address
// ): Promise<IYield> {
//     let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
//     let yearnYieldLogic: YearnYield = await deployHelper.core.deployYearnYield(weth);
//     let yearnYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(yearnYieldLogic.address, proxyAdmin.address);
//     let yearnYield: YearnYield = await deployHelper.core.getYearnYield(yearnYieldProxy.address);

//     await (await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address)).wait();

//     for (let index = 0; index < pairs.length; index++) {
//         const pair = pairs[index];
//         await (await yearnYield.connect(admin).updateProtocolAddresses(pair.asset, pair.liquidityToken)).wait();
//     }
//     return IYield__factory.connect(yearnYield.address, admin);
// }

export async function createNoYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount
): Promise<IYield> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying no yield with init');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let noYieldLogic: NoYield = await deployHelper.core.deployNoYield();
    let noYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(noYieldLogic.address, proxyAdmin.address);
    if (chainid != 31337) {
        await noYieldLogic.deployTransaction.wait(confirmations);
        await verifyYield(noYieldLogic.address, [], 'contracts/yield/NoYield.sol:NoYield');
    }
    let noYield: NoYield = await deployHelper.core.getNoYield(noYieldProxy.address);
    await (await noYield.connect(admin).initialize(admin.address, savingsAccount.address)).wait();

    return IYield__factory.connect(noYield.address, admin);
}

async function verifyYield(address: string, constructorArguments: any[], contractPath: string) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: contractPath,
    }).catch(console.log);
}
