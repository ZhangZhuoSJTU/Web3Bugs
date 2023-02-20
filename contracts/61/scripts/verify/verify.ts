import hre from 'hardhat';
import { getAddressesToVerify } from './populateLogicAddresses';

async function verifyProxy(contracts: any) {
    // let [proxyAdmin] = await hre.ethers.getSigners();

    // console.log(`Verifying contracts on network ${hre.network.name}`);

    // console.log(`Verifying strategy proxy ${contracts.strategyRegistry.proxy}`);
    // await hre.run('verify:verify', {
    //     address: contracts.strategyRegistry.proxy,
    //     constructorArguments: [contracts.strategyRegistry.logic, proxyAdmin.address, Buffer.from('')],
    //     contract: 'contracts/Proxy.sol:SublimeProxy',
    // });

    // you don't need to verify all proxies. If needed, just copy the code snippet above
    return 'Proxy Verified';
}

async function verifyLogic(contracts: any) {
    console.log(`Verifying strategy logic ${contracts.strategyRegistry.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.strategyRegistry.logic,
            constructorArguments: [],
            contract: 'contracts/yield/StrategyRegistry.sol:StrategyRegistry',
        })
        .catch(console.log);

    console.log(`Verifying credit lines logic ${contracts.creditLines.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.creditLines.logic,
            constructorArguments: [],
            contract: 'contracts/CreditLine/CreditLine.sol:CreditLine',
        })
        .catch(console.log);

    console.log(`Verifying savings account logic ${contracts.savingsAccount.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.savingsAccount.logic,
            constructorArguments: [],
            contract: 'contracts/SavingsAccount/SavingsAccount.sol:SavingsAccount',
        })
        .catch(console.log);

    console.log(`Verifying aave yield logic ${contracts.aaveYield.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.aaveYield.logic,
            constructorArguments: [],
            contract: 'contracts/yield/AaveYield.sol:AaveYield',
        })
        .catch(console.log);

    console.log(`Verifying no yield logic ${contracts.noYield.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.noYield.logic,
            constructorArguments: [],
            contract: 'contracts/yield/NoYield.sol:NoYield',
        })
        .catch(console.log);

    console.log(`Verifying compound yield logic ${contracts.compoundYield.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.compoundYield.logic,
            constructorArguments: [],
            contract: 'contracts/yield/CompoundYield.sol:CompoundYield',
        })
        .catch(console.log);

    console.log(`Verifying price oracle logic ${contracts.priceOracle.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.priceOracle.logic,
            constructorArguments: [],
            contract: 'contracts/PriceOracle.sol:PriceOracle',
        })
        .catch(console.log);

    console.log(`Verifying verification logic ${contracts.verification.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.verification.logic,
            constructorArguments: [],
            contract: 'contracts/Verification/Verification.sol:Verification',
        })
        .catch(console.log);

    console.log(`Verifying pool factory logic ${contracts.poolFactory.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.poolFactory.logic,
            constructorArguments: [],
            contract: 'contracts/Pool/PoolFactory.sol:PoolFactory',
        })
        .catch(console.log);

    console.log(`Verifying repayments logic ${contracts.repayments.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.repayments.logic,
            constructorArguments: [],
            contract: 'contracts/Pool/Repayments.sol:Repayments',
        })
        .catch(console.log);

    console.log(`Verifying extenstions logic ${contracts.extension.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.extension.logic,
            constructorArguments: [],
            contract: 'contracts/Pool/Extension.sol:Extension',
        })
        .catch(console.log);

    console.log(`Verifying pool logic ${contracts.pool.proxy}`);
    await hre
        .run('verify:verify', {
            address: contracts.pool.proxy,
            constructorArguments: [],
            contract: 'contracts/Pool/Pool.sol:Pool',
        })
        .catch(console.log);

    return 'Logic Verified';
}

async function verify() {
    let contracts = await getAddressesToVerify();
    await verifyProxy(contracts);
    await verifyLogic(contracts);
    return 'All Verified';
}

verify().then(console.log).catch(console.log);
