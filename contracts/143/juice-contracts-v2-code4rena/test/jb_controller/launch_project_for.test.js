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

describe('JBController::launchProjectFor(...)', function () {
  const PROJECT_ID = 1;
  const METADATA_CID = '';
  const METADATA_DOMAIN = 1234;
  const PROJECT_START = '1';
  const MEMO = 'Test Memo';

  async function setup() {
    let [deployer, projectOwner, caller, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;
    const fundingCycleData = makeFundingCycleDataStruct();
    const fundingCycleMetadata = makeFundingCycleMetadata();
    const splits = makeSplits();

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

    await mockJbProjects.mock.createFor
      .withArgs(projectOwner.address, [METADATA_CID, METADATA_DOMAIN])
      .returns(PROJECT_ID);

    await mockJbDirectory.mock.setControllerOf.withArgs(PROJECT_ID, jbController.address).returns();

    await mockJbDirectory.mock.setTerminalsOf
      .withArgs(PROJECT_ID, [mockJbTerminal1.address, mockJbTerminal2.address])
      .returns();

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

    const token = ethers.Wallet.createRandom().address;

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
      timestamp,
      token,
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
    allowSetTerminal = false,
    allowSetController = false,
    holdFees = false,
    useTotalOverflowForRedemptions = false,
    useDataSourceForPay = false,
    useDataSourceForRedeem = false,
    dataSource = ethers.constants.AddressZero,
  } = {}) {
    const unpackedMetadata = {
      global: {
        allowSetTerminal,
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

  it(`Should launch a project and emit events`, async function () {
    const {
      jbController,
      projectOwner,
      timestamp,
      token,
      fundingCycleData,
      fundingCycleMetadata,
      splits,
      mockJbTerminal1,
      mockJbTerminal2,
    } = await setup();
    const groupedSplits = [{ group: 1, splits }];
    const terminals = [mockJbTerminal1.address, mockJbTerminal2.address];
    const fundAccessConstraints = makeFundingAccessConstraints({ terminals, token });

    expect(
      await jbController
        .connect(projectOwner)
        .callStatic.launchProjectFor(
          projectOwner.address,
          [METADATA_CID, METADATA_DOMAIN],
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          terminals,
          MEMO,
        ),
    ).to.equal(PROJECT_ID);

    let tx = jbController
      .connect(projectOwner)
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
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

        const args = [PROJECT_ID, timestamp, constraints.terminal, token];
        expect(await jbController.distributionLimitOf(...args)).deep.equals([
          ethers.BigNumber.from(constraints.distributionLimit),
          ethers.BigNumber.from(constraints.distributionLimitCurrency),
        ]);
        expect(await jbController.overflowAllowanceOf(...args)).deep.equals([
          ethers.BigNumber.from(constraints.overflowAllowance),
          ethers.BigNumber.from(constraints.overflowAllowanceCurrency),
        ]);
      }),
    );
    await expect(tx)
      .to.emit(jbController, 'LaunchProject')
      .withArgs(
        /*fundingCycleData.configuration=*/ timestamp,
        PROJECT_ID,
        MEMO,
        projectOwner.address,
      );
  });

  it(`Should launch a project without payment terminals and funding cycle constraints`, async function () {
    const { jbController, projectOwner, fundingCycleData, fundingCycleMetadata, splits } =
      await setup();
    const groupedSplits = [{ group: 1, splits }];
    const fundAccessConstraints = [];

    expect(
      await jbController
        .connect(projectOwner)
        .callStatic.launchProjectFor(
          projectOwner.address,
          [METADATA_CID, METADATA_DOMAIN],
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          [],
          MEMO,
        ),
    ).to.equal(PROJECT_ID);

    // No constraint => no event
    await expect(
      jbController
        .connect(projectOwner)
        .launchProjectFor(
          projectOwner.address,
          [METADATA_CID, METADATA_DOMAIN],
          fundingCycleData,
          fundingCycleMetadata.unpacked,
          PROJECT_START,
          groupedSplits,
          fundAccessConstraints,
          [],
          MEMO,
        ),
    ).to.not.emit(jbController, 'SetFundAccessConstraints');
  });

  it(`Can't launch a project with a reserved rate superior to 10000`, async function () {
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
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith('INVALID_RESERVED_RATE()');
  });

  it(`Can't launch a project with a redemption rate superior to 10000`, async function () {
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
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_REDEMPTION_RATE);
  });

  it(`Can't launch a project with a ballot redemption rate superior to 10000`, async function () {
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
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_BALLOT_REDEMPTION_RATE);
  });

  it(`Can't launch a project with distribution limit larger than uint248`, async function () {
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
    const fundAccessConstraints = makeFundingAccessConstraints({
      terminals,
      distributionLimit: ethers.constants.MaxUint256, // Should be too large
    });

    let tx = jbController
      .connect(projectOwner)
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_DISTRIBUTION_LIMIT);
  });

  it(`Can't launch a project with distribution limit currency larger than uint8`, async function () {
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
    const fundAccessConstraints = makeFundingAccessConstraints({
      terminals,
      distributionLimitCurrency: ethers.constants.MaxUint256, // Should be too large
    });

    let tx = jbController
      .connect(projectOwner)
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_DISTRIBUTION_LIMIT_CURRENCY);
  });

  it(`Can't launch a project with overflow allowance larger than uint248`, async function () {
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
    const fundAccessConstraints = makeFundingAccessConstraints({
      terminals,
      overflowAllowance: ethers.constants.MaxUint256, // Should be too large
    });

    let tx = jbController
      .connect(projectOwner)
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_OVERFLOW_ALLOWANCE);
  });

  it(`Can't launch a project with overflow allowance currency larger than uint8`, async function () {
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
    const fundAccessConstraints = makeFundingAccessConstraints({
      terminals,
      overflowAllowanceCurrency: ethers.constants.MaxUint256, // Should be too large
    });

    let tx = jbController
      .connect(projectOwner)
      .launchProjectFor(
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        fundingCycleData,
        fundingCycleMetadata.unpacked,
        PROJECT_START,
        groupedSplits,
        fundAccessConstraints,
        terminals,
        MEMO,
      );

    await expect(tx).to.be.revertedWith(errors.INVALID_OVERFLOW_ALLOWANCE_CURRENCY);
  });
});
