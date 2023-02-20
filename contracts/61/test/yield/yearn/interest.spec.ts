import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20Detailed } from '../../../typechain/ERC20Detailed';
import { SavingsAccount } from '../../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../../typechain/StrategyRegistry';
import { YearnYield } from '../../../typechain/YearnYield';
import DeployHelper from '../../../utils/deploys';
import { ethers, network } from 'hardhat';

import { Binance7, WhaleAccount } from '../../../utils/constants';
import { expect } from 'chai';
import { timeTravel } from '../../../utils/time';

describe.skip('yearn Yield interest calculations', () => {
    const USDC_YEARN_VAULT = '0x597aD1e0c13Bfe8025993D9e79C69E1c0233522e';
    const USDC_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let yearnYield: YearnYield;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let mockCreditLinesAddress: SignerWithAddress;
    let USDCToken: ERC20Detailed;

    let binance7: SignerWithAddress;
    let whaleAccount: SignerWithAddress;

    before(async () => {
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [Binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [WhaleAccount],
        });

        binance7 = await ethers.getSigner(Binance7);
        whaleAccount = await ethers.getSigner(WhaleAccount);

        [proxyAdmin, admin, mockCreditLinesAddress] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLinesAddress.address);
        strategyRegistry.initialize(admin.address, 10);
        yearnYield = await deployHelper.core.deployYearnYield();
        USDCToken = await deployHelper.mock.getMockERC20Detailed(USDC_TOKEN);

        await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address);
        await yearnYield.connect(admin).updateProtocolAddresses(USDC_TOKEN, USDC_YEARN_VAULT);
    });

    it('Lock same tokens at different times', async () => {
        let amount = 1000000000;
        await yearnYield.connect(admin).updateSavingsAccount(binance7.address);
        await USDCToken.connect(binance7).approve(yearnYield.address, amount);
        const depositReceipt1 = await (await yearnYield.connect(binance7).lockTokens(binance7.address, USDCToken.address, amount)).wait();

        if (!depositReceipt1.events) {
            expect(false, 'Events not found while despositing 1');
            return;
        }

        const shares1 = depositReceipt1.events[4].args?.lpTokensReceived;

        console.log(shares1.toString());

        await yearnYield.connect(admin).updateSavingsAccount(whaleAccount.address);
        await USDCToken.connect(whaleAccount).approve(yearnYield.address, amount);
        const depositReceipt2 = await (
            await yearnYield.connect(whaleAccount).lockTokens(whaleAccount.address, USDCToken.address, amount)
        ).wait();

        if (!depositReceipt2.events) {
            expect(false, 'Events not found while despositing 2');
            return;
        }

        const shares2 = depositReceipt2.events[4].args?.lpTokensReceived;

        console.log(shares2.toString());

        expect(shares2.lt(shares1));

        await timeTravel(network, 100000000);

        await yearnYield.connect(admin).updateSavingsAccount(binance7.address);
        const withdrawReceipt1 = await (await yearnYield.connect(binance7).unlockTokens(USDCToken.address, shares1)).wait();

        if (!withdrawReceipt1.events) {
            expect(false, 'Events not found while withdrawing 1');
            return;
        }

        const returnedTokens1 = withdrawReceipt1.events[3].args?.tokensReceived;
        console.log(returnedTokens1.toString());

        await yearnYield.connect(admin).updateSavingsAccount(whaleAccount.address);
        const withdrawReceipt2 = await (await yearnYield.connect(whaleAccount).unlockTokens(USDCToken.address, shares2)).wait();

        if (!withdrawReceipt2.events) {
            expect(false, 'Events not found while withdrawing 2');
            return;
        }

        const returnedTokens2 = withdrawReceipt2.events[3].args?.tokensReceived;
        console.log(returnedTokens2.toString());
    });
});
