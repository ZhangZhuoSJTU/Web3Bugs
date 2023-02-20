import { StrategyRegistry, SublimeProxy } from '../../typechain';
import { waffle, ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from '@ethersproject/providers/node_modules/@ethersproject/bignumber';

const { loadFixture } = waffle;

describe('Strategy Registry', async () => {
    let admin: SignerWithAddress;
    let strategyRegistry: StrategyRegistry;
    let maxStrategies: BigNumberish;

    async function fixture() {
        const [proxyAdmin, admin]: SignerWithAddress[] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        let strategyRegisteryLogic: StrategyRegistry = await deployHelper.core.deployStrategyRegistry();
        let proxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(strategyRegisteryLogic.address, proxyAdmin.address);

        let strategyRegistry: StrategyRegistry = await (await deployHelper.core.getStrategyRegistry(proxy.address)).connect(admin);
        await strategyRegistry.initialize(admin.address, maxStrategies);
        return { strategyRegistry, admin };
    }

    beforeEach(async () => {
        maxStrategies = 10;
        let result = await loadFixture(fixture);
        admin = result.admin;
        strategyRegistry = result.strategyRegistry;
    });

    it('Test 1', async () => {});
    it('Test 2', async () => {});
    it('Test 3', async () => {});
});
