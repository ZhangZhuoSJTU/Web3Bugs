import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { LenderPool } from '@typechain/LenderPool';

import { PooledCreditLine } from '@typechain/PooledCreditLine';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { BigNumber } from 'ethers';
import { Address } from 'hardhat-deploy/dist/types';

import DeployHelper from '../deploys';

import { run } from 'hardhat';
const confirmations = 6;

export async function createPooledCreditLines(proxyAdmin: SignerWithAddress, mockImplementationAddress: Address): Promise<SublimeProxy> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('Deploying pooled credit lines');
    }
    let deployHelper = new DeployHelper(proxyAdmin);
    let pooledCreditlineProxy = await deployHelper.helper.deploySublimeProxy(mockImplementationAddress, proxyAdmin.address);
    return pooledCreditlineProxy;
}

export async function createLenderPool(proxyAdmin: SignerWithAddress, mockImplementationAddress: Address): Promise<SublimeProxy> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('Deploying lender pool');
    }
    let deployHelper = new DeployHelper(proxyAdmin);
    let lenderPoolProxy = await deployHelper.helper.deploySublimeProxy(mockImplementationAddress, proxyAdmin.address);
    return lenderPoolProxy;
}

async function verifyPooledCreditlines(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/PooledCreditLine/PooledCreditLine.sol:PooledCreditLine',
    }).catch(console.log);
}

async function verifuLenderPool(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/PooledCreditLine/LenderPool.sol:LenderPool',
    }).catch(console.log);
}

export async function createAndChangeImplementationAddressesForLenderPoolAndPooledCreditLines(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    protocolFeeCollector: SignerWithAddress,
    pooledCreditLine: SublimeProxy,
    lenderPool: SublimeProxy,
    savingsAccount: Address,
    verification: Address,
    priceOracle: string,
    usdc: string,
    strategyRegistry: string
): Promise<[LenderPool, PooledCreditLine]> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('Deploying lender pool implementation');
    }
    let deployHelper = new DeployHelper(proxyAdmin);

    let lenderpoolImplemenation = await deployHelper.core.deployLenderPool(
        pooledCreditLine.address,
        savingsAccount,
        verification,
        priceOracle,
        usdc
    );

    if (chainid != 31337) {
        await lenderpoolImplemenation.deployTransaction.wait(confirmations);
        await verifuLenderPool(lenderpoolImplemenation.address, [
            pooledCreditLine.address,
            savingsAccount,
            verification,
            priceOracle,
            usdc,
        ]);

        console.log('Updating lender pool implementation address');
    }

    await (await lenderPool.connect(proxyAdmin).upgradeTo(lenderpoolImplemenation.address)).wait();

    if (chainid != 31337) {
        console.log('Deploying pooled credit line implementation');
    }
    let pooledCreditlineImplementation = await deployHelper.core.deployPooledCreditLines(lenderPool.address, usdc);

    if (chainid != 31337) {
        await pooledCreditlineImplementation.deployTransaction.wait(confirmations);
        await verifyPooledCreditlines(pooledCreditlineImplementation.address, [lenderPool.address, usdc]);
        console.log('Upgrading pooled credit line implementation');
    }

    await (await pooledCreditLine.connect(proxyAdmin).upgradeTo(pooledCreditlineImplementation.address)).wait();

    let newLenderPool = await deployHelper.core.getLenderPool(lenderPool.address);

    if (chainid != 31337) {
        console.log('init lender pool');
    }
    await (await newLenderPool.connect(admin).initialize()).wait();

    let newPooledCreditLine = await deployHelper.core.getPooledCreditLines(pooledCreditLine.address);

    if (chainid != 31337) {
        console.log('init pooled credit line');
    }
    await (
        await newPooledCreditLine
            .connect(admin)
            .initialize(
                priceOracle,
                savingsAccount,
                strategyRegistry,
                admin.address,
                BigNumber.from(10).pow(16),
                protocolFeeCollector.address,
                verification
            )
    ).wait();

    return [newLenderPool, newPooledCreditLine];
}
