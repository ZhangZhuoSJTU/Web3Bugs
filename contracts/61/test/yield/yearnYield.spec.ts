import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { YearnYield } from '../../typechain/YearnYield';

import { Contracts } from '../../existingContracts/compound.json';
import { getRandomFromArray } from '../../utils/helpers';
import { DAI_Yearn_Protocol_Address } from '../../utils/constants';

describe('Yearn Yield', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let yearnYield: YearnYield;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let mockCreditLinesAddress: SignerWithAddress;

    before(async () => {
        [proxyAdmin, admin, mockCreditLinesAddress] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        //initialize
        savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLinesAddress.address);
        strategyRegistry.initialize(admin.address, 10);
        yearnYield = await deployHelper.core.deployYearnYield();

        await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address);
    });

    it('Update Protocol Address', async () => {
        await yearnYield.connect(admin).updateProtocolAddresses(Contracts.DAI, DAI_Yearn_Protocol_Address);
    });

    it('Check DAI Liquidity Token and it mapping', async () => {
        const mappedToken = await yearnYield.liquidityToken(Contracts.DAI);
        expect(mappedToken).eq(ethers.utils.getAddress(DAI_Yearn_Protocol_Address));
    });

    describe('Failed Cases', async () => {
        let randomAccount: SignerWithAddress;
        before(async () => {
            randomAccount = getRandomFromArray(await ethers.getSigners());
            while (randomAccount.address === admin.address) {
                randomAccount = getRandomFromArray(await ethers.getSigners());
            }
        });

        it('should throw error when a random account tries to change savings account', async () => {
            await expect(yearnYield.connect(randomAccount).updateSavingsAccount(randomAccount.address)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should throw error when a random account tries update params', async () => {
            await expect(
                yearnYield.connect(randomAccount).updateProtocolAddresses(randomAccount.address, randomAccount.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should throw error when a random account tries to make emergency withdraw', async () => {
            await expect(
                yearnYield.connect(randomAccount).emergencyWithdraw(randomAccount.address, randomAccount.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });
});
