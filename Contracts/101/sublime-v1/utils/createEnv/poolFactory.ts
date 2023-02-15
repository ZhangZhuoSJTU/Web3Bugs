import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PoolFactory } from '@typechain/PoolFactory';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { Repayments } from '@typechain/Repayments';
import { Verification } from '@typechain/Verification';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { PriceOracle } from '@typechain/PriceOracle';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { PoolFactoryInitParams } from '../../utils/types';
import { zeroAddress } from '../../config/constants';
import { Beacon } from '@typechain/Beacon';

import { run } from 'hardhat';
import { MockCToken } from '@typechain/MockCToken';
const confirmations = 6;

export async function createBeacon(proxyAdmin: SignerWithAddress, owner: Address, implementation: Address): Promise<Beacon> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying beacon');
    }
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let beacon: Beacon = await deployHelper.helper.deployBeacon(owner, implementation);

    if (chainid != 31337) {
        await beacon.deployTransaction.wait(confirmations);
        await verifyBeacon(beacon.address, [owner, implementation]);
    }
    return beacon;
}

async function verifyBeacon(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/Pool/Beacon.sol:Beacon',
    }).catch(console.log);
}

async function verifyPoolFactory(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/Pool/PoolFactory.sol:PoolFactory',
    }).catch(console.log);
}

export async function createPoolFactory(proxyAdmin: SignerWithAddress, usdc: Address): Promise<PoolFactory> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying pool factory');
    }
    let poolFactoryLogic: PoolFactory = await deployHelper.pool.deployPoolFactory(usdc);
    let poolFactoryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(poolFactoryLogic.address, proxyAdmin.address);
    let poolFactory: PoolFactory = await deployHelper.pool.getPoolFactory(poolFactoryProxy.address);

    if (chainid != 31337) {
        await poolFactoryLogic.deployTransaction.wait(confirmations);
        await verifyPoolFactory(poolFactoryLogic.address, [usdc]);
    }
    return poolFactory;
}

export async function initPoolFactory(poolFactory: PoolFactory, signer: SignerWithAddress, initParams: PoolFactoryInitParams) {
    let {
        admin,
        _collectionPeriod,
        _loanWithdrawalDuration,
        _marginCallDuration,
        _liquidatorRewardFraction,
        _poolCancelPenalityFraction,
        _minBorrowFraction,
        _protocolFeeFraction,
        protocolFeeCollector,
        noStrategy,
        beacon,
    } = initParams;
    let chainid = await signer.getChainId();
    if (chainid != 31337) {
        console.log('initializing pool factory');
    }
    await (
        await poolFactory
            .connect(signer)
            .initialize(
                admin,
                _collectionPeriod,
                _loanWithdrawalDuration,
                _marginCallDuration,
                _liquidatorRewardFraction,
                _poolCancelPenalityFraction,
                _minBorrowFraction,
                _protocolFeeFraction,
                protocolFeeCollector,
                noStrategy,
                beacon
            )
    ).wait();
}

export async function addSupportedTokens(
    poolFactory: PoolFactory,
    admin: SignerWithAddress,
    collateralTokens: Address[],
    borrowTokens: Address[],
    mockCTokens: MockCToken[]
) {
    let chainid = await admin.getChainId();
    for (let index = 0; index < collateralTokens.length; index++) {
        const col = collateralTokens[index];
        if (chainid != 31337) {
            console.log(`adding collateral token support ${col}`);
        }
        await (await poolFactory.connect(admin).updateSupportedCollateralTokens(col, true)).wait();
    }
    for (let index = 0; index < borrowTokens.length; index++) {
        const bor = borrowTokens[index];
        if (chainid != 31337) {
            console.log(`adding borrow token support ${bor}`);
        }
        await (await poolFactory.connect(admin).updateSupportedBorrowTokens(bor, true)).wait();
    }

    if (chainid == 31337 || chainid == 1) {
        return;
    } else {
        for (let index = 0; index < mockCTokens.length; index++) {
            const element = mockCTokens[index];
            let underlyingToken = await element.underlying();
            await (await poolFactory.connect(admin).updateSupportedBorrowTokens(underlyingToken, true)).wait();
        }
    }
}

export async function setImplementations(
    poolFactory: PoolFactory,
    admin: SignerWithAddress,
    repayments: Repayments,
    verification: Verification,
    strategyRegistry: StrategyRegistry,
    priceOracle: PriceOracle,
    savingsAccount: SavingsAccount
) {
    let chainid = await admin.getChainId();
    if (chainid != 31337) {
        console.log('set pool factory implementations');
    }
    await (
        await poolFactory
            .connect(admin)
            .setImplementations(
                repayments.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address
            )
    ).wait();
}
