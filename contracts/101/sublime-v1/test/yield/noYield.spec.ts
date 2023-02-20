import { NoYield, SublimeProxy, SavingsAccount } from '../../typechain';
import { waffle, ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { loadFixture } = waffle;

describe('No Yield', async () => {
    let noYield: NoYield;
    let admin: SignerWithAddress;
    let mockSavingsAccount: SignerWithAddress;

    async function fixture() {
        const [proxyAdmin, admin, mockSavingsAccount]: SignerWithAddress[] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        let noYieldLogic: NoYield = await deployHelper.core.deployNoYield();
        let proxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(noYieldLogic.address, proxyAdmin.address);

        let noYield: NoYield = await (await deployHelper.core.getNoYield(proxy.address)).connect(admin);
        await noYield.initialize(admin.address, mockSavingsAccount.address);
        return { noYield, admin, mockSavingsAccount };
    }

    beforeEach(async () => {
        let result = await loadFixture(fixture);
        noYield = result.noYield;
        admin = result.admin;
        mockSavingsAccount = result.mockSavingsAccount;
    });

    it('Test 1', async () => {});
    it('Test 2', async () => {});
    it('Test 3', async () => {});

    describe('Sub section Tests', async () => {
        let newSavingsAccount: SavingsAccount;

        async function savingsAccountUpdatedFixture() {
            let savingAccountAddress = '0x0000222220000222220000222220000222220000';
            await noYield.updateSavingsAccount(savingAccountAddress);
            let deployHelper: DeployHelper = new DeployHelper(admin);

            let savingsAccount: SavingsAccount = await deployHelper.core.getSavingsAccount(savingAccountAddress);
            return { noYield, admin, savingsAccount };
        }

        beforeEach(async () => {
            let result = await loadFixture(savingsAccountUpdatedFixture);
            newSavingsAccount = result.savingsAccount;
        });

        it('N-Test 1', async () => {});
        it('N-Test 2', async () => {});
        it('N-Test 3', async () => {});
    });
});
