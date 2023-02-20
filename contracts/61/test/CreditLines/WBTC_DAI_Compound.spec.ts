import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from 'chai';

import {
    aaveYieldParams,
    depositValueToTest,
    zeroAddress,
    Binance7 as binance7,
    WhaleAccount as whaleAccount,
    DAI_Yearn_Protocol_Address,
    LINK_Yearn_Protocol_Address,
    testPoolFactoryParams,
    createPoolParams,
    ChainLinkAggregators,
    OperationalAmounts,
    extensionParams,
    verificationParams,
    WBTCWhale as wbtcwhale,
} from '../../utils/constants';
import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';

import { getPoolAddress, getRandomFromArray, incrementChain } from '../../utils/helpers';

import { Address } from 'hardhat-deploy/dist/types';
import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { Pool } from '../../typechain/Pool';
import { Verification } from '../../typechain/Verification';
import { PoolFactory } from '../../typechain/PoolFactory';
import { ERC20 } from '../../typechain/ERC20';
import { PriceOracle } from '../../typechain/PriceOracle';
import { Extension } from '../../typechain/Extension';
import { CreditLine } from '../../typechain/CreditLine';

import { Contracts } from '../../existingContracts/compound.json';
import { sha256 } from '@ethersproject/sha2';
import { Repayments } from '../../typechain/Repayments';
import { ContractTransaction } from '@ethersproject/contracts';
import { getContractAddress } from '@ethersproject/address';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { NoYield } from '@typechain/NoYield';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

describe('WBTC-DAI Credit Lines', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let mockCreditLines: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraAccount: SignerWithAddress;

    let aaveYield: AaveYield;
    let yearnYield: YearnYield;
    let compoundYield: CompoundYield;
    let noYield: NoYield;

    let BatTokenContract: ERC20;
    let LinkTokenContract: ERC20;
    let DaiTokenContract: ERC20;

    let verification: Verification;
    let adminVerifier: AdminVerifier;
    let priceOracle: PriceOracle;

    let Binance7: any;
    let WhaleAccount: any;

    let creditLine: CreditLine;
    let poolFactory: PoolFactory;
    let extenstion: Extension;

    let WBTCTokenContract: ERC20;
    let WBTCWhale: any;

    let borrowerCreditLine: BigNumber;
    let lenderCreditLine: BigNumber;

    let extraAccounts: SignerWithAddress[];

    before(async () => {
        [proxyAdmin, admin, mockCreditLines, borrower, lender, protocolFeeCollector] = await ethers.getSigners();
        extraAccounts = await (await ethers.getSigners()).slice(-100);

        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        //initialize
        savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLines.address);
        strategyRegistry.initialize(admin.address, 10);

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAccount],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [wbtcwhale],
        });

        await admin.sendTransaction({
            to: whaleAccount,
            value: ethers.utils.parseEther('100'),
        });

        await admin.sendTransaction({
            to: wbtcwhale,
            value: ethers.utils.parseEther('100'),
        });

        Binance7 = await ethers.provider.getSigner(binance7);
        WhaleAccount = await ethers.provider.getSigner(whaleAccount);
        WBTCWhale = await ethers.provider.getSigner(wbtcwhale);

        BatTokenContract = await deployHelper.mock.getMockERC20(Contracts.BAT);
        await BatTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 BAT tokens

        LinkTokenContract = await deployHelper.mock.getMockERC20(Contracts.LINK);
        await LinkTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 LINK tokens

        DaiTokenContract = await deployHelper.mock.getMockERC20(Contracts.DAI);
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 DAI

        WBTCTokenContract = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        await WBTCTokenContract.connect(WBTCWhale).transfer(admin.address, BigNumber.from('10').pow(10)); // 100 BTC

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

        await strategyRegistry.connect(admin).addStrategy(aaveYield.address);

        compoundYield = await deployHelper.core.deployCompoundYield();
        await compoundYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.WBTC, Contracts.cWBTC2);

        noYield = await deployHelper.core.deployNoYield();
        await noYield.connect(admin).initialize(admin.address, savingsAccount.address);

        await strategyRegistry.connect(admin).addStrategy(noYield.address);

        verification = await deployHelper.helper.deployVerification();
        await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
        adminVerifier = await deployHelper.helper.deployAdminVerifier();
        await verification.connect(admin).addVerifier(adminVerifier.address);
        await adminVerifier.connect(admin).initialize(admin.address, verification.address);
        await adminVerifier.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')), true);

        priceOracle = await deployHelper.helper.deployPriceOracle();
        await priceOracle.connect(admin).initialize(admin.address);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.DAI, ChainLinkAggregators['DAI/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.WBTC, ChainLinkAggregators['BTC/USD']);

        deployHelper = new DeployHelper(proxyAdmin);
        creditLine = await deployHelper.core.deployCreditLines();
        poolFactory = await deployHelper.pool.deployPoolFactory();
        extenstion = await deployHelper.pool.deployExtenstion();

        await extenstion.connect(admin).initialize(poolFactory.address, extensionParams.votingPassRatio);
        await savingsAccount.connect(admin).updateCreditLine(creditLine.address);

        let {
            _collectionPeriod,
            _marginCallDuration,
            _minborrowFraction,
            _liquidatorRewardFraction,
            _loanWithdrawalDuration,
            _poolCancelPenalityFraction,
            _protocolFeeFraction,
        } = testPoolFactoryParams;

        let { _protocolFeeFraction: clProtocolFeeFraction, _liquidatorRewardFraction: clLiquidatorRewardFraction } = testPoolFactoryParams;

        await poolFactory
            .connect(admin)
            .initialize(
                admin.address,
                _collectionPeriod,
                _loanWithdrawalDuration,
                _marginCallDuration,
                getPoolInitSigHash(),
                _liquidatorRewardFraction,
                _poolCancelPenalityFraction,
                _minborrowFraction,
                _protocolFeeFraction,
                protocolFeeCollector.address,
                noYield.address
            );

        const poolImpl = await deployHelper.pool.deployPool();
        const repaymentImpl = await deployHelper.pool.deployRepayments();
        await poolFactory
            .connect(admin)
            .setImplementations(
                poolImpl.address,
                repaymentImpl.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address,
                extenstion.address
            );

        await creditLine
            .connect(admin)
            .initialize(
                compoundYield.address,
                priceOracle.address,
                savingsAccount.address,
                strategyRegistry.address,
                admin.address,
                clProtocolFeeFraction,
                protocolFeeCollector.address,
                clLiquidatorRewardFraction
            );
    });

    describe('Create Credit Lines - Lender', async () => {
        let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
        beforeEach(async () => {
            let _borrower: string = borrower.address;
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = Contracts.DAI;
            let _collateralAsset: string = Contracts.WBTC;

            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    _borrower,
                    borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(_borrower, borrowLimit, _borrowRate, _autoLiquidation, _collateralRatio, _borrowAsset, _collateralAsset, true)
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);

            lenderCreditLine = values;
        });

        it('Check Credit Line Info', async () => {
            let creditLineConstants = await creditLine.creditLineConstants(lenderCreditLine);
            print(creditLineConstants);
        });

        it('Borrow From Credit Line only borrower', async () => {
            let lenderAmount = BigNumber.from(10).pow(20); // 100 DAI
            let borrowerCollateral = BigNumber.from(10).pow(8); // 1WBTC
            let borrowAmount = BigNumber.from(10).pow(19); //10 DAI

            let unlimited = BigNumber.from(10).pow(60);

            await creditLine.connect(borrower).accept(lenderCreditLine);

            await DaiTokenContract.connect(admin).transfer(lender.address, lenderAmount);
            await DaiTokenContract.connect(lender).approve(compoundYield.address, lenderAmount);

            await WBTCTokenContract.connect(admin).transfer(borrower.address, borrowerCollateral);
            await WBTCTokenContract.connect(borrower).approve(creditLine.address, borrowerCollateral);

            await creditLine.connect(borrower).depositCollateral(lenderCreditLine, borrowerCollateral, compoundYield.address, false);

            await savingsAccount.connect(lender).deposit(lenderAmount, DaiTokenContract.address, compoundYield.address, lender.address);
            await savingsAccount.connect(lender).approve(unlimited, DaiTokenContract.address, creditLine.address);

            await creditLine.connect(borrower).borrow(lenderCreditLine, borrowAmount);
        });
    });
});

function print(data: any) {
    console.log(JSON.stringify(data, null, 4));
}
