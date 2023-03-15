import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import errors from '../../helpers/errors.json';
import { packFundingCycleMetadata, setBalance } from '../../helpers/utils.js';

import jbDirectory from '../../../artifacts/contracts/interfaces/IJBDirectory.sol/IJBDirectory.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbFeeGauge from '../../../artifacts/contracts/interfaces/IJBFeeGauge.sol/IJBFeeGauge.json';
import jbOperatoreStore from '../../../artifacts/contracts/interfaces/IJBOperatorStore.sol/IJBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/interfaces/IJBProjects.sol/IJBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/interfaces/IJBSplitsStore.sol/IJBSplitsStore.json';
import jbPrices from '../../../artifacts/contracts/interfaces/IJBPrices.sol/IJBPrices.json';

describe('JBPayoutRedemptionPaymentTerminal::useAllowanceOf(...)', function () {
  const AMOUNT_TO_DISTRIBUTE = 40000;
  const AMOUNT = 50000;
  const DEFAULT_FEE = 50000000; // 5%
  const FEE_DISCOUNT = 500000000; // 50%

  const FUNDING_CYCLE_NUM = 1;
  const JUICEBOX_PROJECT_ID = 1;
  const MEMO = 'test memo';
  const PROJECT_ID = 13;
  const WEIGHT = 1000;

  const ETH_ADDRESS = '0x000000000000000000000000000000000000EEEe';

  let MAX_FEE;
  let MAX_FEE_DISCOUNT;
  let AMOUNT_MINUS_FEES;

  let PROCESS_FEES_PERMISSION_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    PROCESS_FEES_PERMISSION_INDEX = await jbOperations.PROCESS_FEES();
  });

  async function setup() {
    const [deployer, caller, beneficiary, otherCaller, projectOwner, terminalOwner] =
      await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const [
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbPrices,
      mockJbSplitsStore,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbFeeGauge.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbPrices.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
    ]);

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    const CURRENCY_ETH = await jbCurrencies.ETH();

    const jbTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );

    const jbEthPaymentTerminal = await jbTerminalFactory
      .connect(deployer)
      .deploy(
        CURRENCY_ETH,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    const jbConstantsFactory = await ethers.getContractFactory('JBConstants');
    const jbConstants = await jbConstantsFactory.deploy();
    MAX_FEE_DISCOUNT = await jbConstants.MAX_FEE_DISCOUNT();
    MAX_FEE = (await jbConstants.MAX_FEE()).toNumber();

    AMOUNT_MINUS_FEES = Math.floor((AMOUNT * MAX_FEE) / (DEFAULT_FEE + MAX_FEE));

    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();
    const PROCESS_FEES_PERMISSION_INDEX = await jbOperations.PROCESS_FEES();
    const USE_ALLOWANCE_PERMISSION_INDEX = await jbOperations.USE_ALLOWANCE();

    let jbTokenFactory = await ethers.getContractFactory('JBTokens');
    let jbToken = await jbTokenFactory.deploy();
    const ETH_ADDRESS = await jbToken.ETH();

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(JUICEBOX_PROJECT_ID, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    await mockJbProjects.mock.ownerOf.returns(projectOwner.address);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        projectOwner.address,
        projectOwner.address,
        PROJECT_ID,
        USE_ALLOWANCE_PERMISSION_INDEX,
      )
      .returns(true);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        projectOwner.address,
        projectOwner.address,
        PROJECT_ID,
        PROCESS_FEES_PERMISSION_INDEX,
      )
      .returns(true);

    const fundingCycle = {
      number: FUNDING_CYCLE_NUM,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: 0,
    };

    return {
      caller,
      beneficiary,
      CURRENCY_ETH,
      ETH_ADDRESS,
      jbEthPaymentTerminal,
      fundingCycle,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      mockJbOperatorStore,
      otherCaller,
      projectOwner,
      terminalOwner,
      timestamp,
    };
  }

  it('Should send funds from overflow, without fees, and emit event', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      fundingCycle,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, AMOUNT);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    // Set fee to zero
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    const tx = await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        beneficiary.address,
        MEMO,
      );

    expect(tx)
      .to.emit(jbEthPaymentTerminal, 'UseAllowance')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _beneficiary */ beneficiary.address,
        /* _amount */ AMOUNT_TO_DISTRIBUTE,
        /* _distributedAmount */ AMOUNT,
        /* _netDistributedAmount */ AMOUNT,
        MEMO,
        /* msg.sender */ projectOwner.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(AMOUNT),
    );
  });

  it('Should send funds from overflow, without fees if the sender is a feeless address, and emit event', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      fundingCycle,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, AMOUNT);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    // Set recipient as feeless
    await jbEthPaymentTerminal.connect(terminalOwner).setFeelessAddress(projectOwner.address, true);

    const tx = await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        beneficiary.address,
        MEMO,
      );

    expect(tx)
      .to.emit(jbEthPaymentTerminal, 'UseAllowance')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _beneficiary */ beneficiary.address,
        /* _amount */ AMOUNT_TO_DISTRIBUTE,
        /* _distributedAmount */ AMOUNT,
        /* _netDistributedAmount */ AMOUNT,
        MEMO,
        /* msg.sender */ projectOwner.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(AMOUNT),
    );
  });

  it('Should work with no amount', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      fundingCycle,
    } = await setup();

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, 0);

    // Set fee to zero
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        /* amount */ AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ 0,
        beneficiary.address,
        MEMO,
      );
  });

  it('Should send funds from overflow, with fees applied, and emit event', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      ETH_ADDRESS,
      fundingCycle,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_FEES);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    const tx = await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        beneficiary.address,
        MEMO,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'UseAllowance')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _beneficiary */ beneficiary.address,
        /* _amount */ AMOUNT_TO_DISTRIBUTE,
        /* _distributedAmount */ AMOUNT,
        /* _netDistributedAmount */ AMOUNT_MINUS_FEES,
        MEMO,
        /* msg.sender */ projectOwner.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(AMOUNT_MINUS_FEES),
    );
  });

  it('Should send funds from overflow, with discounted fees applied if gauge is set', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      ETH_ADDRESS,
      fundingCycle,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    const DISCOUNTED_FEE =
      DEFAULT_FEE - Math.floor((DEFAULT_FEE * FEE_DISCOUNT) / MAX_FEE_DISCOUNT);
    const AMOUNT_MINUS_DISCOUNTED_FEES = Math.floor(
      (AMOUNT * MAX_FEE) / (MAX_FEE + DISCOUNTED_FEE),
    );

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(FEE_DISCOUNT);

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_DISCOUNTED_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_DISCOUNTED_FEES);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    const tx = await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        beneficiary.address,
        MEMO,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'UseAllowance')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _beneficiary */ beneficiary.address,
        /* _amount */ AMOUNT_TO_DISTRIBUTE,
        /* _distributedAmount */ AMOUNT,
        /* _netDistributedAmount */ AMOUNT_MINUS_DISCOUNTED_FEES,
        MEMO,
        /* msg.sender */ projectOwner.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(AMOUNT_MINUS_DISCOUNTED_FEES),
    );
  });

  it('Should send funds from overflow, with non discounted-fees applied if the fee gauge is faulty', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      ETH_ADDRESS,
      fundingCycle,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).reverts();

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_FEES);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    const tx = await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        beneficiary.address,
        MEMO,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'UseAllowance')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _beneficiary */ beneficiary.address,
        /* _amount */ AMOUNT_TO_DISTRIBUTE,
        /* _distributedAmount */ AMOUNT,
        /* _netDistributedAmount */ AMOUNT_MINUS_FEES,
        MEMO,
        /* msg.sender */ projectOwner.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(AMOUNT_MINUS_FEES),
    );
  });

  it('Should send funds from overflow, with non discounted-fees applied if discount is above 100%', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      ETH_ADDRESS,
      fundingCycle,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(MAX_FEE_DISCOUNT + 1);

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_FEES);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    const tx = await jbEthPaymentTerminal
      .connect(projectOwner)
      .useAllowanceOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        CURRENCY_ETH,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        beneficiary.address,
        MEMO,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'UseAllowance')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _beneficiary */ beneficiary.address,
        /* _amount */ AMOUNT_TO_DISTRIBUTE,
        /* _distributedAmount */ AMOUNT,
        /* _netDistributedAmount */ AMOUNT_MINUS_FEES,
        MEMO,
        /* msg.sender */ projectOwner.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(AMOUNT_MINUS_FEES),
    );
  });

  it('Should send funds from overflow, with fees held, then process fees if caller is project owner, and emit event', async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      ETH_ADDRESS,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    const newFundingCycle = {
      number: FUNDING_CYCLE_NUM,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: 1 }), // Hold fees
    };

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(newFundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(newFundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_FEES);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    // Use allowance and hold fee
    expect(
      await jbEthPaymentTerminal
        .connect(projectOwner)
        .useAllowanceOf(
          PROJECT_ID,
          AMOUNT_TO_DISTRIBUTE,
          CURRENCY_ETH,
          ethers.constants.AddressZero,
          /* minReturnedTokens */ AMOUNT,
          beneficiary.address,
          MEMO,
        ),
    )
      .to.emit(jbEthPaymentTerminal, 'HoldFee')
      .withArgs(
        PROJECT_ID,
        AMOUNT,
        DEFAULT_FEE,
        0, // discount fee
        projectOwner.address,
        projectOwner.address,
      );

    // Should be holding fees in the contract
    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([
      [ethers.BigNumber.from(AMOUNT), DEFAULT_FEE, /*discount*/ 0, projectOwner.address],
    ]);

    // Process held fees
    const tx = await jbEthPaymentTerminal.connect(projectOwner).processFees(PROJECT_ID);

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'ProcessFee')
      .withArgs(
        PROJECT_ID,
        ethers.BigNumber.from(AMOUNT).sub(
          ethers.BigNumber.from(AMOUNT)
            .mul(MAX_FEE)
            .div(ethers.BigNumber.from(MAX_FEE).add(DEFAULT_FEE)),
        ),
        true,
        projectOwner.address,
        projectOwner.address,
      );

    // Held fees shoudn't exist after being processed
    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([]);
  });

  it('Should send funds from overflow, with fees held, then process fees if caller is authorized, and emit event', async function () {
    const {
      beneficiary,
      caller,
      CURRENCY_ETH,
      ETH_ADDRESS,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJbOperatorStore,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    const newFundingCycle = {
      number: FUNDING_CYCLE_NUM,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: 1 }), // Hold fees
    };

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(newFundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(newFundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_FEES);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    // Use allowance and hold fee
    expect(
      await jbEthPaymentTerminal
        .connect(projectOwner)
        .useAllowanceOf(
          PROJECT_ID,
          AMOUNT_TO_DISTRIBUTE,
          CURRENCY_ETH,
          ethers.constants.AddressZero,
          /* minReturnedTokens */ AMOUNT,
          beneficiary.address,
          MEMO,
        ),
    )
      .to.emit(jbEthPaymentTerminal, 'HoldFee')
      .withArgs(
        PROJECT_ID,
        AMOUNT,
        DEFAULT_FEE,
        0, // discount fee
        projectOwner.address,
        projectOwner.address,
      );

    // Should be holding fees in the contract
    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([
      [ethers.BigNumber.from(AMOUNT), DEFAULT_FEE, 0, projectOwner.address],
    ]);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, PROCESS_FEES_PERMISSION_INDEX)
      .returns(true);

    // Process held fees
    const tx = await jbEthPaymentTerminal.connect(caller).processFees(PROJECT_ID);

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'ProcessFee')
      .withArgs(
        PROJECT_ID,
        ethers.BigNumber.from(AMOUNT).sub(
          ethers.BigNumber.from(AMOUNT)
            .mul(MAX_FEE)
            .div(ethers.BigNumber.from(MAX_FEE).add(DEFAULT_FEE)),
        ),
        true,
        projectOwner.address,
        caller.address,
      );

    // Held fees shoudn't exist after being processed
    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([]);
  });

  it('Cannot process fees if caller is not authorized', async function () {
    const {
      beneficiary,
      caller,
      CURRENCY_ETH,
      ETH_ADDRESS,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJbOperatorStore,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      timestamp,
    } = await setup();

    const newFundingCycle = {
      number: FUNDING_CYCLE_NUM,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: 1 }), // Hold fees
    };

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(newFundingCycle, AMOUNT);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        {
          token: ETH_ADDRESS,
          value: AMOUNT - AMOUNT_MINUS_FEES,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        JUICEBOX_PROJECT_ID,
        CURRENCY_ETH,
        projectOwner.address,
        /* memo */ '',
        '0x',
      )
      .returns(newFundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // Give terminal sufficient ETH
    await setBalance(jbEthPaymentTerminal.address, AMOUNT_MINUS_FEES);

    // Set fee to default 5%
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(DEFAULT_FEE);

    // Use allowance and hold fee
    expect(
      await jbEthPaymentTerminal
        .connect(projectOwner)
        .useAllowanceOf(
          PROJECT_ID,
          AMOUNT_TO_DISTRIBUTE,
          CURRENCY_ETH,
          ethers.constants.AddressZero,
          /* minReturnedTokens */ AMOUNT,
          beneficiary.address,
          MEMO,
        ),
    )
      .to.emit(jbEthPaymentTerminal, 'HoldFee')
      .withArgs(
        PROJECT_ID,
        AMOUNT,
        DEFAULT_FEE,
        0, // discount fee
        projectOwner.address,
        projectOwner.address,
      );

    // Should be holding fees in the contract
    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([
      [ethers.BigNumber.from(AMOUNT), DEFAULT_FEE, 0, projectOwner.address],
    ]);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, PROCESS_FEES_PERMISSION_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, PROCESS_FEES_PERMISSION_INDEX)
      .returns(false);

    await expect(jbEthPaymentTerminal.connect(caller).processFees(PROJECT_ID)).to.be.revertedWith(
      errors.UNAUTHORIZED,
    );
  });

  it(`Can't send funds from overflow without project access`, async function () {
    const { beneficiary, CURRENCY_ETH, jbEthPaymentTerminal, mockJbOperatorStore, otherCaller } =
      await setup();

    await mockJbOperatorStore.mock.hasPermission.returns(false);

    await expect(
      jbEthPaymentTerminal
        .connect(otherCaller)
        .useAllowanceOf(
          PROJECT_ID,
          AMOUNT_TO_DISTRIBUTE,
          CURRENCY_ETH,
          ethers.constants.AddressZero,
          /* minReturnedTokens */ AMOUNT,
          beneficiary.address,
          MEMO,
        ),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });
  it("Can't distribute if amount is less than expected", async function () {
    const {
      beneficiary,
      CURRENCY_ETH,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      projectOwner,
      terminalOwner,
      fundingCycle,
    } = await setup();

    await mockJBPaymentTerminalStore.mock.recordUsedAllowanceOf
      .withArgs(PROJECT_ID, /* amount */ AMOUNT_TO_DISTRIBUTE, CURRENCY_ETH)
      .returns(fundingCycle, 0);

    // Set fee to zero
    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await expect(
      jbEthPaymentTerminal
        .connect(projectOwner)
        .useAllowanceOf(
          PROJECT_ID,
          /* amount */ AMOUNT_TO_DISTRIBUTE,
          CURRENCY_ETH,
          ethers.constants.AddressZero,
          /* minReturnedTokens */ 1,
          beneficiary.address,
          MEMO,
        ),
    ).to.be.revertedWith(errors.INADEQUATE_DISTRIBUTION_AMOUNT);
  });
});
