import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { packFundingCycleMetadata } from '../helpers/utils';
import errors from '../helpers/errors.json';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbToken from '../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::changeTokenOf(...)', function () {
  const PROJECT_ID = 1;
  const DOMAIN = 1;
  const NAME = 'TestTokenDAO';
  const SYMBOL = 'TEST';
  let CHANGE_TOKEN_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    CHANGE_TOKEN_INDEX = await jbOperations.CHANGE_TOKEN();
  });

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    let [
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbToken,
      mockJbTokenStore,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbFundingCycleStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbToken.abi),
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

    await mockJbTokenStore.mock.issueFor
      .withArgs(PROJECT_ID, NAME, SYMBOL)
      .returns(mockJbToken.address);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    return {
      projectOwner,
      addrs,
      jbController,
      mockJbOperatorStore,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      mockJbToken,
      timestamp,
    };
  }

  it(`Should change current token if caller is project owner and funding cycle not paused`, async function () {
    const {
      projectOwner,
      addrs,
      jbController,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      mockJbToken,
      timestamp,
    } = await setup();
    let newTokenOwner = addrs[0];

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowChangeToken: 1 }),
    });

    await mockJbTokenStore.mock.changeFor
      .withArgs(PROJECT_ID, mockJbToken.address, newTokenOwner.address)
      .returns(ethers.constants.AddressZero);

    await expect(
      jbController
        .connect(projectOwner)
        .changeTokenOf(PROJECT_ID, mockJbToken.address, newTokenOwner.address),
    ).to.be.not.reverted;
  });

  it(`Should change current token if caller is not project owner but is authorized`, async function () {
    const {
      projectOwner,
      addrs,
      jbController,
      mockJbOperatorStore,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      mockJbToken,
      timestamp,
    } = await setup();
    let newTokenOwner = addrs[0];
    let caller = addrs[1];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, DOMAIN, CHANGE_TOKEN_INDEX)
      .returns(true);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowChangeToken: 1 }),
    });

    await mockJbTokenStore.mock.changeFor
      .withArgs(PROJECT_ID, mockJbToken.address, newTokenOwner.address)
      .returns(ethers.constants.AddressZero);

    await expect(
      jbController
        .connect(caller)
        .changeTokenOf(PROJECT_ID, mockJbToken.address, newTokenOwner.address),
    ).to.be.not.reverted;
  });

  it(`Can't change current token if caller is not authorized`, async function () {
    const {
      projectOwner,
      addrs,
      jbController,
      mockJbOperatorStore,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      mockJbToken,
      timestamp,
    } = await setup();
    let newTokenOwner = addrs[0];
    let caller = addrs[1];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, DOMAIN, CHANGE_TOKEN_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, CHANGE_TOKEN_INDEX)
      .returns(false);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowChangeToken: 1 }),
    });

    await mockJbTokenStore.mock.changeFor
      .withArgs(PROJECT_ID, mockJbToken.address, newTokenOwner.address)
      .returns(ethers.constants.AddressZero);

    await expect(
      jbController
        .connect(caller)
        .changeTokenOf(PROJECT_ID, mockJbToken.address, newTokenOwner.address),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });

  it(`Can't change current token if funding cycle is paused`, async function () {
    const {
      projectOwner,
      addrs,
      jbController,
      mockJbOperatorStore,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      mockJbToken,
      timestamp,
    } = await setup();
    let newTokenOwner = addrs[0];

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowChangeToken: 0 }),
    });

    await mockJbTokenStore.mock.changeFor
      .withArgs(PROJECT_ID, mockJbToken.address, newTokenOwner.address)
      .returns(ethers.constants.AddressZero);

    await expect(
      jbController
        .connect(projectOwner)
        .changeTokenOf(PROJECT_ID, mockJbToken.address, newTokenOwner.address),
    ).to.revertedWith(errors.CHANGE_TOKEN_NOT_ALLOWED);
  });
});
