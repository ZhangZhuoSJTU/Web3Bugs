import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import errors from '../helpers/errors.json';
import { packFundingCycleMetadata, impersonateAccount } from '../helpers/utils';

import jbController from '../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbDirectory from '../../artifacts/contracts/interfaces/IJBDirectory.sol/IJBDirectory.json';
import jBFundingCycleStore from '../../artifacts/contracts/interfaces/IJBFundingCycleStore.sol/IJBFundingCycleStore.json';
import jbFundingCycleDataSource from '../../artifacts/contracts/interfaces/IJBFundingCycleDataSource.sol/IJBFundingCycleDataSource.json';
import jbPrices from '../../artifacts/contracts/interfaces/IJBPrices.sol/IJBPrices.json';
import jbProjects from '../../artifacts/contracts/interfaces/IJBProjects.sol/IJBProjects.json';
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';
import jbTokenStore from '../../artifacts/contracts/interfaces/IJBTokenStore.sol/IJBTokenStore.json';

describe('JBSingleTokenPaymentTerminalStore::recordRedemptionFor(...)', function () {
  const PROJECT_ID = 2;
  const AMOUNT = ethers.BigNumber.from('4398540');
  const WEIGHT = ethers.BigNumber.from('900000000');
  const CURRENCY = ethers.BigNumber.from(1);
  const METADATA = ethers.utils.randomBytes(32);
  const _FIXED_POINT_MAX_FIDELITY = 18;

  async function setup() {
    const [deployer, holder, beneficiary, ...addrs] = await ethers.getSigners();

    const mockJbPrices = await deployMockContract(deployer, jbPrices.abi);
    const mockJbProjects = await deployMockContract(deployer, jbProjects.abi);
    const mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);
    const mockJbFundingCycleStore = await deployMockContract(deployer, jBFundingCycleStore.abi);
    const mockJbFundingCycleDataSource = await deployMockContract(
      deployer,
      jbFundingCycleDataSource.abi,
    );
    const mockJbTerminal = await deployMockContract(deployer, jbTerminal.abi);
    const mockJbTokenStore = await deployMockContract(deployer, jbTokenStore.abi);
    const mockJbController = await deployMockContract(deployer, jbController.abi);

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    const CURRENCY_ETH = await jbCurrencies.ETH();

    const JBPaymentTerminalStoreFactory = await ethers.getContractFactory(
      'contracts/JBSingleTokenPaymentTerminalStore.sol:JBSingleTokenPaymentTerminalStore',
    );
    const JBSingleTokenPaymentTerminalStore = await JBPaymentTerminalStoreFactory.deploy(
      mockJbDirectory.address,
      mockJbFundingCycleStore.address,
      mockJbPrices.address,
    );

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const mockJbTerminalSigner = await impersonateAccount(mockJbTerminal.address);

    const token = ethers.Wallet.createRandom().address;
    await mockJbTerminal.mock.token.returns(token);

    return {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbFundingCycleDataSource,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      CURRENCY_ETH,
      addrs,
    };
  }

  /* Happy path tests with mockJbTerminal access */

  it('Should record redemption without a datasource', async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      CURRENCY_ETH,
    } = await setup();

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    const reservedRate = 0;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
    });

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    /* Mocks for _reclaimableOverflowOf private method */
    await mockJbController.mock.distributionLimitOf
      .withArgs(PROJECT_ID, timestamp, mockJbTerminal.address, token)
      .returns(AMOUNT, CURRENCY_ETH);

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT);
    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    await mockJbController.mock.reservedTokenBalanceOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(0);
    /* End of mocks for _reclaimableOverflowOf private method */

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // Add to balance beforehand to have sufficient overflow
    const startingBalance = AMOUNT.mul(ethers.BigNumber.from(2));
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordAddedBalanceFor(
      PROJECT_ID,
      startingBalance,
    );

    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);

    // Record redemption
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
      /* holder */ holder.address,
      /* projectId */ PROJECT_ID,
      /* tokenCount */ AMOUNT,
      /* memo */ 'test',
      METADATA,
    );

    // Expect recorded balance to decrease by redeemed amount
    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance.sub(AMOUNT));
  });

  it('Should record redemption from global overflow', async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      CURRENCY_ETH,
    } = await setup();

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    const reservedRate = 0;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
      useTotalOverflowForRedemptions: true,
    });

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbDirectory.mock.terminalsOf.withArgs(PROJECT_ID).returns([mockJbTerminal.address]);
    await mockJbTerminal.mock.currentEthOverflowOf.withArgs(PROJECT_ID).returns(AMOUNT);

    /* Mocks for _reclaimableOverflowOf private method */
    await mockJbController.mock.distributionLimitOf
      .withArgs(PROJECT_ID, timestamp, mockJbTerminal.address, token)
      .returns(AMOUNT, CURRENCY_ETH);

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT);
    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    await mockJbController.mock.reservedTokenBalanceOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(0);
    /* End of mocks for _reclaimableOverflowOf private method */

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // Add to balance beforehand to have sufficient overflow
    const startingBalance = AMOUNT.mul(ethers.BigNumber.from(2));
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordAddedBalanceFor(
      PROJECT_ID,
      startingBalance,
    );

    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);

    // Record redemption
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
      /* holder */ holder.address,
      /* projectId */ PROJECT_ID,
      /* tokenCount */ AMOUNT,
      /* memo */ 'test',
      METADATA,
    );

    // Expect recorded balance to decrease by redeemed amount
    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance.sub(AMOUNT));
  });

  it('Should record redemption without a token count', async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      CURRENCY_ETH,
    } = await setup();

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    const reservedRate = 0;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
    });

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    /* Mocks for _claimableOverflowOf private method */
    await mockJbController.mock.distributionLimitOf
      .withArgs(PROJECT_ID, timestamp, mockJbTerminal.address, token)
      .returns(AMOUNT, CURRENCY_ETH);

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT);
    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    await mockJbController.mock.reservedTokenBalanceOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(0);

    /* End of mocks for _claimableOverflowOf private method */

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // No balance.
    const startingBalance = 0;

    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);

    // Record redemption
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
      /* holder */ holder.address,
      /* projectId */ PROJECT_ID,
      /* tokenCount */ 0,
      /* memo */ 'test',
      METADATA,
    );

    // Expect recorded balance to not have changed
    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);
  });

  it('Should record redemption without a claim amount', async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      CURRENCY_ETH,
    } = await setup();

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    const reservedRate = 0;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
    });

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    /* Mocks for _reclaimableOverflowOf private method */
    await mockJbController.mock.distributionLimitOf
      .withArgs(PROJECT_ID, timestamp, mockJbTerminal.address, token)
      .returns(AMOUNT, CURRENCY_ETH);

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT);

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    await mockJbController.mock.reservedTokenBalanceOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(0);
    /* End of mocks for _reclaimableOverflowOf private method */

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // No balance
    const startingBalance = 0;

    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);

    // Record redemption
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
      /* holder */ holder.address,
      /* projectId */ PROJECT_ID,
      /* tokenCount */ AMOUNT,
      /* memo */ 'test',
      METADATA,
    );

    // Expect recorded balance to not have changed
    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);
  });

  it('Should record redemption with a datasource and emit event', async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      mockJbFundingCycleDataSource,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      addrs,
      CURRENCY_ETH,
    } = await setup();

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    const reservedRate = 0;
    const redemptionRate = 10000;
    const ballotRedemptionRate = 10000;

    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
      redemptionRate: redemptionRate,
      ballotRedemptionRate: ballotRedemptionRate,
      useDataSourceForRedeem: 1,
      dataSource: mockJbFundingCycleDataSource.address,
    });
    const delegate = addrs[0];

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    const startingBalance = AMOUNT.mul(ethers.BigNumber.from(2));

    const newMemo = 'new memo';
    await mockJbFundingCycleDataSource.mock.redeemParams
      .withArgs([
        // JBRedeemParamsData obj
        mockJbTerminalSigner.address,
        holder.address,
        PROJECT_ID,
        timestamp,
        /*tokenCount*/ AMOUNT,
        /*totalSupply*/ AMOUNT,
        /*overflow*/ AMOUNT,
        [token, AMOUNT, /*decimals*/ _FIXED_POINT_MAX_FIDELITY, CURRENCY],
        false,
        redemptionRate,
        ballotRedemptionRate,
        'test',
        METADATA,
      ])
      .returns(AMOUNT, newMemo, delegate.address);

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbController.mock.distributionLimitOf
      .withArgs(PROJECT_ID, timestamp, mockJbTerminalSigner.address, token)
      .returns(AMOUNT, CURRENCY_ETH);

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // Add to balance beforehand to have sufficient overflow
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordAddedBalanceFor(
      PROJECT_ID,
      startingBalance,
    );

    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(startingBalance);

    // Record redemption
    const tx = await JBSingleTokenPaymentTerminalStore.connect(
      mockJbTerminalSigner,
    ).callStatic.recordRedemptionFor(
      /* holder */ holder.address,
      /* projectId */ PROJECT_ID,
      /* tokenCount */ AMOUNT,
      /* memo */ 'test',
      METADATA,
    );

    expect(tx.delegate).to.equal(delegate.address);
  });

  /* Sad path tests */
  it(`Can't record redemption if redemptions are paused`, async function () {
    const {
      holder,
      beneficiary,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      mockJbFundingCycleDataSource,
      JBSingleTokenPaymentTerminalStore,
      token,
      timestamp,
    } = await setup();

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    const reservedRate = 0;
    const redemptionRate = 10000;
    const ballotRedemptionRate = 10000;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 1, // Redemptions paused
      reservedRate: reservedRate,
      redemptionRate: redemptionRate,
      ballotRedemptionRate: ballotRedemptionRate,
      useDataSourceForRedeem: 1,
      dataSource: mockJbFundingCycleDataSource.address,
    });

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // Record redemption
    await expect(
      JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
        /* holder */ holder.address,
        /* projectId */ PROJECT_ID,
        /* tokenCount */ AMOUNT,
        /* memo */ 'test',
        METADATA,
      ),
    ).to.be.revertedWith(errors.FUNDING_CYCLE_REDEEM_PAUSED);
  });

  it(`Can't record redemption with claim amount > total supply`, async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      mockJbFundingCycleDataSource,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      addrs,
    } = await setup();

    const reservedRate = 0;
    const redemptionRate = 10000;
    const ballotRedemptionRate = 10000;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
      redemptionRate: redemptionRate,
      ballotRedemptionRate: ballotRedemptionRate,
      useDataSourceForRedeem: 1,
      dataSource: mockJbFundingCycleDataSource.address,
    });
    const delegate = addrs[0];

    await mockJbTokenStore.mock.balanceOf
      .withArgs(holder.address, PROJECT_ID)
      .returns(AMOUNT.add(1));

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    const newMemo = 'new memo';
    await mockJbFundingCycleDataSource.mock.redeemParams
      .withArgs([
        // JBRedeemParamsData obj
        mockJbTerminalSigner.address,
        holder.address,
        PROJECT_ID,
        timestamp,
        /*tokenCount*/ AMOUNT.add(1),
        /*totalSupply*/ AMOUNT,
        /*overflow*/ 0,
        [token, /*reclaim amount*/ 0, /*decimals*/ _FIXED_POINT_MAX_FIDELITY, CURRENCY],
        false,
        redemptionRate,
        ballotRedemptionRate,
        'test',
        METADATA,
      ])
      .returns(AMOUNT, newMemo, delegate.address);

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // Note: The store has 0 balance because we haven't added anything to it
    // Record redemption
    await expect(
      JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
        /* holder */ holder.address,
        /* projectId */ PROJECT_ID,
        /* tokenCount */ AMOUNT.add(1),
        /* memo */ 'test',
        METADATA,
      ),
    ).to.be.revertedWith(errors.INSUFFICIENT_TOKENS);
  });

  it(`Can't record redemption with if claim amount > project's total balance`, async function () {
    const {
      holder,
      beneficiary,
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbTokenStore,
      mockJbFundingCycleDataSource,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
      token,
      addrs,
    } = await setup();

    const reservedRate = 0;
    const redemptionRate = 10000;
    const ballotRedemptionRate = 10000;
    const packedMetadata = packFundingCycleMetadata({
      pauseRedeem: 0,
      reservedRate: reservedRate,
      redemptionRate: redemptionRate,
      ballotRedemptionRate: ballotRedemptionRate,
      useDataSourceForRedeem: 1,
      dataSource: mockJbFundingCycleDataSource.address,
    });
    const delegate = addrs[0];

    await mockJbTokenStore.mock.balanceOf.withArgs(holder.address, PROJECT_ID).returns(AMOUNT);

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.totalOutstandingTokensOf
      .withArgs(PROJECT_ID, reservedRate)
      .returns(AMOUNT);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packedMetadata,
    });

    const newMemo = 'new memo';
    await mockJbFundingCycleDataSource.mock.redeemParams
      .withArgs([
        // JBRedeemParamsData obj
        mockJbTerminalSigner.address,
        holder.address,
        PROJECT_ID,
        timestamp,
        /*tokenCount*/ AMOUNT,
        /*totalSupply*/ AMOUNT,
        /*overflow*/ 0,
        [token, /*reclaim amount*/ 0, /*decimals*/ _FIXED_POINT_MAX_FIDELITY, CURRENCY],
        false,
        redemptionRate,
        ballotRedemptionRate,
        'test',
        METADATA,
      ])
      .returns(AMOUNT, newMemo, delegate.address);

    await mockJbTerminal.mock.token.returns(token);
    await mockJbTerminal.mock.decimals.returns(18);
    await mockJbTerminal.mock.currency.returns(CURRENCY);

    // Note: The store has 0 balance because we haven't added anything to it
    // Record redemption
    await expect(
      JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordRedemptionFor(
        /* holder */ holder.address,
        /* projectId */ PROJECT_ID,
        /* tokenCount */ AMOUNT,
        /* memo */ 'test',
        METADATA,
      ),
    ).to.be.revertedWith(errors.INADEQUATE_PAYMENT_TERMINAL_STORE_BALANCE);
  });
});
