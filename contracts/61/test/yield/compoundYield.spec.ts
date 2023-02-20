import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { CompoundYield } from '../../typechain/CompoundYield';

import { Contracts } from '../../existingContracts/compound.json';
import { getRandomFromArray } from '../../utils/helpers';

describe('Compound Yield', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let compoundYield: CompoundYield;
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
        compoundYield = await deployHelper.core.deployCompoundYield();

        await compoundYield.connect(admin).initialize(admin.address, savingsAccount.address);
    });

    it('Update Protocol Address', async () => {
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);
    });

    it('Check DAI Liquidity Token and it mapping', async () => {
        const mappedToken = await compoundYield.liquidityToken(Contracts.DAI);
        expect(mappedToken).eq(ethers.utils.getAddress(Contracts.cDAI));
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
            await expect(compoundYield.connect(randomAccount).updateSavingsAccount(randomAccount.address)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should throw error when a random account tries update params', async () => {
            await expect(
                compoundYield.connect(randomAccount).updateProtocolAddresses(randomAccount.address, randomAccount.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should throw error when a random account tries to make emergency withdraw', async () => {
            await expect(
                compoundYield.connect(randomAccount).emergencyWithdraw(randomAccount.address, randomAccount.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });
});
