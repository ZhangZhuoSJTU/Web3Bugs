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
    creditLineFactoryParams,
    createPoolParams,
    ChainLinkAggregators,
    OperationalAmounts,
    extensionParams,
    verificationParams,
} from '../../utils/constants';
import DeployHelper from '../../utils/deploys';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';

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

describe('Credit Lines', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let mockCreditLines: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;

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
    let protocolFeeCollector: any;

    before(async () => {
        [proxyAdmin, admin, mockCreditLines, borrower, lender, protocolFeeCollector] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        //initialize
        await savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLines.address);
        await strategyRegistry.initialize(admin.address, 10);

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAccount],
        });

        await admin.sendTransaction({
            to: whaleAccount,
            value: ethers.utils.parseEther('100'),
        });

        Binance7 = await ethers.provider.getSigner(binance7);
        WhaleAccount = await ethers.provider.getSigner(whaleAccount);

        BatTokenContract = await deployHelper.mock.getMockERC20(Contracts.BAT);
        await BatTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 BAT tokens

        LinkTokenContract = await deployHelper.mock.getMockERC20(Contracts.LINK);
        await LinkTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 LINK tokens

        DaiTokenContract = await deployHelper.mock.getMockERC20(Contracts.DAI);
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 DAI

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

        yearnYield = await deployHelper.core.deployYearnYield();
        await yearnYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(yearnYield.address);
        await yearnYield.connect(admin).updateProtocolAddresses(DaiTokenContract.address, DAI_Yearn_Protocol_Address);

        await yearnYield.connect(admin).updateProtocolAddresses(LinkTokenContract.address, LINK_Yearn_Protocol_Address);

        compoundYield = await deployHelper.core.deployCompoundYield();
        await compoundYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);

        noYield = await deployHelper.core.deployNoYield();
        await noYield.initialize(admin.address, savingsAccount.address);
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
    });

    describe('Create Credit Lines Contract', async () => {
        let creditLine: CreditLine;
        let poolFactory: PoolFactory;
        let extenstion: Extension;

        let borrowerCreditLine: BigNumber;
        let lenderCreditLine: BigNumber;

        before(async () => {
            const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
            creditLine = await deployHelper.core.deployCreditLines();
            poolFactory = await deployHelper.pool.deployPoolFactory();
            extenstion = await deployHelper.pool.deployExtenstion();
            await savingsAccount.connect(admin).updateCreditLine(creditLine.address);
        });

        it('Initialize required contracts', async () => {
            const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
            await extenstion.connect(admin).initialize(poolFactory.address, extensionParams.votingPassRatio);

            let {
                _collectionPeriod,
                _marginCallDuration,
                _minborrowFraction,
                _gracePeriodPenaltyFraction,
                _liquidatorRewardFraction,
                _loanWithdrawalDuration,
                _poolCancelPenalityFraction,
                _protocolFeeFraction,
            } = testPoolFactoryParams;

            let { _protocolFeeFraction: clProtocolFeeFraction, _liquidatorRewardFraction: clLiquidatorRewardFraction } =
                testPoolFactoryParams;

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
                    yearnYield.address,
                    priceOracle.address,
                    savingsAccount.address,
                    strategyRegistry.address,
                    admin.address,
                    clProtocolFeeFraction,
                    protocolFeeCollector.address,
                    clLiquidatorRewardFraction
                );
        });

        it('Check global variables', async () => {
            expect(await creditLine.creditLineCounter()).to.eq(0);
            expect(await creditLine.strategyRegistry()).to.eq(strategyRegistry.address);
            expect(await creditLine.defaultStrategy()).to.eq(yearnYield.address);
        });

        it('Request Credit Line to lender', async () => {
            let _lender: string = lender.address;
            let _borrowLimit: BigNumberish = BigNumber.from('10').mul('1000000000000000000');
            let _borrowRate: BigNumberish = BigNumber.from(100);
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(250).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = Contracts.DAI;
            let _collateralAsset: string = Contracts.LINK;

            let values = await creditLine
                .connect(borrower)
                .callStatic.request(
                    _lender,
                    _borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    false
                );

            await expect(
                creditLine
                    .connect(borrower)
                    .request(_lender, _borrowLimit, _borrowRate, _autoLiquidation, _collateralRatio, _borrowAsset, _collateralAsset, false)
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);

            lenderCreditLine = values;
            let creditLineConstants = await creditLine.creditLineConstants(values);
            //   console.log({ creditLineConstants });
        });

        it('Request Credit Line to borrower', async () => {
            let _borrower: string = borrower.address;
            let _borrowLimit: BigNumberish = BigNumber.from('10').mul('1000000000000000000');
            let _borrowRate: BigNumberish = BigNumber.from(100);
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(250).mul(BigNumber.from(10).pow(28));
            let _borrowAsset: string = Contracts.DAI;
            let _collateralAsset: string = Contracts.LINK;

            const allowance = await DaiTokenContract.allowance(lender.address, creditLine.address);
            await DaiTokenContract.connect(lender).approve(creditLine.address, allowance.add(_borrowLimit));
            console.log('allowance done');
            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    _borrower,
                    _borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );
            console.log('credit line id is', values);
            await expect(
                creditLine
                    .connect(lender)
                    .request(_borrower, _borrowLimit, _borrowRate, _autoLiquidation, _collateralRatio, _borrowAsset, _collateralAsset, true)
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);
            console.log('credit lines created');
            borrowerCreditLine = values;
            let creditLineConstants = await creditLine.creditLineConstants(values);
            // console.log({ creditLineConstants });
        });

        it('Accept Credit Line (Borrower)', async () => {
            await expect(creditLine.connect(borrower).accept(borrowerCreditLine))
                .to.emit(creditLine, 'CreditLineAccepted')
                .withArgs(borrowerCreditLine);
        });

        it('Deposit Collateral into existing credit line (not from savings account)', async () => {
            // console.log({ borrowerCreditLine, lenderCreditLine });
            // console.log(await creditLine.creditLineConstants(borrowerCreditLine));
            let valueToTest = BigNumber.from('25').mul('1000000000000000000');

            await LinkTokenContract.connect(admin).transfer(borrower.address, valueToTest);
            await LinkTokenContract.connect(borrower).approve(creditLine.address, valueToTest); // yearn yield is the default strategy in this case

            await creditLine.connect(borrower).depositCollateral(borrowerCreditLine, valueToTest, yearnYield.address, false);
        });

        it('Deposit Collateral into existing credit line (from savings account)', async () => {
            // console.log({ borrowerCreditLine, lenderCreditLine });
            // console.log(await creditLine.creditLineConstants(borrowerCreditLine));
            let valueToTest = BigNumber.from('25').mul('1000000000000000000');

            await LinkTokenContract.connect(admin).transfer(borrower.address, valueToTest.mul(3));
            await LinkTokenContract.connect(borrower).approve(noYield.address, valueToTest);

            await LinkTokenContract.connect(borrower).approve(yearnYield.address, valueToTest.mul(2));

            await savingsAccount.connect(borrower).deposit(valueToTest, LinkTokenContract.address, noYield.address, borrower.address);
            await savingsAccount
                .connect(borrower)
                .deposit(valueToTest.mul(2), LinkTokenContract.address, yearnYield.address, borrower.address);
            await savingsAccount.connect(borrower).approve(valueToTest.mul(2), Contracts.LINK, creditLine.address);

            await creditLine.connect(borrower).depositCollateral(borrowerCreditLine, valueToTest, yearnYield.address, true);
        });

        it('Close Credit Line', async () => {
            await expect(creditLine.connect(borrower).close(borrowerCreditLine))
                .to.emit(creditLine, 'CreditLineClosed')
                .withArgs(borrowerCreditLine);
        });

        describe('Create Credit Lines Contract', async () => {
            let creditLine: CreditLine;
            let poolFactory: PoolFactory;
            let extenstion: Extension;

            let borrowerCreditLine: BigNumber;
            let lenderCreditLine: BigNumber;

            before(async () => {
                const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
                creditLine = await deployHelper.core.deployCreditLines();
                poolFactory = await deployHelper.pool.deployPoolFactory();
                extenstion = await deployHelper.pool.deployExtenstion();
                await savingsAccount.connect(admin).updateCreditLine(creditLine.address);
            });

            it('Initialize required contracts', async () => {
                const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
                await extenstion.connect(admin).initialize(poolFactory.address, extensionParams.votingPassRatio);

                let {
                    _collectionPeriod,
                    _marginCallDuration,
                    _minborrowFraction,
                    _gracePeriodPenaltyFraction,
                    _liquidatorRewardFraction,
                    _loanWithdrawalDuration,
                    _poolCancelPenalityFraction,
                    _protocolFeeFraction,
                } = testPoolFactoryParams;

                let { _protocolFeeFraction: clProtocolFeeFraction, _liquidatorRewardFraction: clLiquidatorRewardFraction } =
                    testPoolFactoryParams;

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
                        yearnYield.address,
                        priceOracle.address,
                        savingsAccount.address,
                        strategyRegistry.address,
                        admin.address,
                        clProtocolFeeFraction,
                        protocolFeeCollector.address,
                        clLiquidatorRewardFraction
                    );
            });

            it('Check global variables', async () => {
                // TODO: check all global variables
                expect(await creditLine.creditLineCounter()).to.eq(0);
                expect(await creditLine.strategyRegistry()).to.eq(strategyRegistry.address);
                expect(await creditLine.defaultStrategy()).to.eq(yearnYield.address);
            });

            it('Request Credit Line to lender', async () => {
                let _lender: string = lender.address;
                let _borrowLimit: BigNumberish = BigNumber.from('10').mul('1000000000000000000');
                let _borrowRate: BigNumberish = BigNumber.from(100);
                let _autoLiquidation: boolean = true;
                let _collateralRatio: BigNumberish = BigNumber.from(250).mul(BigNumber.from(10).pow(28));
                let _borrowAsset: string = Contracts.DAI;
                let _collateralAsset: string = Contracts.LINK;

                let values = await creditLine
                    .connect(borrower)
                    .callStatic.request(
                        _lender,
                        _borrowLimit,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        false
                    );

                await expect(
                    creditLine
                        .connect(borrower)
                        .request(
                            _lender,
                            _borrowLimit,
                            _borrowRate,
                            _autoLiquidation,
                            _collateralRatio,
                            _borrowAsset,
                            _collateralAsset,
                            false
                        )
                )
                    .to.emit(creditLine, 'CreditLineRequested')
                    .withArgs(values, lender.address, borrower.address);

                lenderCreditLine = values;
                let creditLineConstants = await creditLine.creditLineConstants(values);
                //   console.log({ creditLineConstants });
            });

            it('Request Credit Line to borrower', async () => {
                let _borrower: string = borrower.address;
                let _borrowLimit: BigNumberish = BigNumber.from('10').mul('1000000000000000000');
                let _borrowRate: BigNumberish = BigNumber.from(100);
                let _autoLiquidation: boolean = true;
                let _collateralRatio: BigNumberish = BigNumber.from(250).mul(BigNumber.from(10).pow(28));
                let _borrowAsset: string = Contracts.DAI;
                let _collateralAsset: string = Contracts.LINK;

                const allowance = await DaiTokenContract.allowance(lender.address, creditLine.address);
                await DaiTokenContract.connect(lender).approve(creditLine.address, allowance.add(_borrowLimit));

                let values = await creditLine
                    .connect(lender)
                    .callStatic.request(
                        _borrower,
                        _borrowLimit,
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
                        .request(
                            _borrower,
                            _borrowLimit,
                            _borrowRate,
                            _autoLiquidation,
                            _collateralRatio,
                            _borrowAsset,
                            _collateralAsset,
                            true
                        )
                )
                    .to.emit(creditLine, 'CreditLineRequested')
                    .withArgs(values, lender.address, borrower.address);

                borrowerCreditLine = values;
                let creditLineConstants = await creditLine.creditLineConstants(values);
                // console.log({ creditLineConstants });
            });

            it('Accept Credit Line (Borrower)', async () => {
                await expect(creditLine.connect(borrower).accept(borrowerCreditLine))
                    .to.emit(creditLine, 'CreditLineAccepted')
                    .withArgs(borrowerCreditLine);
            });

            it('Deposit Collateral into existing credit line (not from savings account)', async () => {
                // console.log({ borrowerCreditLine, lenderCreditLine });
                // console.log(await creditLine.creditLineConstants(borrowerCreditLine));
                let valueToTest = BigNumber.from('25').mul('1000000000000000000');

                await LinkTokenContract.connect(admin).transfer(borrower.address, valueToTest);
                await LinkTokenContract.connect(borrower).approve(creditLine.address, valueToTest); // yearn yield is the default strategy in this case

                await creditLine.connect(borrower).depositCollateral(borrowerCreditLine, valueToTest, yearnYield.address, false);
            });

            it('Deposit Collateral into existing credit line (from savings account)', async () => {
                // console.log({ borrowerCreditLine, lenderCreditLine });
                // console.log(await creditLine.creditLineConstants(borrowerCreditLine));
                let valueToTest = BigNumber.from('25').mul('1000000000000000000');

                await LinkTokenContract.connect(admin).transfer(borrower.address, valueToTest.mul(3));
                await LinkTokenContract.connect(borrower).approve(noYield.address, valueToTest);

                await LinkTokenContract.connect(borrower).approve(yearnYield.address, valueToTest.mul(2));

                await savingsAccount.connect(borrower).deposit(valueToTest, LinkTokenContract.address, noYield.address, borrower.address);
                await savingsAccount
                    .connect(borrower)
                    .deposit(valueToTest.mul(2), LinkTokenContract.address, yearnYield.address, borrower.address);
                await savingsAccount.connect(borrower).approve(valueToTest.mul(2), Contracts.LINK, creditLine.address);

                await creditLine.connect(borrower).depositCollateral(borrowerCreditLine, valueToTest, yearnYield.address, true);
            });

            it('Close Credit Line', async () => {
                await expect(creditLine.connect(borrower).close(borrowerCreditLine))
                    .to.emit(creditLine, 'CreditLineClosed')
                    .withArgs(borrowerCreditLine);
            });

            describe('Failed cases', async () => {
                it('Cannot deposit into invalid credit line hash', async () => {
                    let randomInvalidHash = '0x0000000011111111000000001111111100000000111111110000000011111111';
                    await expect(
                        creditLine
                            .connect(borrower)
                            .depositCollateral(randomInvalidHash, BigNumber.from('123123123'), yearnYield.address, false)
                    ).to.be.revertedWith('Credit line does not exist');

                    await expect(
                        creditLine
                            .connect(borrower)
                            .depositCollateral(randomInvalidHash, BigNumber.from('123123123'), yearnYield.address, true)
                    ).to.be.revertedWith('Credit line does not exist');
                });

                it('should fail if any other user/address is trying to accept the credit line', async () => {
                    await expect(creditLine.connect(lender).accept(borrowerCreditLine)).to.be.revertedWith(
                        'CreditLine::acceptCreditLineLender - CreditLine is already accepted'
                    );
                });
            });
        });
    });
});
// function print(data: any) {
//     console.log(JSON.stringify(data, null, 4));
// }
