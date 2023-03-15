import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { impersonateAccount, packFundingCycleMetadata } from '../helpers/utils';

import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbController from '../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import errors from '../helpers/errors.json';

describe('JBDirectory::setControllerOf(...)', function () {
  const PROJECT_ID = 1;

  let SET_CONTROLLER_PERMISSION_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    SET_CONTROLLER_PERMISSION_INDEX = await jbOperations.SET_CONTROLLER();
  });

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    let mockJbFundingCycleStore = await deployMockContract(deployer, jbFundingCycleStore.abi);
    let mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);
    let mockJbProjects = await deployMockContract(deployer, jbProjects.abi);

    let jbDirectoryFactory = await ethers.getContractFactory('JBDirectory');
    let jbDirectory = await jbDirectoryFactory.deploy(
      mockJbOperatorStore.address,
      mockJbProjects.address,
      mockJbFundingCycleStore.address,
      deployer.address,
    );

    let controller1 = await deployMockContract(projectOwner, jbController.abi);
    let controller2 = await deployMockContract(projectOwner, jbController.abi);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata(),
    });

    return {
      projectOwner,
      deployer,
      addrs,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbProjects,
      mockJbOperatorStore,
      controller1,
      controller2,
      timestamp,
    };
  }

  // --- set ---

  it('Should set controller and emit event if caller is project owner', async function () {
    const { projectOwner, jbDirectory, mockJbProjects, controller1 } = await setup();

    await mockJbProjects.mock.count.returns(PROJECT_ID);

    let tx = await jbDirectory
      .connect(projectOwner)
      .setControllerOf(PROJECT_ID, controller1.address);

    await expect(tx)
      .to.emit(jbDirectory, 'SetController')
      .withArgs(PROJECT_ID, controller1.address, projectOwner.address);

    let controller = await jbDirectory.connect(projectOwner).controllerOf(PROJECT_ID);
    expect(controller).to.equal(controller1.address);
  });

  it('Should set controller if caller is not project owner but has permission', async function () {
    const { projectOwner, addrs, jbDirectory, mockJbProjects, mockJbOperatorStore, controller1 } =
      await setup();
    let caller = addrs[1];

    // Initialize mock methods to give permission to caller
    await mockJbProjects.mock.count.returns(PROJECT_ID);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, SET_CONTROLLER_PERMISSION_INDEX)
      .returns(true);

    await expect(jbDirectory.connect(caller).setControllerOf(PROJECT_ID, controller1.address)).to
      .not.be.reverted;
  });

  it('Should set controller if caller is current controller', async function () {
    const { projectOwner, jbDirectory, mockJbProjects, controller1, controller2 } = await setup();

    await mockJbProjects.mock.count.returns(PROJECT_ID);

    await jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller1.address);

    let controller = await jbDirectory.connect(projectOwner).controllerOf(PROJECT_ID);
    expect(controller).to.equal(controller1.address);

    let caller = await impersonateAccount(controller1.address);

    await jbDirectory.connect(caller).setControllerOf(PROJECT_ID, controller2.address);

    controller = await jbDirectory.connect(projectOwner).controllerOf(PROJECT_ID);
    expect(controller).to.equal(controller2.address);
  });

  it('Should set controller if caller is allowed to set first controller and project has no controller yet', async function () {
    const {
      deployer,
      projectOwner,
      jbDirectory,
      mockJbProjects,
      mockJbOperatorStore,
      controller1,
      controller2,
    } = await setup();

    let caller = await impersonateAccount(controller1.address);

    // Initialize mock methods to reject permission to controllerSigner
    await mockJbProjects.mock.count.returns(PROJECT_ID);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, SET_CONTROLLER_PERMISSION_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, SET_CONTROLLER_PERMISSION_INDEX)
      .returns(false);

    await jbDirectory.connect(deployer).setIsAllowedToSetFirstController(caller.address, true);

    await expect(jbDirectory.connect(caller).setControllerOf(PROJECT_ID, controller2.address)).to
      .not.be.reverted;
  });

  it('Cannot set controller if caller is not allowed to set first controller and project has no controller yet', async function () {
    const {
      projectOwner,
      jbDirectory,
      mockJbProjects,
      mockJbOperatorStore,
      controller1,
      controller2,
    } = await setup();

    let caller = await impersonateAccount(controller1.address);

    // Initialize mock methods to reject permission to controllerSigner
    await mockJbProjects.mock.count.returns(PROJECT_ID);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, SET_CONTROLLER_PERMISSION_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, SET_CONTROLLER_PERMISSION_INDEX)
      .returns(false);

    await expect(jbDirectory.connect(caller).setControllerOf(PROJECT_ID, controller2.address)).to.be
      .reverted;
  });

  it('Cannot set controller if caller is allowed to set first controller but project has already a first controller', async function () {
    const { deployer, projectOwner, jbDirectory, mockJbProjects, addrs, controller1, controller2 } =
      await setup();

    // Initialize mock methods to reject permission to controllerSigner
    await mockJbProjects.mock.count.returns(PROJECT_ID);

    const caller = addrs[0];

    await jbDirectory.connect(deployer).setIsAllowedToSetFirstController(caller.address, true);

    await jbDirectory.connect(caller).setControllerOf(PROJECT_ID, controller1.address);

    await expect(jbDirectory.connect(caller).setControllerOf(PROJECT_ID, controller2.address)).to.be
      .reverted;
  });

  it(`Can't set if project id does not exist`, async function () {
    const { projectOwner, jbDirectory, mockJbProjects, controller1 } = await setup();

    await mockJbProjects.mock.count.returns(PROJECT_ID - 1);

    await expect(
      jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller1.address),
    ).to.be.revertedWith(errors.INVALID_PROJECT_ID_IN_DIRECTORY);
  });

  // --- change ---

  it('Should change controller and emit event if caller is the current controller', async function () {
    const { projectOwner, jbDirectory, mockJbProjects, controller1, controller2 } = await setup();

    await mockJbProjects.mock.count.returns(PROJECT_ID);

    await jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller1.address);

    let tx = await jbDirectory
      .connect(await impersonateAccount(controller1.address))
      .setControllerOf(PROJECT_ID, controller2.address);

    await expect(tx)
      .to.emit(jbDirectory, 'SetController')
      .withArgs(PROJECT_ID, controller2.address, controller1.address);

    let controller = await jbDirectory.connect(projectOwner).controllerOf(PROJECT_ID);
    expect(controller).to.equal(controller2.address);
  });

  it('Cannot change controller if funding cycle prohibit it, if the caller is the current controller', async function () {
    const {
      projectOwner,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbProjects,
      controller1,
      controller2,
      timestamp,
    } = await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowSetController: false }),
    });

    await mockJbProjects.mock.count.returns(PROJECT_ID);

    await jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller1.address);

    await expect(
      jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller2.address),
    ).to.be.revertedWith(errors.SET_CONTROLLER_NOT_ALLOWED);

    let controller = await jbDirectory.connect(projectOwner).controllerOf(PROJECT_ID);
    expect(controller).to.equal(controller1.address);
  });
});
