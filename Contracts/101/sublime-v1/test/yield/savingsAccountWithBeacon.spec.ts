import { NoYield, SublimeProxy, SavingsAccount, MinimumBeaconProxy, Beacon, StrategyRegistry } from '../../typechain';
import { waffle, ethers, run, network } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Beacon Testing on Non Hardhat', async () => {
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;

    let noYield: NoYield;
    let savingsAccount: SavingsAccount;

    before(async () => {
        [proxyAdmin, admin] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        console.log('1');
        let strategyRegistry: StrategyRegistry = await deployHelper.core.deployStrategyRegistry();
        console.log('2');
        await (await strategyRegistry.connect(admin).initialize(admin.address, 10)).wait(1);

        let savingAccountLogic: SavingsAccount = await deployHelper.core.deploySavingsAccount();
        console.log('3');
        let becon: Beacon = await deployHelper.helper.deployBeacon(admin.address, savingAccountLogic.address);
        console.log('4');
        let savingsAccountProxy = await deployHelper.helper.deployMinimumBeaconProxy(becon.address);
        savingsAccount = await deployHelper.core.getSavingsAccount(savingsAccountProxy.address);
        savingsAccount = savingsAccount.connect(admin);
        console.log('5');
        await (await savingsAccount.initialize(admin.address, strategyRegistry.address)).wait(1);

        let noYieldLogic = await deployHelper.core.deployNoYield();
        console.log('6');
        let noYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(noYieldLogic.address, proxyAdmin.address);
        noYield = await deployHelper.core.getNoYield(noYieldProxy.address);
        noYield = noYield.connect(admin);
        console.log('7');
        await (await noYield.initialize(admin.address, savingsAccount.address)).wait(1);

        if (network.name != 'hardhat') {
            await run('verify:verify', {
                address: strategyRegistry.address,
                constructorArguments: [],
                contract: 'contracts/yield/StrategyRegistry.sol:StrategyRegistry',
            }).catch(console.log);

            await run('verify:verify', {
                address: savingAccountLogic.address,
                constructorArguments: [],
                contract: 'contracts/SavingsAccount/SavingsAccount.sol:SavingsAccount',
            }).catch(console.log);

            await run('verify:verify', {
                address: becon.address,
                constructorArguments: [admin.address, savingAccountLogic.address],
                contract: 'contracts/Pool/Beacon.sol:Beacon',
            }).catch(console.log);

            await run('verify:verify', {
                address: savingsAccountProxy.address,
                constructorArguments: [becon.address],
                contract: 'contracts/Pool/MinimumBeaconProxy2.sol:MinimumBeaconProxy',
            }).catch(console.log);

            await run('verify:verify', {
                address: noYieldLogic.address,
                constructorArguments: [],
                contract: 'contracts/yield/NoYield.sol:NoYield',
            }).catch(console.log);

            await run('verify:verify', {
                address: noYieldLogic.address,
                constructorArguments: [noYieldLogic.address, admin.address],
                contract: 'contracts/SublimeProxy.sol:SublimeProxy',
            }).catch(console.log);
        }

        console.log({
            strategyRegistry: strategyRegistry.address,
            savingAccountLogic: savingAccountLogic.address,
            becon: becon.address,
            savingsAccountProxy: savingsAccountProxy.address,
            noYieldLogic: noYieldLogic.address,
            noYieldProxy: noYieldProxy.address,
        });
    });

    it('Test', async () => {});
});
