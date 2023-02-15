import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import { aaveYieldParams, aLink } from '../../utils/constants';
import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { AaveYield } from '../../typechain/AaveYield';

import { Contracts } from '../../existingContracts/compound.json';
import { getRandomFromArray } from '../../utils/helpers';

describe('Aave Yield', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let aaveYield: AaveYield;
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
        aaveYield = await deployHelper.core.deployAaveYield();
        await aaveYield
            .connect(admin)
            .initialize(
                admin.address,
                savingsAccount.address,
                aaveYieldParams._wethGateway,
                aaveYieldParams._protocolDataProvider,
                aaveYieldParams._lendingPoolAddressesProvider
            );
    });

    it('Check Link Liquidity Token and it mapping', async () => {
        const mappedToken = await aaveYield.liquidityToken(Contracts.LINK);
        expect(mappedToken).eq(ethers.utils.getAddress(aLink));
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
            await expect(aaveYield.connect(randomAccount).updateSavingsAccount(randomAccount.address)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should throw error when a random account tries update params', async () => {
            await expect(
                aaveYield.connect(randomAccount).updateAaveAddresses(randomAccount.address, randomAccount.address, randomAccount.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should throw error when a random account tries to change referral code', async () => {
            await expect(
                aaveYield.connect(randomAccount).updateReferralCode(123) // use any random number
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should throw error when a random account tries to make emergency withdraw', async () => {
            await expect(
                aaveYield.connect(randomAccount).emergencyWithdraw(randomAccount.address, randomAccount.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });
});
