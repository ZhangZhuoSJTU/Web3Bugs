import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { makeSplits, packFundingCycleMetadata, setBalance } from '../../helpers/utils.js';
import errors from '../../helpers/errors.json';

import jbAllocator from '../../../artifacts/contracts/interfaces/IJBSplitAllocator.sol/IJBSplitAllocator.json';
import jbDirectory from '../../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import JBETHPaymentTerminal from '../../../artifacts/contracts/JBETHPaymentTerminal.sol/JBETHPaymentTerminal.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbFeeGauge from '../../../artifacts/contracts/interfaces/IJBFeeGauge.sol/IJBFeeGauge.json';
import jbOperatoreStore from '../../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbPrices from '../../../artifacts/contracts/JBPrices.sol/JBPrices.json';
import IERC20Metadata from '../../../artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json';

describe('JBPayoutRedemptionPaymentTerminal::distributePayoutsOf(...)', function () {
  const PLATFORM_PROJECT_ID = 1;
  const PROJECT_ID = 2;
  const OTHER_PROJECT_ID = 3;

  const AMOUNT_TO_DISTRIBUTE = 1100000000000;
  const AMOUNT_DISTRIBUTED = 1000000000000;

  const DEFAULT_FEE = 25000000; // 2.5%
  const FEE_DISCOUNT = 500000000; // 50%

  const CURRENCY = 1;
  const MIN_TOKEN_REQUESTED = 180;
  const MEMO = 'Memo Test';

  let ETH_ADDRESS;
  let ETH_PAYOUT_INDEX;
  let SPLITS_TOTAL_PERCENT;
  let MAX_FEE;
  let MAX_FEE_DISCOUNT;
  let AMOUNT_MINUS_FEES;

  let fundingCycle;

  before(async function () {
    let jbTokenFactory = await ethers.getContractFactory('JBTokens');
    let jbToken = await jbTokenFactory.deploy();

    let jbSplitsGroupsFactory = await ethers.getContractFactory('JBSplitsGroups');
    let jbSplitsGroups = await jbSplitsGroupsFactory.deploy();

    let jbConstantsFactory = await ethers.getContractFactory('JBConstants');
    let jbConstants = await jbConstantsFactory.deploy();

    ETH_PAYOUT_INDEX = await jbSplitsGroups.ETH_PAYOUT();

    ETH_ADDRESS = await jbToken.ETH();
    SPLITS_TOTAL_PERCENT = await jbConstants.SPLITS_TOTAL_PERCENT();
    MAX_FEE_DISCOUNT = await jbConstants.MAX_FEE_DISCOUNT();
    MAX_FEE = (await jbConstants.MAX_FEE()).toNumber();

    let FEE =
      AMOUNT_DISTRIBUTED - Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (DEFAULT_FEE + MAX_FEE));
    AMOUNT_MINUS_FEES = AMOUNT_DISTRIBUTED - FEE;
  });

  async function setup() {
    let [deployer, projectOwner, terminalOwner, caller, beneficiaryOne, beneficiaryTwo, ...addrs] =
      await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    fundingCycle = {
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata(),
    };

    let [
      fakeToken,
      mockJbAllocator,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
    ] = await Promise.all([
      deployMockContract(deployer, IERC20Metadata.abi),
      deployMockContract(deployer, jbAllocator.abi),
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, JBETHPaymentTerminal.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbFeeGauge.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPrices.abi),
    ]);

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    const CURRENCY_ETH = await jbCurrencies.ETH();
    const CURRENCY_USD = await jbCurrencies.USD();

    let jbEthTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );
    let jbErc20TerminalFactory = await ethers.getContractFactory(
      'contracts/JBERC20PaymentTerminal.sol:JBERC20PaymentTerminal',
      deployer,
    );

    let jbEthPaymentTerminal = await jbEthTerminalFactory
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

    await fakeToken.mock.decimals.returns(18);

    let jbErc20PaymentTerminal = await jbErc20TerminalFactory
      .connect(deployer)
      .deploy(
        fakeToken.address,
        CURRENCY_USD,
        CURRENCY_USD,
        1,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    await mockJbEthPaymentTerminal.mock.decimals.returns(18);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    // Used with hardcoded one to get JBDao terminal
    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    // ETH distribution
    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_DISTRIBUTED);

    // ERC20 distribution
    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_DISTRIBUTED);

    await setBalance(jbEthPaymentTerminal.address, AMOUNT_DISTRIBUTED);

    return {
      deployer,
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      addrs,
      jbEthPaymentTerminal,
      jbErc20PaymentTerminal,
      mockJbAllocator,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      mockJbProjects,
      mockJbSplitsStore,
      timestamp,
      CURRENCY_USD,
      fakeToken,
    };
  }

  it('Should distribute payout without fee when fee is set to 0 and emit event', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*amount*/ AMOUNT_TO_DISTRIBUTE,
        /*distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and emit event, without fee if the beneficiary is another project within the same terminal', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      projectId: OTHER_PROJECT_ID,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJBPaymentTerminalStore.mock.recordPaymentFrom
          .withArgs(
            jbEthPaymentTerminal.address,
            [
              /*token*/ '0x000000000000000000000000000000000000eeee',
              /*amount paid*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
              /*decimal*/ 18,
              CURRENCY,
            ],
            split.projectId,
            CURRENCY,
            split.beneficiary,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns(fundingCycle, /*count*/ 0, /* delegate */ ethers.constants.AddressZero, '');
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          )
          .and.to.emit(jbEthPaymentTerminal, 'Pay')
          .withArgs(
            timestamp,
            1,
            split.projectId,
            jbEthPaymentTerminal.address,
            split.beneficiary,
            Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
            0,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it("Should distribute payout and emit event, without fee if the platform project has not terminal for this terminal's token", async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      projectId: OTHER_PROJECT_ID,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(ethers.constants.AddressZero);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJBPaymentTerminalStore.mock.recordPaymentFrom
          .withArgs(
            jbEthPaymentTerminal.address,
            [
              /*token*/ '0x000000000000000000000000000000000000eeee',
              /*amount paid*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
              /*decimal*/ 18,
              CURRENCY,
            ],
            split.projectId,
            CURRENCY,
            split.beneficiary,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          )
          .and.to.emit(jbEthPaymentTerminal, 'Pay')
          .withArgs(
            timestamp,
            1,
            split.projectId,
            jbEthPaymentTerminal.address,
            split.beneficiary,
            Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
            0,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout minus fee, hold the fee in the contract and emit event', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(
        {
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata({ holdFees: 1 }),
        },
        AMOUNT_DISTRIBUTED,
      );

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );

    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([
      [
        ethers.BigNumber.from(AMOUNT_DISTRIBUTED),
        DEFAULT_FEE,
        /*discount*/ 0,
        projectOwner.address,
      ],
    ]);
  });

  it('Should distribute payout minus fee and pay the fee via Juicebox DAO terminal, if using another terminal', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbEthPaymentTerminal,
      mockJbDirectory,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        ETH_ADDRESS,
        projectOwner.address,
        0,
        /*preferedClaimedToken*/ false,
        '',
        '0x',
      )
      .returns(0);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout without fee if distributing to a project in another terminal not subject to fees, using add to balance', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({ count: 2, projectId: OTHER_PROJECT_ID, preferAddToBalance: true });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.addToBalanceOf
          .withArgs(
            split.projectId,
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            ETH_ADDRESS,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns();
      }),
    );

    await jbEthPaymentTerminal
      .connect(terminalOwner)
      .setFeelessAddress(mockJbEthPaymentTerminal.address, true);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout without fee if distributing to a project in another terminal not subject to fees, using pay, with a beneficiary', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbSplitsStore,
    } = await setup();
    const beneficiaryOne = ethers.Wallet.createRandom();
    const beneficiaryTwo = ethers.Wallet.createRandom();

    const splits = makeSplits({
      count: 2,
      projectId: OTHER_PROJECT_ID,
      preferAddToBalance: false,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            split.projectId,
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            ETH_ADDRESS,
            split.beneficiary,
            0,
            split.preferClaimed,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns(0);
      }),
    );

    await jbEthPaymentTerminal
      .connect(terminalOwner)
      .setFeelessAddress(mockJbEthPaymentTerminal.address, true);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout without fee if distributing to a project in another terminal not subject to fees, using pay, with caller as default beneficiary', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbSplitsStore,
    } = await setup();

    const splits = makeSplits({ count: 2, projectId: OTHER_PROJECT_ID, preferAddToBalance: false });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            split.projectId,
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            ETH_ADDRESS,
            caller.address,
            0,
            split.preferClaimed,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns(0);
      }),
    );

    await jbEthPaymentTerminal
      .connect(terminalOwner)
      .setFeelessAddress(mockJbEthPaymentTerminal.address, true);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute to projects in same terminal using pay if prefered', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbEthPaymentTerminal,
      mockJbDirectory,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      preferAddToBalance: false,
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    // Fee
    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        ETH_ADDRESS,
        projectOwner.address,
        0,
        /*preferedClaimedToken*/ false,
        '',
        '0x',
      )
      .returns(0);

    await mockJbEthPaymentTerminal.mock.addToBalanceOf
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        ETH_ADDRESS,
        '',
        '0x',
      )
      .returns();

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute to projects in same terminal using addToBalance if prefered', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbEthPaymentTerminal,
      mockJbDirectory,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      preferAddToBalance: true,
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    // Fee
    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        ETH_ADDRESS,
        projectOwner.address,
        0,
        /*preferedClaimedToken*/ false,
        '',
        '0x',
      )
      .returns(0);

    await mockJbEthPaymentTerminal.mock.addToBalanceOf
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        ETH_ADDRESS,
        '',
        '0x',
      )
      .returns();

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout minus fee and pay the fee via the same terminal, if using Juicebox DAO terminal', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJBPaymentTerminalStore,
      mockJbDirectory,
      mockJbSplitsStore,
    } = await setup();
    const AMOUNT_MINUS_FEES = Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (DEFAULT_FEE + MAX_FEE));
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        jbEthPaymentTerminal.address,
        [
          /*token*/ '0x000000000000000000000000000000000000eeee',
          /*amount paid*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
          /*decimal*/ 18,
          CURRENCY,
        ],
        PLATFORM_PROJECT_ID,
        /*CURRENCY*/ CURRENCY,
        projectOwner.address,
        '',
        '0x',
      )
      .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');

    await Promise.all(
      splits.map(async (split) => {
        await mockJBPaymentTerminalStore.mock.recordPaymentFrom
          .withArgs(
            jbEthPaymentTerminal.address,
            [
              /*token*/ '0x000000000000000000000000000000000000eeee',
              /*amount paid*/ Math.floor(
              (AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
              /*decimal*/ 18,
              CURRENCY,
            ],
            split.projectId,
            CURRENCY,
            split.beneficiary,
            '',
            '0x',
          )
          .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          )
          .and.to.emit(jbEthPaymentTerminal, 'Pay')
          .withArgs(
            timestamp,
            1,
            /*projectId*/ 1,
            jbEthPaymentTerminal.address,
            projectOwner.address,
            Math.floor(AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES),
            0,
            '',
            '0x',
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout minus discounted fee if a fee gauge is set', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbFeeGauge,
      mockJbSplitsStore,
    } = await setup();

    const DISCOUNTED_FEE =
      DEFAULT_FEE - Math.floor((DEFAULT_FEE * FEE_DISCOUNT) / MAX_FEE_DISCOUNT);
    const AMOUNT_MINUS_FEES = Math.floor(
      (AMOUNT_DISTRIBUTED * MAX_FEE) / (MAX_FEE + DISCOUNTED_FEE),
    );
    const FEE_AMOUNT = AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES;

    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(FEE_DISCOUNT);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1, //JBX Dao
        FEE_AMOUNT,
        ETH_ADDRESS,
        projectOwner.address,
        0,
        false,
        '',
        '0x',
      )
      .returns(0);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            split.projectId, //JBX Dao
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            ETH_ADDRESS,
            split.beneficiary,
            0,
            split.preferClaimed,
            '',
            '0x',
          )
          .returns(0);
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ FEE_AMOUNT,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout minus non-discounted fee if the fee gauge is faulty', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbFeeGauge,
      mockJbSplitsStore,
    } = await setup();

    const AMOUNT_MINUS_FEES = Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (MAX_FEE + DEFAULT_FEE));

    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).reverts();

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES, // 0 if fee is in ETH (as the amount is then in msg.value)
        ETH_ADDRESS,
        projectOwner.address,
        0,
        false,
        '',
        '0x',
      )
      .returns(0);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            1, //JBX Dao
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            ETH_ADDRESS,
            split.beneficiary,
            0,
            split.preferClaimed,
            '',
            '0x',
          )
          .returns(0);
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout minus non-discounted fee if the discount is above 100%', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbFeeGauge,
      mockJbSplitsStore,
    } = await setup();

    const AMOUNT_MINUS_FEES = Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (MAX_FEE + DEFAULT_FEE));

    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(MAX_FEE_DISCOUNT + 1);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1, //JBX Dao
        AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES, // 0 if fee is in ETH (as the amount is then in msg.value)
        ETH_ADDRESS,
        projectOwner.address,
        0,
        false,
        '',
        '0x',
      )
      .returns(0);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            1, //JBX Dao
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            ETH_ADDRESS,
            split.beneficiary,
            0,
            split.preferClaimed,
            '',
            '0x',
          )
          .returns(0);
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ AMOUNT_DISTRIBUTED - AMOUNT_MINUS_FEES,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use the allocator if set in splits', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbAllocator,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({ count: 2, allocator: mockJbAllocator.address });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbAllocator.mock.allocate
          .withArgs({
            // JBSplitAllocationData
            token: ETH_ADDRESS,
            amount: Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
            decimals: 18,
            projectId: PROJECT_ID,
            group: ETH_PAYOUT_INDEX,
            split,
          })
          .returns();
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use the allocator if set in splits, using a fee discount', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbAllocator,
      mockJbFeeGauge,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();

    const DISCOUNTED_FEE =
      DEFAULT_FEE - Math.floor((DEFAULT_FEE * FEE_DISCOUNT) / MAX_FEE_DISCOUNT);

    const FEE_AMOUNT =
      AMOUNT_DISTRIBUTED - Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (DISCOUNTED_FEE + MAX_FEE));

    const AMOUNT_MINUS_FEES = AMOUNT_DISTRIBUTED - FEE_AMOUNT;

    const splits = makeSplits({ count: 1, allocator: mockJbAllocator.address });

    fundingCycle = {
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: true }),
    };

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_DISTRIBUTED);

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(FEE_DISCOUNT);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbAllocator.mock.allocate
          .withArgs({
            // JBSplitAllocationData
            token: ETH_ADDRESS,
            amount: AMOUNT_MINUS_FEES, // One split
            decimals: 18,
            projectId: PROJECT_ID,
            group: ETH_PAYOUT_INDEX,
            split,
          })
          .returns();
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT_MINUS_FEES,
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ FEE_AMOUNT,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use the allocator if set in splits without fee if the allocator is feeless', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbAllocator,
      mockJbFeeGauge,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();

    const splits = makeSplits({ count: 1, allocator: mockJbAllocator.address });

    fundingCycle = {
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: true }),
    };

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_DISTRIBUTED);

    await jbEthPaymentTerminal
      .connect(terminalOwner)
      .setFeelessAddress(mockJbAllocator.address, true);

    //await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(FEE_DISCOUNT);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbAllocator.mock.allocate
          .withArgs({
            // JBSplitAllocationData
            token: ETH_ADDRESS,
            amount: AMOUNT_DISTRIBUTED, // One split
            decimals: 18,
            projectId: PROJECT_ID,
            group: ETH_PAYOUT_INDEX,
            split,
          })
          .returns();
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT_DISTRIBUTED,
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use the allocator if set in splits, using a non-eth token', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbErc20PaymentTerminal,
      timestamp,
      mockJbAllocator,
      mockJbSplitsStore,
      fakeToken,
    } = await setup();
    const splits = makeSplits({ count: 2, allocator: mockJbAllocator.address });

    await jbErc20PaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await fakeToken.mock.approve
          .withArgs(
            mockJbAllocator.address,
            Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
          )
          .returns(true);

        await mockJbAllocator.mock.allocate
          .withArgs({
            // JBSplitAllocationData
            token: fakeToken.address,
            amount: Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
            decimals: 18,
            projectId: PROJECT_ID,
            group: ETH_PAYOUT_INDEX,
            split,
          })
          .returns();
      }),
    );

    let tx = await jbErc20PaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbErc20PaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbErc20PaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout to the caller if no beneficiary, allocator or project id is set in split', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*amount*/ AMOUNT_TO_DISTRIBUTE,
        /*distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );

    expect(await tx).to.changeEtherBalance(caller, AMOUNT_DISTRIBUTED);
  });

  it('Should distribute payout and use the terminal of the project if project id and beneficiary are set in splits', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbSplitsStore,
      beneficiaryOne,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      projectId: OTHER_PROJECT_ID,
      beneficiary: [beneficiaryOne.address, beneficiaryOne.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            split.projectId,
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            ETH_ADDRESS,
            split.beneficiary,
            /*minReturnedToken*/ 0,
            split.preferClaimed,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns(0);
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout using a fee discount and use the terminal of the project if project id is set in splits', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbFeeGauge,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
    } = await setup();
    const DISCOUNTED_FEE =
      DEFAULT_FEE - Math.floor((DEFAULT_FEE * FEE_DISCOUNT) / MAX_FEE_DISCOUNT);

    const FEE_AMOUNT =
      AMOUNT_DISTRIBUTED - Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (DISCOUNTED_FEE + MAX_FEE));

    const AMOUNT_MINUS_FEES = AMOUNT_DISTRIBUTED - FEE_AMOUNT;

    await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address);

    await mockJbFeeGauge.mock.currentDiscountFor.withArgs(PROJECT_ID).returns(FEE_DISCOUNT);

    const splits = makeSplits({ count: 1, projectId: OTHER_PROJECT_ID, preferAddToBalance: true });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    fundingCycle = {
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: true }),
    };

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_DISTRIBUTED);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.addToBalanceOf
          .withArgs(
            split.projectId,
            AMOUNT_MINUS_FEES,
            ETH_ADDRESS,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns();
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ FEE_AMOUNT,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use the terminal of the project if project id is set in splits, for non-eth token', async function () {
    const {
      projectOwner,
      caller,
      jbErc20PaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
      fakeToken,
      CURRENCY_USD,
    } = await setup();

    const FEE_AMOUNT =
      AMOUNT_DISTRIBUTED - Math.floor((AMOUNT_DISTRIBUTED * MAX_FEE) / (DEFAULT_FEE + MAX_FEE));

    const AMOUNT_MINUS_FEES = AMOUNT_DISTRIBUTED - FEE_AMOUNT;

    const splits = makeSplits({ count: 2, projectId: OTHER_PROJECT_ID, preferAddToBalance: true });

    fundingCycle = {
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata(),
    };

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_DISTRIBUTED);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, fakeToken.address)
      .returns(mockJbEthPaymentTerminal.address);

    // Protocol project accept the token as fee
    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(1, fakeToken.address)
      .returns(mockJbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await fakeToken.mock.approve
          .withArgs(
            mockJbEthPaymentTerminal.address,
            Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
          )
          .returns(true);

        await mockJbEthPaymentTerminal.mock.addToBalanceOf
          .withArgs(
            split.projectId,
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            fakeToken.address,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns();
      }),
    );

    // Fee
    await mockJbEthPaymentTerminal.mock.pay
      .withArgs(
        1,
        FEE_AMOUNT,
        fakeToken.address,
        projectOwner.address,
        /*minReturnedToken*/ 0,
        false,
        '',
        '0x',
      )
      .returns(0);

    await fakeToken.mock.approve
      .withArgs(mockJbEthPaymentTerminal.address, FEE_AMOUNT)
      .returns(true);

    let tx = await jbErc20PaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbErc20PaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((AMOUNT_MINUS_FEES * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbErc20PaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ FEE_AMOUNT,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use this terminal if the project set in splits uses it', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      projectId: OTHER_PROJECT_ID,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJBPaymentTerminalStore.mock.recordPaymentFrom
          .withArgs(
            jbEthPaymentTerminal.address,
            [
              /*token*/ '0x000000000000000000000000000000000000eeee',
              /*amount paid*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
              /*decimal*/ 18,
              CURRENCY,
            ],
            split.projectId,
            CURRENCY,
            split.beneficiary,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
          )
          .returns(fundingCycle, 0, /* delegate */ ethers.constants.AddressZero, '');
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          )
          .and.to.emit(jbEthPaymentTerminal, 'Pay')
          .withArgs(
            timestamp,
            1,
            split.projectId,
            jbEthPaymentTerminal.address,
            split.beneficiary,
            Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
            0,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout and use this terminal if the project set in splits uses it, with no beneficairies', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      projectId: OTHER_PROJECT_ID,
      preferAddToBalance: true,
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
          .withArgs(
            split.projectId,
            /*amount paid*/ Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
          )
          .returns();
      }),
    );

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          )
          .and.to.emit(jbEthPaymentTerminal, 'AddToBalance')
          .withArgs(
            split.projectId,
            Math.floor((AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT),
            0,
            '',
            ethers.utils.hexZeroPad(ethers.utils.hexlify(PROJECT_ID), 32),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should send any leftover after distributing to the projectOwner', async function () {
    const {
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
    } = await setup();
    const PERCENT = SPLITS_TOTAL_PERCENT / 10;
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      percent: PERCENT,
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_DISTRIBUTED * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_DISTRIBUTED,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ AMOUNT_DISTRIBUTED -
        ((AMOUNT_DISTRIBUTED * PERCENT) / SPLITS_TOTAL_PERCENT) * splits.length,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout of 0 and emit event', async function () {
    const {
      projectOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, 0);

    let tx = await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        0,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbEthPaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor((0 * split.percent) / SPLITS_TOTAL_PERCENT),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ 0,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Should distribute payout in ERC20 token and emit event', async function () {
    const {
      projectOwner,
      caller,
      CURRENCY_USD,
      beneficiaryOne,
      beneficiaryTwo,
      fakeToken,
      jbErc20PaymentTerminal,
      terminalOwner,
      timestamp,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbErc20PaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT_TO_DISTRIBUTE, CURRENCY)
      .returns(fundingCycle, AMOUNT_TO_DISTRIBUTE);

    await Promise.all(
      splits.map(async (split) => {
        await fakeToken.mock.transfer
          .withArgs(
            split.beneficiary,
            Math.floor((AMOUNT_TO_DISTRIBUTE * split.percent) / SPLITS_TOTAL_PERCENT),
          )
          .returns(true);
      }),
    );

    let tx = await jbErc20PaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT_TO_DISTRIBUTE,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        AMOUNT_TO_DISTRIBUTE,
        MEMO,
      );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbErc20PaymentTerminal, 'DistributeToPayoutSplit')
          .withArgs(
            PROJECT_ID,
            /*_fundingCycle.configuration*/ timestamp,
            ETH_PAYOUT_INDEX,
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            /*payoutAmount*/ Math.floor(
              (AMOUNT_TO_DISTRIBUTE * split.percent) / SPLITS_TOTAL_PERCENT,
            ),
            caller.address,
          );
      }),
    );

    expect(await tx)
      .to.emit(jbErc20PaymentTerminal, 'DistributePayouts')
      .withArgs(
        /*_fundingCycle.configuration*/ timestamp,
        /*_fundingCycle.number*/ 1,
        PROJECT_ID,
        projectOwner.address,
        /*_amount*/ AMOUNT_TO_DISTRIBUTE,
        /*_distributedAmount*/ AMOUNT_TO_DISTRIBUTE,
        /*_feeAmount*/ 0,
        /*_leftoverDistributionAmount*/ 0,
        MEMO,
        caller.address,
      );
  });

  it('Cannot have a zero address terminal for a project set in split', async function () {
    const {
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      timestamp,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({ count: 2, projectId: OTHER_PROJECT_ID });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(OTHER_PROJECT_ID, ETH_ADDRESS)
      .returns(ethers.constants.AddressZero);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbEthPaymentTerminal.mock.pay
          .withArgs(
            split.projectId,
            0,
            ETH_ADDRESS,
            split.beneficiary,
            0,
            split.preferClaimed,
            '',
            '0x',
          )
          .returns(0);
      }),
    );

    await expect(
      jbEthPaymentTerminal
        .connect(caller)
        .distributePayoutsOf(
          PROJECT_ID,
          AMOUNT_TO_DISTRIBUTE,
          ETH_PAYOUT_INDEX,
          ethers.constants.AddressZero,
          MIN_TOKEN_REQUESTED,
          MEMO,
        ),
    ).to.be.revertedWith(errors.TERMINAL_IN_SPLIT_ZERO_ADDRESS);
  });

  it('Cannot distribute payouts of the distributed amount is less than expected', async function () {
    const {
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await jbEthPaymentTerminal.connect(terminalOwner).setFee(0);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await expect(
      jbEthPaymentTerminal
        .connect(caller)
        .distributePayoutsOf(
          PROJECT_ID,
          AMOUNT_TO_DISTRIBUTE,
          ETH_PAYOUT_INDEX,
          ethers.constants.AddressZero,
          AMOUNT_DISTRIBUTED + 1,
          MEMO,
        ),
    ).to.be.revertedWith(errors.INADEQUATE_DISTRIBUTION_AMOUNT);
  });
});
