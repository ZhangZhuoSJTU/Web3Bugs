import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';

describe('JBProjects::setMetadataOf(...)', function () {
  const METADATA_CID = '';
  const METADATA_DOMAIN = 1234;
  const METADATA_CID_2 = 'ipfs://randommetadatacidipsaddress';
  const METADATA_DOMAIN_2 = 23435;
  const PROJECT_ID_1 = 1;

  let SET_METADATA_PERMISSION_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    SET_METADATA_PERMISSION_INDEX = await jbOperations.SET_METADATA();
  });

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

    let mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);
    let jbProjectsFactory = await ethers.getContractFactory('JBProjects');
    let jbProjectsStore = await jbProjectsFactory.deploy(mockJbOperatorStore.address);

    return {
      projectOwner,
      deployer,
      addrs,
      jbProjectsStore,
      mockJbOperatorStore,
    };
  }

  it(`Should set MetadataCid on project by owner and emit SetMetadata`, async function () {
    const { projectOwner, deployer, jbProjectsStore } = await setup();

    await jbProjectsStore
      .connect(deployer)
      .createFor(projectOwner.address, [METADATA_CID, METADATA_DOMAIN]);

    let tx = await jbProjectsStore
      .connect(projectOwner)
      .setMetadataOf(PROJECT_ID_1, [METADATA_CID_2, METADATA_DOMAIN_2]);

    let storedMetadataCid = await jbProjectsStore
      .connect(deployer)
      .metadataContentOf(PROJECT_ID_1, METADATA_DOMAIN_2);
    await expect(storedMetadataCid).to.equal(METADATA_CID_2);

    await expect(tx)
      .to.emit(jbProjectsStore, 'SetMetadata')
      .withArgs(PROJECT_ID_1, [METADATA_CID_2, METADATA_DOMAIN_2], projectOwner.address);
  });

  it(`Should set MetadataCid on project if caller is not owner but has permission`, async function () {
    const { projectOwner, deployer, addrs, jbProjectsStore, mockJbOperatorStore } = await setup();

    await jbProjectsStore
      .connect(deployer)
      .createFor(projectOwner.address, [METADATA_CID, METADATA_DOMAIN]);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(addrs[1].address, projectOwner.address, PROJECT_ID_1, SET_METADATA_PERMISSION_INDEX)
      .returns(true);

    await expect(jbProjectsStore.connect(addrs[1]).setMetadataOf(PROJECT_ID_1, METADATA_CID_2)).to
      .not.be.reverted;
  });

  it(`Can't set MetadataCid on project if caller is not owner and doesn't have permission`, async function () {
    const { projectOwner, deployer, addrs, jbProjectsStore, mockJbOperatorStore } = await setup();

    await jbProjectsStore
      .connect(deployer)
      .createFor(projectOwner.address, [METADATA_CID, METADATA_DOMAIN]);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(addrs[1].address, projectOwner.address, PROJECT_ID_1, SET_METADATA_PERMISSION_INDEX)
      .returns(false);

    await expect(
      jbProjectsStore
        .connect(addrs[1])
        .setMetadataOf(PROJECT_ID_1, [METADATA_CID_2, METADATA_DOMAIN_2]),
    ).to.be.reverted;
  });
});
