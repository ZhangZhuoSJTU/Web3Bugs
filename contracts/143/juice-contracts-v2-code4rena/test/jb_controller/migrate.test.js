import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { packFundingCycleMetadata } from '../helpers/utils';
import errors from '../helpers/errors.json';

import JbController from '../../artifacts/contracts/JBController.sol/JBController.json';
import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::migrate(...)', function () {
  const PROJECT_ID = 1;
  const TOTAL_SUPPLY = 20000;
  let MIGRATE_CONTROLLER_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    MIGRATE_CONTROLLER_INDEX = await jbOperations.MIGRATE_CONTROLLER();
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
      mockJbTokenStore,
    ] = await Promise.all([
      deployMockContract(deployer, JbController.abi),
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbFundingCycleStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
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

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(jbController.address);

    await mockJbDirectory.mock.setControllerOf
      .withArgs(PROJECT_ID, mockJbController.address)
      .returns();

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(TOTAL_SUPPLY);

    await mockJbController.mock.prepForMigrationOf
      .withArgs(PROJECT_ID, jbController.address)
      .returns();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowControllerMigration: 1 }),
    });

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
      timestamp,
    };
  }

  it(`Should mint all reserved token and migrate controller if caller is project's current controller`, async function () {
    const { jbController, projectOwner, mockJbController, timestamp } = await setup();

    let tx = jbController.connect(projectOwner).migrate(PROJECT_ID, mockJbController.address);

    await expect(tx)
      .to.emit(jbController, 'DistributeReservedTokens')
      .withArgs(
        /*fundingCycleConfiguration=*/ timestamp,
        /*fundingCycleNumber=*/ 1,
        /*projectId=*/ PROJECT_ID,
        /*projectOwner=*/ projectOwner.address,
        /*count=*/ 0,
        /*leftoverTokenCount=*/ 0,
        /*memo=*/ '',
        /*caller=*/ projectOwner.address,
      )
      .and.to.emit(jbController, 'Migrate')
      .withArgs(PROJECT_ID, mockJbController.address, projectOwner.address);

    expect(await jbController.reservedTokenBalanceOf(PROJECT_ID, 10000)).to.equal(0);
  });

  it(`Should mint all reserved token and migrate controller if caller is authorized`, async function () {
    const { jbController, projectOwner, caller, mockJbController, mockJbOperatorStore, timestamp } =
      await setup();

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, MIGRATE_CONTROLLER_INDEX)
      .returns(true);

    let tx = jbController.connect(caller).migrate(PROJECT_ID, mockJbController.address);

    await expect(tx)
      .to.emit(jbController, 'DistributeReservedTokens')
      .withArgs(timestamp, 1, PROJECT_ID, projectOwner.address, 0, 0, '', caller.address)
      .and.to.emit(jbController, 'Migrate')
      .withArgs(PROJECT_ID, mockJbController.address, caller.address);

    expect(await jbController.reservedTokenBalanceOf(PROJECT_ID, 10000)).to.equal(0);
  });

  it(`Should migrate controller without minting if there is no reserved token`, async function () {
    const { jbController, projectOwner, mockJbController, mockJbTokenStore } = await setup();

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(0);

    let tx = jbController.connect(projectOwner).migrate(PROJECT_ID, mockJbController.address);

    await expect(tx)
      .to.emit(jbController, 'Migrate')
      .withArgs(PROJECT_ID, mockJbController.address, projectOwner.address)
      .and.to.not.emit(jbController, 'DistributeReservedTokens');

    expect(await jbController.reservedTokenBalanceOf(PROJECT_ID, 10000)).to.equal(0);
  });

  it(`Can't migrate controller if caller is not the owner nor is authorized`, async function () {
    const { jbController, projectOwner, caller, mockJbController, mockJbOperatorStore, timestamp } =
      await setup();

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, MIGRATE_CONTROLLER_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, MIGRATE_CONTROLLER_INDEX)
      .returns(false);

    await expect(
      jbController.connect(caller).migrate(PROJECT_ID, mockJbController.address),
    ).to.be.revertedWith('UNAUTHORIZED()');
  });

  it(`Can't migrate if migration is not initiated via the current controller`, async function () {
    const { deployer, jbController, projectOwner, mockJbDirectory, mockJbController } =
      await setup();

    let mockCurrentController = await deployMockContract(deployer, JbController.abi);

    await mockJbDirectory.mock.controllerOf
      .withArgs(PROJECT_ID)
      .returns(mockCurrentController.address);

    await expect(
      jbController.connect(projectOwner).migrate(PROJECT_ID, mockJbController.address),
    ).to.be.revertedWith(errors.NOT_CURRENT_CONTROLLER);
  });

  it(`Can't migrate if migration is not allowed in funding cycle`, async function () {
    const { jbController, projectOwner, mockJbFundingCycleStore, mockJbController, timestamp } =
      await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowControllerMigration: 0 }),
    });

    await expect(
      jbController.connect(projectOwner).migrate(PROJECT_ID, mockJbController.address),
    ).to.be.revertedWith(errors.MIGRATION_NOT_ALLOWED);
  });
});
