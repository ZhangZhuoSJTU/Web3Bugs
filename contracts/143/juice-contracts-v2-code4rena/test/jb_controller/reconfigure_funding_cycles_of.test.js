import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { makeSplits, packFundingCycleMetadata } from '../helpers/utils';
import errors from '../helpers/errors.json';

import JbController from '../../artifacts/contracts/JBController.sol/JBController.json';
import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbTerminal from '../../artifacts/contracts/JBETHPaymentTerminal.sol/JBETHPaymentTerminal.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::reconfigureFundingCycleOf(...)', function () {
  const PROJECT_ID = 1;
  const PROJECT_START = '1';
  const MEMO = 'Test Memo';

  let RECONFIGURE_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    RECONFIGURE_INDEX = await jbOperations.RECONFIGURE();
  });

  async function setup() {
    let [deployer, projectOwner, caller, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    let [
      mockJbController,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbTerminal1,
      mockJbTerminal2,
      mockJbTokenStore,
    ] = await Promise.all([
      deployMockContract(deployer, JbController.abi),
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbFundingCycleStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbTerminal.abi),
      deployMockContract(deployer, jbTerminal.abi),
      deployMockContract(deployer, jbTokenStore.abi),
    ]);

    let jbControllerFactory = await ethers.getContractFactory(
      'contracts/JBController.sol:JBController',
    );
    let jbController = await jbControllerFactory.deploy(
      mockJbOperatorStore.address,
      mockJbProjects.address,
      mockJbDirectory.address,
      mockJbFundingCycleStore.address,
      mockJbTokenStore.address,
      mockJbSplitsStore.address,
    );

    const fundingCycleData = makeFundingCycleDataStruct();
    const fundingCycleMetadata = makeFundingCycleMetadata();
    const splits = makeSplits();

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJbFundingCycleStore.mock.configureFor
      .withArgs(PROJECT_ID, fundingCycleData, fundingCycleMetadata.packed, PROJECT_START)
      .returns(
        Object.assign(
          {
            number: 1,
            configuration: timestamp,
            basedOn: timestamp,
            start: timestamp,
            metadata: fundingCycleMetadata.packed,
          },
          fundingCycleData,
        ),
      );

    const groupedSplits = [{ group: 1, splits }];

    await mockJbSplitsStore.mock.set
      .withArgs(PROJECT_ID, /*configuration=*/ timestamp, groupedSplits)
      .returns();

    return {
      deployer,
      projectOwner,
      caller,
      addrs,
      jbController,
      mockJbDirectory,
      mockJbTokenStore,
      mockJbController,
      mockJbOperatorStore,
      mockJbFundingCycleStore,
      mockJbTerminal1,
      mockJbTerminal2,
      mockJbSplitsStore,
      timestamp,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
    };
  }

  function makeFundingCycleMetadata({
    reservedRate = 0,
    redemptionRate = 10000,
    ballotRedemptionRate = 10000,
    pausePay = false,
    pauseDistributions = false,
    pauseRedeem = false,
    pauseBurn = false,
    allowMinting = false,
    allowChangeToken = false,
    allowTerminalMigration = false,
    allowControllerMigration = false,
    allowSetTerminals = true,
    allowSetController = true,
    holdFees = false,
    useTotalOverflowForRedemptions = false,
    useDataSourceForPay = false,
    useDataSourceForRedeem = false,
    dataSource = ethers.constants.AddressZero,
  } = {}) {
    const unpackedMetadata = {
      global: {
        allowSetTerminals,
        allowSetController,
      },
      reservedRate,
      redemptionRate,
      ballotRedemptionRate,
      pausePay,
      pauseDistributions,
      pauseRedeem,
      pauseBurn,
      allowMinting,
      allowChangeToken,
      allowTerminalMigration,
      allowControllerMigration,
      holdFees,
      useTotalOverflowForRedemptions,
      useDataSourceForPay,
      useDataSourceForRedeem,
      dataSource,
    };
    return { unpacked: unpackedMetadata, packed: packFundingCycleMetadata(unpackedMetadata) };
  }

  function makeFundingCycleDataStruct({
    duration = 0,
    weight = ethers.BigNumber.from('1' + '0'.repeat(18)),
    discountRate = 900000000,
    ballot = ethers.constants.AddressZero,
  } = {}) {
    return { duration, weight, discountRate, ballot };
  }

  function makeFundingAccessConstraints({
    terminals,
    token = ethers.Wallet.createRandom().address,
    distributionLimit = 200,
    distributionLimitCurrency = 1,
    overflowAllowance = 100,
    overflowAllowanceCurrency = 2,
  } = {}) {
    let constraints = [];
    for (let terminal of terminals) {
      constraints.push({
        terminal,
        token,
        distributionLimit,
        distributionLimitCurrency,
        overflowAllowance,
        overflowAllowanceCurrency,
      });
    }
    return constraints;
  }

  it(`Should reconfigure funding cycle and emit events if caller is project owner`, async function () {
    const {
      jbController,
      projectOwner,
      timestamp,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();

    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });

    expect(
      await jbController
        .connect(projectOwner)
        .callStatic.reconfigureFundingCyclesOf(
          PROJECT_ID,
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          MEMO,
        ),
    ).to.equal(timestamp);

    let tx = jbController
      .connect(projectOwner)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await Promise.all(
      fundAccessConstraints.map(async (constraints) => {
        await expect(tx)
          .to.emit(jbController, 'SetFundAccessConstraints')
          .withArgs(
            /*fundingCycleData.configuration=*/ timestamp,
            /*fundingCycleData.number=*/ 1,
            PROJECT_ID,
            [
              constraints.terminal,
              constraints.token,
              constraints.distributionLimit,
              constraints.distributionLimitCurrency,
              constraints.overflowAllowance,
              constraints.overflowAllowanceCurrency,
            ],
            projectOwner.address,
          );
      }),
    );

    await expect(tx)
      .to.emit(jbController, 'ReconfigureFundingCycles')
      .withArgs(
        /*fundingCycleData.configuration=*/ timestamp,
        PROJECT_ID,
        MEMO,
        projectOwner.address,
      );
  });

  it(`Should reconfigure funding cycle with metadata using truthy bools`, async function () {
    const {
      jbController,
      projectOwner,
      timestamp,
      fundingCycleData,
      splits,
      mockJbTerminal1,
      mockJbTerminal2,
      mockJbFundingCycleStore,
    } = await setup();

    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });
    const truthyMetadata = makeFundingCycleMetadata({
      pausePay: true,
      pauseDistributions: true,
      pauseRedeem: true,
      pauseBurn: true,
      allowMinting: true,
      allowChangeToken: true,
      allowTerminalMigration: true,
      allowControllerMigration: true,
      holdFees: true,
      useTotalOverflowForRedemptions: true,
      useDataSourceForPay: true,
      useDataSourceForRedeem: true,
    });
    await mockJbFundingCycleStore.mock.configureFor
      .withArgs(PROJECT_ID, fundingCycleData, truthyMetadata.packed, PROJECT_START)
      .returns(
        Object.assign(
          {
            number: 1,
            configuration: timestamp,
            basedOn: timestamp,
            start: timestamp,
            metadata: truthyMetadata.packed,
          },
          fundingCycleData,
        ),
      );
    expect(
      await jbController
        .connect(projectOwner)
        .callStatic.reconfigureFundingCyclesOf(
          PROJECT_ID,
          fundingCycleData,
          truthyMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          MEMO,
        ),
    ).to.equal(timestamp);
  });

  it(`Should reconfigure funding cycle and emit events if caller is not project owner but is authorized`, async function () {
    const {
      jbController,
      projectOwner,
      addrs,
      timestamp,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
      mockJbOperatorStore,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();
    const caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, RECONFIGURE_INDEX)
      .returns(true);

    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });

    expect(
      await jbController
        .connect(caller)
        .callStatic.reconfigureFundingCyclesOf(
          PROJECT_ID,
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          MEMO,
        ),
    ).to.equal(timestamp);

    let tx = jbController
      .connect(caller)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await Promise.all(
      fundAccessConstraints.map(async (constraints) => {
        await expect(tx)
          .to.emit(jbController, 'SetFundAccessConstraints')
          .withArgs(
            timestamp,
            1,
            PROJECT_ID,
            [
              constraints.terminal,
              constraints.token,
              constraints.distributionLimit,
              constraints.distributionLimitCurrency,
              constraints.overflowAllowance,
              constraints.overflowAllowanceCurrency,
            ],
            caller.address,
          );
      }),
    );
  });

  it(`Can't reconfigure funding cycle if caller is not authorized`, async function () {
    const {
      jbController,
      projectOwner,
      addrs,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
      mockJbOperatorStore,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();

    const caller = addrs[0];
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, RECONFIGURE_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, RECONFIGURE_INDEX)
      .returns(false);

    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });

    let tx = jbController
      .connect(caller)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.UNAUTHORIZED);
  });

  it(`Should reconfigure funding cycle without grouped splits`, async function () {
    const {
      jbController,
      projectOwner,
      timestamp,
      fundingCycleData,
      fundingCycleMetadata,
      mockJbTerminal1,
      mockJbTerminal2,
      mockJbSplitsStore
    } = await setup();

    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });

    const groupedSplits = [];

    await mockJbSplitsStore.mock.set
      .withArgs(PROJECT_ID, /*configuration=*/ timestamp, groupedSplits)
      .returns();

    expect(
      await jbController
        .connect(projectOwner)
        .callStatic.reconfigureFundingCyclesOf(
          PROJECT_ID,
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          MEMO,
        ),
    ).to.equal(timestamp);

    let tx = jbController
      .connect(projectOwner)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        [],
        fundAccessConstraints,
        MEMO,
      );

    await Promise.all(
      fundAccessConstraints.map(async (constraints) => {
        await expect(tx)
          .to.emit(jbController, 'SetFundAccessConstraints')
          .withArgs(
            /*fundingCycleData.configuration=*/ timestamp,
            /*fundingCycleData.number=*/ 1,
            PROJECT_ID,
            [
              constraints.terminal,
              constraints.token,
              constraints.distributionLimit,
              constraints.distributionLimitCurrency,
              constraints.overflowAllowance,
              constraints.overflowAllowanceCurrency,
            ],
            projectOwner.address,
          );
      }),
    );
  });

  it(`Should reconfigure funding cycle with empty grouped split and without defined funding cycle constraints`, async function () {
    const {
      jbController,
      projectOwner,
      timestamp,
      fundingCycleData,
      fundingCycleMetadata,
      mockJbTerminal1,
      mockJbTerminal2,
      mockJbSplitsStore
    } = await setup();

    const groupedSplits = [{ group: 1, splits: [] }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({
      terminals,
      distributionLimit: 0,
      overflowAllowance: 0,
      currency: 0,
    });

    await mockJbSplitsStore.mock.set
      .withArgs(PROJECT_ID, /*configuration=*/ timestamp, groupedSplits)
      .returns();

    expect(
      await jbController
        .connect(projectOwner)
        .callStatic.reconfigureFundingCyclesOf(
          PROJECT_ID,
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          MEMO,
        ),
    ).to.equal(timestamp);

    let tx = jbController
      .connect(projectOwner)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await Promise.all(
      fundAccessConstraints.map(async (constraints) => {
        await expect(tx)
          .to.emit(jbController, 'SetFundAccessConstraints')
          .withArgs(
            /*fundingCycleData.configuration=*/ timestamp,
            /*fundingCycleData.number=*/ 1,
            PROJECT_ID,
            [
              constraints.terminal,
              constraints.token,
              constraints.distributionLimit,
              constraints.distributionLimitCurrency,
              constraints.overflowAllowance,
              constraints.overflowAllowanceCurrency,
            ],
            projectOwner.address,
          );
      }),
    );
  });

  it(`Can't set a reserved rate superior to 10000`, async function () {
    const {
      jbController,
      projectOwner,
      fundingCycleData,
      splits,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();
    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });
    const fundingCycleMetadata = makeFundingCycleMetadata({ reservedRate: 10001 });

    let tx = jbController
      .connect(projectOwner)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await expect(tx).to.be.revertedWith('INVALID_RESERVED_RATE()');
  });

  it(`Can't set a redemption rate superior to 10000`, async function () {
    const {
      jbController,
      projectOwner,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();
    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });
    fundingCycleMetadata.unpacked.redemptionRate = 10001; //not possible in packed metadata (shl of a negative value)

    let tx = jbController
      .connect(projectOwner)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_REDEMPTION_RATE);
  });

  it(`Can't set a ballot redemption rate superior to 10000`, async function () {
    const {
      jbController,
      projectOwner,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();
    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals });

    fundingCycleMetadata.unpacked.ballotRedemptionRate = 10001; //not possible in packed metadata (shl of a negative value)

    let tx = jbController
      .connect(projectOwner)
      .reconfigureFundingCyclesOf(
        PROJECT_ID,
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_BALLOT_REDEMPTION_RATE);
  });
});
