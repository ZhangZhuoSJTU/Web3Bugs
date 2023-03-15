import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import { fastForward, getTimestamp, createFundingCycleData } from '../helpers/utils';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import ijbFundingCycleBallot from '../../artifacts/contracts/interfaces/IJBFundingCycleBallot.sol/IJBFundingCycleBallot.json';
import { BigNumber } from 'ethers';
import errors from '../helpers/errors.json';

describe('JBFundingCycleStore::configureFor(...)', function () {
  const PROJECT_ID = 2;

  const EMPTY_FUNDING_CYCLE = {
    number: ethers.BigNumber.from(0),
    configuration: ethers.BigNumber.from(0),
    basedOn: ethers.BigNumber.from(0),
    start: ethers.BigNumber.from(0),
    duration: ethers.BigNumber.from(0),
    weight: ethers.BigNumber.from(0),
    discountRate: ethers.BigNumber.from(0),
    ballot: ethers.constants.AddressZero,
    metadata: ethers.BigNumber.from(0),
  };

  const FUNDING_CYCLE_CAN_START_ASAP = ethers.BigNumber.from(0);

  const MAX_DISCOUNT_RATE = ethers.BigNumber.from(1000000000);

  // The metadata value doesn't affect the test.
  const RANDOM_FUNDING_CYCLE_METADATA_1 = ethers.BigNumber.from(123);

  // The metadata value doesn't affect the test.
  const RANDOM_FUNDING_CYCLE_METADATA_2 = ethers.BigNumber.from(234);

  // Default data, nothing special about it.
  const DEFAULT_FUNDING_CYCLE_DATA = createFundingCycleData();

  const ballotStatus = {
    ACTIVE: 0,
    APPROVED: 1,
    FAILED: 2,
  };

  async function setup() {
    const [deployer, controller, ...addrs] = await ethers.getSigners();

    const mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);
    const mockBallot = await deployMockContract(deployer, ijbFundingCycleBallot.abi);
    await mockBallot.mock.supportsInterface.returns(true);

    const jbFundingCycleStoreFactory = await ethers.getContractFactory('contracts/JBFundingCycleStore.sol:JBFundingCycleStore');
    const jbFundingCycleStore = await jbFundingCycleStoreFactory.deploy(mockJbDirectory.address);

    return {
      controller,
      mockJbDirectory,
      jbFundingCycleStore,
      mockBallot,
      addrs,
      deployer
    };
  }

  const cleanFundingCycle = (fc) => ({
    number: fc[0],
    configuration: fc[1],
    basedOn: fc[2],
    start: fc[3],
    duration: fc[4],
    weight: fc[5],
    discountRate: fc[6],
    ballot: fc[7],
    metadata: fc[8],
  });

  it('Should have no current or queued funding cycle before configuring', async function () {
    const { jbFundingCycleStore } = await setup();

    // Ballot status should be approved since there is no ballot.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(1);

    const [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(EMPTY_FUNDING_CYCLE);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );
  });

  it('Should create current funding cycle and queued cycle on first configure', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // The metadata value doesn't affect the test.
    const fundingCycleMetadata = ethers.BigNumber.from(0);

    // Configure funding cycle
    const configureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        DEFAULT_FUNDING_CYCLE_DATA,
        fundingCycleMetadata,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the configuration was made during.
    const configurationTimestamp = await getTimestamp(configureForTx.blockNumber);

    await expect(configureForTx)
      .to.emit(jbFundingCycleStore, 'Configure')
      .withArgs(
        configurationTimestamp,
        PROJECT_ID,
        [
          DEFAULT_FUNDING_CYCLE_DATA.duration,
          DEFAULT_FUNDING_CYCLE_DATA.weight,
          DEFAULT_FUNDING_CYCLE_DATA.discountRate,
          DEFAULT_FUNDING_CYCLE_DATA.ballot,
        ],
        fundingCycleMetadata,
        FUNDING_CYCLE_CAN_START_ASAP,
        controller.address,
      );

    await expect(configureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(configurationTimestamp, PROJECT_ID, /*basedOn=*/ 0);

    const expectedCurrentFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: configurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: configurationTimestamp,
      duration: DEFAULT_FUNDING_CYCLE_DATA.duration,
      weight: DEFAULT_FUNDING_CYCLE_DATA.weight,
      discountRate: DEFAULT_FUNDING_CYCLE_DATA.discountRate,
      ballot: DEFAULT_FUNDING_CYCLE_DATA.ballot,
      metadata: fundingCycleMetadata,
    };

    // Ballot status should be approved since there is no ballot.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(1);

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, configurationTimestamp)),
    ).to.eql(expectedCurrentFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedCurrentFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedCurrentFundingCycle,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(1), // next number
      start: expectedCurrentFundingCycle.start.add(expectedCurrentFundingCycle.duration), // starts at the end of the first cycle
    });

    //Fast forward to towards the very end of the cycle.
    //Subtract at least two from the end of the cycle, otherwise the second might tick between the fast forward and the check.
    await fastForward(configureForTx.blockNumber, DEFAULT_FUNDING_CYCLE_DATA.duration.sub(2));

    [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(PROJECT_ID);
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedCurrentFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedCurrentFundingCycle,
    );
    // The stored properties should not have changed.
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedCurrentFundingCycle,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(1), // next number
      start: expectedCurrentFundingCycle.start.add(expectedCurrentFundingCycle.duration), // starts at the end of the first cycle
    });

    //fast forward to the next cycle.
    await fastForward(configureForTx.blockNumber, DEFAULT_FUNDING_CYCLE_DATA.duration);

    [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(PROJECT_ID);
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedCurrentFundingCycle);
    expect(ballotState).to.deep.eql(1);
    // What was the queued cycle should now be the current cycle.
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(1), // next number
      start: expectedCurrentFundingCycle.start.add(expectedCurrentFundingCycle.duration), // starts at the end of the first cycle
    });
    // A new queued should be made with properties derived from the original.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(2), // next number
      start: expectedCurrentFundingCycle.start
        .add(expectedCurrentFundingCycle.duration)
        .add(expectedCurrentFundingCycle.duration), // starts at the end of the second cycle
    });

    //fast forward to the subsequent cycle, repeat the process.
    await fastForward(configureForTx.blockNumber, DEFAULT_FUNDING_CYCLE_DATA.duration.mul(2));

    [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(PROJECT_ID);
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedCurrentFundingCycle);
    expect(ballotState).to.deep.eql(1);
    // What was the queued cycle should now be the current cycle.
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(2), // next number
      start: expectedCurrentFundingCycle.start
        .add(expectedCurrentFundingCycle.duration)
        .add(expectedCurrentFundingCycle.duration), // starts at the end of the second cycle
    });
    // A new queued should be made with properties derived from the original.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(3), // next number
      start: expectedCurrentFundingCycle.start
        .add(expectedCurrentFundingCycle.duration)
        .add(expectedCurrentFundingCycle.duration)
        .add(expectedCurrentFundingCycle.duration), // starts at the end of the second cycle
    });
  });

  it('Should create current funding cycle that starts in the future', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const timestamp = await getTimestamp();

    // Starts in 1000 seconds;
    const startsIn = BigNumber.from(1000);

    const fundingCycleMustStartOnOrAfter = timestamp.add(startsIn);

    // The metadata value doesn't affect the test.
    const fundingCycleMetadata = ethers.BigNumber.from(0);

    // Configure funding cycle
    const configureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        DEFAULT_FUNDING_CYCLE_DATA,
        fundingCycleMetadata,
        fundingCycleMustStartOnOrAfter,
      );

    // The timestamp the configuration was made during.
    const configurationTimestamp = await getTimestamp(configureForTx.blockNumber);

    await expect(configureForTx)
      .to.emit(jbFundingCycleStore, 'Configure')
      .withArgs(
        configurationTimestamp,
        PROJECT_ID,
        [
          DEFAULT_FUNDING_CYCLE_DATA.duration,
          DEFAULT_FUNDING_CYCLE_DATA.weight,
          DEFAULT_FUNDING_CYCLE_DATA.discountRate,
          DEFAULT_FUNDING_CYCLE_DATA.ballot,
        ],
        fundingCycleMetadata,
        fundingCycleMustStartOnOrAfter,
        controller.address,
      );

    await expect(configureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(configurationTimestamp, PROJECT_ID, /*basedOn=*/ 0);

    const expectedUpcomingFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: configurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: timestamp.add(startsIn),
      duration: DEFAULT_FUNDING_CYCLE_DATA.duration,
      weight: DEFAULT_FUNDING_CYCLE_DATA.weight,
      discountRate: DEFAULT_FUNDING_CYCLE_DATA.discountRate,
      ballot: DEFAULT_FUNDING_CYCLE_DATA.ballot,
      metadata: fundingCycleMetadata,
    };

    // Ballot status should be approved since there is no ballot.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(1);

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, configurationTimestamp)),
    ).to.eql(expectedUpcomingFundingCycle);
    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedUpcomingFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedUpcomingFundingCycle,
    );

    // Fast forward to when the cycle starts.
    await fastForward(configureForTx.blockNumber, startsIn);

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedUpcomingFundingCycle,
    );
  });

  it('Should configure subsequent cycle during a funding cycle', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, mockBallot } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.sub(5));

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedSecondFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle that starts in the future', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    // Must start in two funding cycles.
    const secondFundingCycleData = createFundingCycleData({
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.sub(5));

    const reconfiguredFundingCycleMustStartOnOrAfter = firstConfigurationTimestamp.add(
      firstFundingCycleData.duration.mul(2),
    );

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        reconfiguredFundingCycleMustStartOnOrAfter,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(3), // third cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(2)), // starts at the end of the second cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedSecondFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );

    // Queued shows the rolled over fc.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1),
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration),
    });

    //fast forward to within the cycle.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration);

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1),
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration),
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle that starts in the future if current cycle has no duration', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // No duration.
    const firstFundingCycleData = createFundingCycleData({ duration: BigNumber.from(0) });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    // Must start in two funding cycles.
    const secondFundingCycleData = createFundingCycleData({
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // Start the configured cycle in 10000 seconds.
    const reconfiguredFundingCycleStartsIn = BigNumber.from(10000);
    const reconfiguredFundingCycleMustStartOnOrAfter = firstConfigurationTimestamp.add(
      reconfiguredFundingCycleStartsIn,
    );

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        reconfiguredFundingCycleMustStartOnOrAfter,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: reconfiguredFundingCycleMustStartOnOrAfter, // starts at the minimum time
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedSecondFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle during a rolled over funding cycle', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, mockBallot } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // 5 cycles into the future.
    const cycleDiff = ethers.BigNumber.from(5);
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff).sub(5),
    );

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: cycleDiff.add(1), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedSecondFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(cycleDiff.sub(1)),
      start: expectedFirstFundingCycle.start.add(
        expectedFirstFundingCycle.duration.mul(cycleDiff.sub(1)),
      ),
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle during a rolled over funding cycle with approved ballot', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, mockBallot } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: ethers.constants.AddressZero,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // 5 cycles into the future.
    const cycleDiff = ethers.BigNumber.from(5);
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff).sub(5),
    );

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: cycleDiff.add(1), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    // Mock the ballot on the failed funding cycle as approved.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        secondConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)),
      )
      .returns(ballotStatus.APPROVED);

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedSecondFundingCycle);
    expect(ballotState).to.deep.eql(ballotStatus.APPROVED);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(cycleDiff.sub(1)),
      start: expectedFirstFundingCycle.start.add(
        expectedFirstFundingCycle.duration.mul(cycleDiff.sub(1)),
      ),
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle during a rolled over funding cycle many multiples of duration later', async function () {
    // Increase timeout because this test will need a long for loop iteration.
    this.timeout(20000);

    const { controller, mockJbDirectory, jbFundingCycleStore, mockBallot } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const discountRate = 0.005; // Use a discount rate of 0.5%

    const firstFundingCycleData = createFundingCycleData({
      duration: ethers.BigNumber.from(5),
      discountRate: MAX_DISCOUNT_RATE.div(1 / discountRate),
    });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: ethers.BigNumber.from(0), //inherit weight.
    });

    // 10000000 cycles into the future.
    const cycleDiff = ethers.BigNumber.from(10000000);

    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff).sub(5),
    );

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycleWithoutWeight = {
      number: cycleDiff.add(1), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    // Wrap in try catch. If the new weight calculation breaks, it should default to equal 0.
    try {
      expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
        ...expectedSecondFundingCycleWithoutWeight,
        weight: firstFundingCycleData.weight.div(1 / discountRate ** cycleDiff),
      });
    } catch {
      expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
        ...expectedSecondFundingCycleWithoutWeight,
        weight: ethers.BigNumber.from(0),
      });
    }
  });

  it('Should ignore failed configuration and roll over current configuration', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const failedFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // The metadata value doesn't affect the test.
    const failedFundingCycleMetadata = ethers.BigNumber.from(234);

    // Configure failed funding cycle
    const failedConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        failedFundingCycleData,
        failedFundingCycleMetadata,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const failedConfigurationTimestamp = await getTimestamp(failedConfigureForTx.blockNumber);

    const expectedFailedFundingCycle = {
      number: ethers.BigNumber.from(2),
      configuration: failedConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp,
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration),
      duration: failedFundingCycleData.duration,
      weight: failedFundingCycleData.weight,
      discountRate: failedFundingCycleData.discountRate,
      ballot: failedFundingCycleData.ballot,
      metadata: failedFundingCycleMetadata,
    };

    // Mock the ballot on the failed funding cycle as failed.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        failedConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      )
      .returns(ballotStatus.FAILED);

    // 5 cycles into the future.
    const cycleDiff = ethers.BigNumber.from(5);
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff).sub(5),
    );

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedFailedFundingCycle);
    expect(ballotState).to.deep.eql(ballotStatus.FAILED);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(cycleDiff.sub(1)),
      start: expectedFirstFundingCycle.start.add(
        expectedFirstFundingCycle.duration.mul(cycleDiff.sub(1)),
      ),
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(cycleDiff),
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration.mul(cycleDiff)),
    });
  });

  it('Should ignore failed configuration and roll over current configuration, and maintains even if ballot later becomes approved', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const discountRate = 0.5; // 50% discount rate

    const failedFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: MAX_DISCOUNT_RATE.div(1 / discountRate),
      weight: firstFundingCycleData.weight.add(1),
    });

    // The metadata value doesn't affect the test.
    const failedFundingCycleMetadata = ethers.BigNumber.from(234);

    // Configure failed funding cycle
    const failedConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        failedFundingCycleData,
        failedFundingCycleMetadata,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const failedConfigurationTimestamp = await getTimestamp(failedConfigureForTx.blockNumber);

    const expectedFailedFundingCycle = {
      number: ethers.BigNumber.from(2),
      configuration: failedConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp,
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      duration: failedFundingCycleData.duration,
      weight: failedFundingCycleData.weight,
      discountRate: failedFundingCycleData.discountRate,
      ballot: failedFundingCycleData.ballot,
      metadata: failedFundingCycleMetadata,
    };

    // Go to the next cycle of the cycle.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration);

    // Mock the ballot on the failed funding cycle as failed.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        failedConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      )
      .returns(ballotStatus.FAILED);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedFailedFundingCycle);
    expect(ballotState).to.deep.eql(ballotStatus.FAILED);

    // Current should be a copy of the first fc.
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1),
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration),
    });

    // Queued should be a copy of the first fc.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(2),
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration.mul(2)),
    });

    // Approve the ballot.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        failedConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      )
      .returns(ballotStatus.APPROVED);

    [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(PROJECT_ID);
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedFailedFundingCycle);
    expect(ballotState).to.deep.eql(1);

    // Current should be the now-approved fc.
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFailedFundingCycle,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFailedFundingCycle,
      number: expectedFirstFundingCycle.number.add(2),
      start: expectedFailedFundingCycle.start.add(expectedFailedFundingCycle.duration),
      weight: expectedFailedFundingCycle.weight.div(1 / discountRate),
    });
  });

  it('Should configure subsequent cycle during a rolled over funding cycle with a failed one in between', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // Configure a bogus failed funding cycle. Use the same metadata for convinience.
    const failedConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const failedConfigurationTimestamp = await getTimestamp(failedConfigureForTx.blockNumber);

    // Mock the ballot on the failed funding cycle as failed.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        failedConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      )
      .returns(ballotStatus.FAILED);

    // 5 cycles into the future.
    const cycleDiff = ethers.BigNumber.from(5);
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff).sub(5),
    );

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    // Mock the ballot on the second funding cycle as failed.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        secondConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)),
      )
      .returns(ballotStatus.APPROVED);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: cycleDiff.add(1), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(cycleDiff.sub(1)),
      start: expectedFirstFundingCycle.start.add(
        expectedFirstFundingCycle.duration.mul(cycleDiff.sub(1)),
      ),
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle during a rolled over funding cycle that overwrote a failed one', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // 5 cycles into the future.
    const cycleDiff = ethers.BigNumber.from(5);
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff).sub(5),
    );

    // Configure a bogus failed funding cycle. Use the same metadata for convinience.
    const failedConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const failedConfigurationTimestamp = await getTimestamp(failedConfigureForTx.blockNumber);

    // Mock the ballot on the failed funding cycle as failed.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        failedConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff)),
      )
      .returns(ballotStatus.FAILED);

    // fast forward to within the failed configuration.
    await fastForward(
      firstConfigureForTx.blockNumber,
      firstFundingCycleData.duration.mul(cycleDiff),
    );

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    // Mock the ballot on the second funding cycle as failed.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        secondConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff.add(1))),
      )
      .returns(ballotStatus.APPROVED);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedSecondFundingCycle = {
      number: cycleDiff.add(2),
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(cycleDiff.add(1))), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(cycleDiff),
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration.mul(cycleDiff)),
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle during a funding cycle with duration of 0', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ duration: BigNumber.from(0) });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );

    //No funding cycle should be queued because the latest configuration has a duration of 0.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );

    // Set the duration to 0 of the second cycle to check that no queued cycle is being returned.
    const secondFundingCycleData = createFundingCycleData({ duration: BigNumber.from(0) });

    //fast forward to within the cycle.
    //An arbitrary amount into the future.
    await fastForward(firstConfigureForTx.blockNumber, ethers.BigNumber.from(123456789));

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: secondConfigurationTimestamp, // starts right away
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
    //No funding cycle should be queued because the latest configuration has a duratino of 0.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );
  });

  it('Should configure subsequent cycle during a funding cycle with duration of 0 irrespectively of a discount rate', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({
      duration: BigNumber.from(0),
      discountRate: BigNumber.from(50),
    });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );

    //No funding cycle should be queued because the latest configuration has a duration of 0.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );

    // Set the duration to 0 of the second cycle to check that no queued cycle is being returned.
    const secondFundingCycleData = createFundingCycleData({ duration: BigNumber.from(0) });

    //fast forward to within the cycle.
    //An arbitrary amount into the future.
    await fastForward(firstConfigureForTx.blockNumber, ethers.BigNumber.from(123456789));

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: secondConfigurationTimestamp, // starts right away
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
    //No funding cycle should be queued because the latest configuration has a duratino of 0.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );
  });

  it('Should not use a funding cycle that fails a ballot', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.sub(5));

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    // Set the ballot to be failed for the upcoming reconfig.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        secondConfigurationTimestamp,
        firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      )
      .returns(ballotStatus.FAILED);

    // Ballot status should be failed.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(2);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    // Fast forward to the next cycle.
    await fastForward(firstConfigurationTimestamp.blockNumber, firstFundingCycleData.duration);

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1), // next number
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration), // starts at the end of the first cycle
    });
    // The reconfiguration should not have taken effect.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(2), // next number
      start: expectedFirstFundingCycle.start
        .add(expectedFirstFundingCycle.duration)
        .add(expectedFirstFundingCycle.duration), // starts two durations after the end of the first cycle
    });
  });

  it('Should not use a funding cycle that fails a ballot if current funding cycle has 0 duration', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: BigNumber.from(0),
    });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: BigNumber.from(0),
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    //fast forward to within the cycle.
    await fastForward(firstConfigureForTx.blockNumber, BigNumber.from(1));

    // Set the ballot to have a short duration.
    await mockBallot.mock.duration.withArgs().returns(0);

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    // Set the ballot to be failed for the upcoming reconfig.
    await mockBallot.mock.stateOf
      .withArgs(PROJECT_ID, secondConfigurationTimestamp, secondConfigurationTimestamp)
      .returns(ballotStatus.FAILED);

    // Ballot status should be failed.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(2);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );
    // The reconfiguration should not have taken effect.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );
  });

  it("Should hold off on using a reconfigured funding cycle if the current cycle's ballot duration doesn't end until after the current cycle is over", async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData({ ballot: mockBallot.address });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    const secondFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // Set the ballot to have a duration longer than the funding cycle.
    await mockBallot.mock.duration.returns(firstFundingCycleData.duration.add(1));

    // Ballot status should be approved.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(1);

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    // Ballot status should be active.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(0);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1), // next number
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration), // starts at the end of the first cycle
    });

    // Fast forward to the next cycle.
    await fastForward(firstConfigurationTimestamp.blockNumber, firstFundingCycleData.duration);

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1), // next number
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration), // starts at the end of the first cycle
    });
    // The reconfiguration should not have taken effect.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(2), // next number
      start: expectedFirstFundingCycle.start
        .add(expectedFirstFundingCycle.duration)
        .add(expectedFirstFundingCycle.duration), // starts two durations after the end of the first cycle
    });

    // Fast forward to the moment the ballot duration has passed.
    await fastForward(
      'latest',
      secondConfigurationTimestamp.sub(firstConfigurationTimestamp).add(3), // Add 3 to give a buffer for subsequent calculations
    );

    // Mock the ballot on the first funding cycle as approved.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        secondConfigurationTimestamp,
        firstConfigurationTimestamp
          .add(firstFundingCycleData.duration)
          .add(firstFundingCycleData.duration),
      )
      .returns(ballotStatus.APPROVED);

    // Ballot status should be approved.
    expect(await jbFundingCycleStore.currentBallotStateOf(PROJECT_ID)).to.eql(1);

    const expectedReconfiguredFundingCycle = {
      number: ethers.BigNumber.from(3),
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp,
      start: firstConfigurationTimestamp
        .add(firstFundingCycleData.duration)
        .add(firstFundingCycleData.duration),
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    // The reconfiguration should take effect on the third cycle.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedReconfiguredFundingCycle,
    );
  });

  it('Should overwrite a pending reconfiguration', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, mockBallot } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const secondFundingCycleData = createFundingCycleData({
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const thirdFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: secondFundingCycleData.duration.add(1),
      discountRate: secondFundingCycleData.discountRate.add(1),
      weight: secondFundingCycleData.weight.add(1),
    });

    // The metadata value doesn't affect the test.
    const thirdFundingCycleMetadata = ethers.BigNumber.from(345);

    // Configure second funding cycle
    const thirdConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        thirdFundingCycleData,
        thirdFundingCycleMetadata,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the third configuration was made during.
    const thirdConfigurationTimestamp = await getTimestamp(thirdConfigureForTx.blockNumber);

    // An Init event should have been emitted.
    await expect(thirdConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(thirdConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    const expectedThirdFundingCycle = {
      number: ethers.BigNumber.from(2),
      configuration: thirdConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp,
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration),
      duration: thirdFundingCycleData.duration,
      weight: thirdFundingCycleData.weight,
      discountRate: thirdFundingCycleData.discountRate,
      ballot: thirdFundingCycleData.ballot,
      metadata: thirdFundingCycleMetadata,
    };

    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedThirdFundingCycle,
    );
  });

  it('Should queue reconfiguration after ballot duration if current funding cycle duration is 0', async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // Zero duration.
    const firstFundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
      duration: BigNumber.from(0),
    });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    // Use a weight of 0 to inherit from previous fc.
    const secondFundingCycleData = createFundingCycleData({ weight: BigNumber.from(0) });

    const ballotDuration = BigNumber.from(100);

    // Set the ballot to have an arbitrary positive duration.
    await mockBallot.mock.duration.withArgs().returns(ballotDuration);

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2),
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp,
      start: secondConfigurationTimestamp.add(ballotDuration),
      duration: secondFundingCycleData.duration,
      weight: firstFundingCycleData.weight, // inherit from first fc
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedFirstFundingCycle,
    );
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      EMPTY_FUNDING_CYCLE,
    );

    //fast forward to the end of the ballot duration.
    await fastForward(secondConfigureForTx.blockNumber, ballotDuration);

    // Set the ballot to be approved for the upcoming reconfig.
    await mockBallot.mock.stateOf
      .withArgs(
        PROJECT_ID,
        secondConfigurationTimestamp,
        secondConfigurationTimestamp.add(ballotDuration),
      )
      .returns(ballotStatus.APPROVED);

    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle with a weight derived from previous cycle if a value of 0 is passed in', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    // Set a weight of 0.
    const secondFundingCycleData = createFundingCycleData({ weight: ethers.BigNumber.from(0) });

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.sub(5));

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: firstFundingCycleData.weight, // expect a weight derived from the previous cycle's values because 0 was sent.
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    // The `queuedOf` should contain the properties of the current cycle, with a new number, start, and weight.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should configure subsequent cycle using a weight of 1 to represent 1', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    // Set a weight of 1.
    const secondFundingCycleData = createFundingCycleData({ weight: ethers.BigNumber.from(1) });

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.sub(5));

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: ethers.BigNumber.from(0), // expect 0 because 1 was sent.
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    // The `queuedOf` should contain the properties of the current cycle, with a new number, start, and weight.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should apply a discount rate to subsequent cycle after reconfiguration with a weight derived from previous cycle if a value of 0 is passed in', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const discountRate = 0.5; // 50% discount rate

    const firstFundingCycleData = createFundingCycleData({
      discountRate: MAX_DISCOUNT_RATE.div(1 / discountRate),
    });

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    // Set a weight of 0.
    const secondFundingCycleData = createFundingCycleData({ weight: ethers.BigNumber.from(0) });

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.sub(5));

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(2), // second cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration), // starts at the end of the first cycle
      duration: secondFundingCycleData.duration,
      weight: firstFundingCycleData.weight.div(1 / discountRate), // expect a weight derived from the previous cycle's values because 0 was sent.
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    // The `queuedOf` should contain the properties of the current cycle, with a new number, start, and weight.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedSecondFundingCycle,
    );
  });

  it('Should apply a discount rate to a subsequent cycle that rolls over', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const discountRate = 0.5; // Use a discount rate of 50%

    const fundingCycleData = createFundingCycleData({
      discountRate: MAX_DISCOUNT_RATE.div(1 / discountRate),
    });

    // Configure funding cycle
    const configureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        fundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the configuration was made during.
    const configurationTimestamp = await getTimestamp(configureForTx.blockNumber);

    const expectedCurrentFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: configurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: configurationTimestamp,
      duration: fundingCycleData.duration,
      weight: fundingCycleData.weight,
      discountRate: fundingCycleData.discountRate,
      ballot: fundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };
    // The `get` call should return the correct funding cycle.
    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, configurationTimestamp)),
    ).to.eql(expectedCurrentFundingCycle);

    // The `currentOf` call should return the correct funding cycle.
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql(
      expectedCurrentFundingCycle,
    );

    // The `queuedOf` should contain the properties of the current cycle, with a new number, start, and weight.
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql({
      ...expectedCurrentFundingCycle,
      number: expectedCurrentFundingCycle.number.add(1), // next number
      start: expectedCurrentFundingCycle.start.add(expectedCurrentFundingCycle.duration), // starts at the end of the first cycle
      weight: expectedCurrentFundingCycle.weight.div(1 / discountRate), // apply the discount rate
    });
  });

  it('Should configure subsequent cycle during a rolled over funding cycle overriding an already-proposed configuration', async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, addrs } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const firstFundingCycleData = createFundingCycleData();

    // Configure first funding cycle
    const firstConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        firstFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_1,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the first configuration was made during.
    const firstConfigurationTimestamp = await getTimestamp(firstConfigureForTx.blockNumber);

    const expectedFirstFundingCycle = {
      number: ethers.BigNumber.from(1),
      configuration: firstConfigurationTimestamp,
      basedOn: ethers.BigNumber.from(0),
      start: firstConfigurationTimestamp,
      duration: firstFundingCycleData.duration,
      weight: firstFundingCycleData.weight,
      discountRate: firstFundingCycleData.discountRate,
      ballot: firstFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_1,
    };

    //fast forward to within the second cycle, which should have rolled over from the first.
    //keep 10 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.mul(2).sub(10));

    const secondFundingCycleData = createFundingCycleData({
      duration: firstFundingCycleData.duration.add(1),
      discountRate: firstFundingCycleData.discountRate.add(1),
      weight: firstFundingCycleData.weight.add(1),
    });

    // Configure second funding cycle
    const secondConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        secondFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const secondConfigurationTimestamp = await getTimestamp(secondConfigureForTx.blockNumber);

    const expectedSecondFundingCycle = {
      number: ethers.BigNumber.from(3), // third cycle
      configuration: secondConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(2)), // starts at the end of the second cycle
      duration: secondFundingCycleData.duration,
      weight: secondFundingCycleData.weight,
      discountRate: secondFundingCycleData.discountRate,
      ballot: secondFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    await expect(secondConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(secondConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    //fast forward to within the cycle.
    //keep 5 seconds before the end of the cycle so make all necessary checks before the cycle ends.
    await fastForward(firstConfigureForTx.blockNumber, firstFundingCycleData.duration.mul(2).sub(5));

    const thirdFundingCycleData = createFundingCycleData({
      duration: firstFundingCycleData.duration.add(2),
      discountRate: firstFundingCycleData.discountRate.add(2),
      weight: firstFundingCycleData.weight.add(2),
    });

    // Configure third funding cycle
    const thirdConfigureForTx = await jbFundingCycleStore
      .connect(controller)
      .configureFor(
        PROJECT_ID,
        thirdFundingCycleData,
        RANDOM_FUNDING_CYCLE_METADATA_2,
        FUNDING_CYCLE_CAN_START_ASAP,
      );

    // The timestamp the second configuration was made during.
    const thirdConfigurationTimestamp = await getTimestamp(thirdConfigureForTx.blockNumber);

    const expectedThirdFundingCycle = {
      number: ethers.BigNumber.from(3), // third cycle still
      configuration: thirdConfigurationTimestamp,
      basedOn: firstConfigurationTimestamp, // based on the first cycle
      start: firstConfigurationTimestamp.add(firstFundingCycleData.duration.mul(2)), // starts at the end of the first cycle
      duration: thirdFundingCycleData.duration,
      weight: thirdFundingCycleData.weight,
      discountRate: thirdFundingCycleData.discountRate,
      ballot: thirdFundingCycleData.ballot,
      metadata: RANDOM_FUNDING_CYCLE_METADATA_2,
    };

    await expect(thirdConfigureForTx)
      .to.emit(jbFundingCycleStore, `Init`)
      .withArgs(thirdConfigurationTimestamp, PROJECT_ID, /*basedOn=*/ firstConfigurationTimestamp);

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, secondConfigurationTimestamp)),
    ).to.eql(expectedSecondFundingCycle);

    expect(
      cleanFundingCycle(await jbFundingCycleStore.get(PROJECT_ID, thirdConfigurationTimestamp)),
    ).to.eql(expectedThirdFundingCycle);

    let [latestFundingCycle, ballotState] = await jbFundingCycleStore.latestConfiguredOf(
      PROJECT_ID,
    );
    expect(cleanFundingCycle(latestFundingCycle)).to.eql(expectedThirdFundingCycle);
    expect(ballotState).to.deep.eql(1);
    expect(cleanFundingCycle(await jbFundingCycleStore.currentOf(PROJECT_ID))).to.eql({
      ...expectedFirstFundingCycle,
      number: expectedFirstFundingCycle.number.add(1), // next number
      start: expectedFirstFundingCycle.start.add(expectedFirstFundingCycle.duration), // starts at the end of the first cycle
    });
    expect(cleanFundingCycle(await jbFundingCycleStore.queuedOf(PROJECT_ID))).to.eql(
      expectedThirdFundingCycle,
    );
  });

  it("Can't configure if caller is not project's controller", async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore, addrs } = await setup();
    const [nonController] = addrs;
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await expect(
      jbFundingCycleStore
        .connect(nonController)
        .configureFor(PROJECT_ID, DEFAULT_FUNDING_CYCLE_DATA, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.CONTROLLER_UNAUTHORIZED);
  });

  it(`Can't configure if funding cycle duration is bigger than 2^64 - 1`, async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const fundingCycleData = createFundingCycleData({ duration: ethers.BigNumber.from(2).pow(64) });

    await expect(
      jbFundingCycleStore
        .connect(controller)
        .configureFor(PROJECT_ID, fundingCycleData, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.INVALID_DURATION);
  });

  it(`Can't configure if funding cycle discount rate is above 100%`, async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const fundingCycleData = createFundingCycleData({ discountRate: BigNumber.from(1000000001) });

    await expect(
      jbFundingCycleStore
        .connect(controller)
        .configureFor(PROJECT_ID, fundingCycleData, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.INVALID_DISCOUNT_RATE);
  });

  it(`Can't configure if funding cycle weight larger than uint88_max`, async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const badWeight = ethers.BigNumber.from('1').shl(88);

    const fundingCycleData = createFundingCycleData({ weight: badWeight });

    await expect(
      jbFundingCycleStore
        .connect(controller)
        .configureFor(PROJECT_ID, fundingCycleData, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.INVALID_WEIGHT);
  });

  it(`Can't configure if ballot is not a contract`, async function () {
    const { controller, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const fundingCycleData = createFundingCycleData({
      ballot: ethers.Wallet.createRandom().address,
    });

    await expect(
      jbFundingCycleStore
        .connect(controller)
        .configureFor(PROJECT_ID, fundingCycleData, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.INVALID_BALLOT);
  });

  it(`Can't configure if ballot has not the valid interface`, async function () {
    const { controller, mockJbDirectory, mockBallot, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const fundingCycleData = createFundingCycleData({
      ballot: mockBallot.address,
    });

    await mockBallot.mock.supportsInterface.returns(false);

    await expect(
      jbFundingCycleStore
        .connect(controller)
        .configureFor(PROJECT_ID, fundingCycleData, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.INVALID_BALLOT);
  });

  it(`Can't configure if ballot is not IERC165 compliant`, async function () {
    const { controller, deployer, mockJbDirectory, jbFundingCycleStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);
    
    const mockBallotNew = await deployMockContract(deployer, ijbFundingCycleBallot.abi);

    const fundingCycleData = createFundingCycleData({
      ballot: mockBallotNew.address,
    });

    await mockBallotNew.mock.supportsInterface.reverts;

    await expect(
      jbFundingCycleStore
        .connect(controller)
        .configureFor(PROJECT_ID, fundingCycleData, 0, FUNDING_CYCLE_CAN_START_ASAP),
    ).to.be.revertedWith(errors.INVALID_BALLOT);
  });
});
