import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import errors from '../helpers/errors.json';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbToken from '../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::issueTokenFor(...)', function () {
  const PROJECT_ID = 1;
  const NAME = 'TestTokenDAO';
  const SYMBOL = 'TEST';

  let ISSUE_PERMISSION_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    ISSUE_PERMISSION_INDEX = await jbOperations.ISSUE();
  });

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

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
      deployer,
      addrs,
      jbController,
      mockJbTokenStore,
      mockJbToken,
      mockJbOperatorStore,
    };
  }

  it(`Should deploy an ERC-20 token contract if caller is project owner`, async function () {
    const { projectOwner, jbController, mockJbToken } = await setup();
    let returnedAddress = await jbController
      .connect(projectOwner)
      .callStatic.issueTokenFor(PROJECT_ID, NAME, SYMBOL);
    expect(returnedAddress).to.equal(mockJbToken.address);
  });

  it(`Should deploy an ERC-20 token contract if caller is authorized`, async function () {
    const { addrs, projectOwner, jbController, mockJbToken, mockJbOperatorStore } = await setup();
    let caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, ISSUE_PERMISSION_INDEX)
      .returns(true);

    let returnedAddress = await jbController
      .connect(caller)
      .callStatic.issueTokenFor(PROJECT_ID, NAME, SYMBOL);
    expect(returnedAddress).to.equal(mockJbToken.address);
  });

  it(`Can't deploy an ERC-20 token contract if caller is not authorized`, async function () {
    const { addrs, projectOwner, jbController, mockJbToken, mockJbOperatorStore } = await setup();
    let caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, ISSUE_PERMISSION_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, ISSUE_PERMISSION_INDEX)
      .returns(false);

    await expect(
      jbController.connect(caller).callStatic.issueTokenFor(PROJECT_ID, NAME, SYMBOL),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });
});
