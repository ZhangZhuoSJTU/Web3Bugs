import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import errors from '../helpers/errors.json';

describe('JBTokenStore::shouldRequireClaimingFor(...)', function () {
  const PROJECT_ID = 2;
  const TOKEN_NAME = 'TestTokenDAO';
  const TOKEN_SYMBOL = 'TEST';

  async function setup() {
    const [deployer, controller, projectOwner, holder, recipient] = await ethers.getSigners();

    const jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    const jbOperations = await jbOperationsFactory.deploy();

    const REQUIRE_CLAIM_INDEX = await jbOperations.REQUIRE_CLAIM();

    const mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);
    const mockJbProjects = await deployMockContract(deployer, jbProjects.abi);
    const mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);

    const jbTokenStoreFactory = await ethers.getContractFactory('JBTokenStore');
    const jbTokenStore = await jbTokenStoreFactory.deploy(
      mockJbOperatorStore.address,
      mockJbProjects.address,
      mockJbDirectory.address,
    );

    return {
      controller,
      projectOwner,
      holder,
      recipient,
      mockJbDirectory,
      mockJbOperatorStore,
      mockJbProjects,
      jbTokenStore,
      REQUIRE_CLAIM_INDEX,
    };
  }

  it('Should set flag and emit event if caller is project owner', async function () {
    const { controller, projectOwner, mockJbDirectory, mockJbProjects, jbTokenStore } =
      await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);
    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    // Issue token for project
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Set flag value
    const flagVal = true;
    const shouldRequireClaimingForTx = await jbTokenStore
      .connect(projectOwner)
      .shouldRequireClaimingFor(PROJECT_ID, flagVal);

    expect(await jbTokenStore.requireClaimFor(PROJECT_ID)).to.equal(flagVal);

    await expect(shouldRequireClaimingForTx)
      .to.emit(jbTokenStore, 'ShouldRequireClaim')
      .withArgs(PROJECT_ID, flagVal, projectOwner.address);
  });

  it('Should set flag and emit event if caller has permission', async function () {
    const {
      controller,
      projectOwner,
      holder,
      mockJbDirectory,
      mockJbOperatorStore,
      mockJbProjects,
      jbTokenStore,
      REQUIRE_CLAIM_INDEX,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(holder.address, projectOwner.address, PROJECT_ID, REQUIRE_CLAIM_INDEX)
      .returns(true);

    // Issue token for project
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Set flag value
    const flagVal = true;
    const shouldRequireClaimingForTx = await jbTokenStore
      .connect(holder)
      .shouldRequireClaimingFor(PROJECT_ID, flagVal);

    expect(await jbTokenStore.requireClaimFor(PROJECT_ID)).to.equal(flagVal);

    await expect(shouldRequireClaimingForTx)
      .to.emit(jbTokenStore, 'ShouldRequireClaim')
      .withArgs(PROJECT_ID, flagVal, holder.address);
  });

  it(`Can't set flag if token doesn't exist for project`, async function () {
    const {
      controller,
      holder,
      mockJbOperatorStore,
      mockJbProjects,
      jbTokenStore,
      REQUIRE_CLAIM_INDEX,
    } = await setup();

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(controller.address);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(controller.address, holder.address, PROJECT_ID, REQUIRE_CLAIM_INDEX)
      .returns(true);

    await expect(
      jbTokenStore.connect(controller).shouldRequireClaimingFor(PROJECT_ID, /* flag= */ true),
    ).to.be.revertedWith(errors.TOKEN_NOT_FOUND);
  });

  it(`Can't set flag if caller lacks permission`, async function () {
    const {
      projectOwner,
      holder,
      mockJbOperatorStore,
      mockJbProjects,
      jbTokenStore,
      REQUIRE_CLAIM_INDEX,
    } = await setup();

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(holder.address, projectOwner.address, PROJECT_ID, REQUIRE_CLAIM_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(holder.address, projectOwner.address, 0, REQUIRE_CLAIM_INDEX)
      .returns(false);

    await expect(
      jbTokenStore.connect(holder).shouldRequireClaimingFor(PROJECT_ID, /* flag= */ false),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });
});
