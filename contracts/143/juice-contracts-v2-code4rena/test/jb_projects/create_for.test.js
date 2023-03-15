import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('JBProjects::createFor(...)', function () {
  const METADATA_CID = 'QmThsKQpFBQicz3t3SU9rRz3GV81cwjnWsBBLxzznRNvpa';
  const METADATA_DOMAIN = 1234;
  const PROJECT_ID_1 = 1;
  const PROJECT_ID_2 = 2;

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

    let jbOperatorStoreFactory = await ethers.getContractFactory('JBOperatorStore');
    let jbOperatorStore = await jbOperatorStoreFactory.deploy();

    let jbProjectsFactory = await ethers.getContractFactory('JBProjects');
    let jbProjectsStore = await jbProjectsFactory.deploy(jbOperatorStore.address);

    return {
      projectOwner,
      deployer,
      addrs,
      jbProjectsStore,
    };
  }

  it(`Should create a project and emit Create`, async function () {
    const { projectOwner, deployer, jbProjectsStore } = await setup();

    let tx = await jbProjectsStore
      .connect(deployer)
      .createFor(projectOwner.address, [METADATA_CID, METADATA_DOMAIN]);

    let storedMetadataCid = await jbProjectsStore
      .connect(deployer)
      .metadataContentOf(PROJECT_ID_1, METADATA_DOMAIN);

    await expect(storedMetadataCid).to.equal(METADATA_CID);

    await expect(tx)
      .to.emit(jbProjectsStore, 'Create')
      .withArgs(
        PROJECT_ID_1,
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        deployer.address,
      );
  });

  it(`Should create two projects and count to be 2 and emit Create`, async function () {
    const { projectOwner, deployer, jbProjectsStore } = await setup();

    await jbProjectsStore
      .connect(deployer)
      .createFor(projectOwner.address, [METADATA_CID, METADATA_DOMAIN]);

    let tx = await jbProjectsStore
      .connect(deployer)
      .createFor(projectOwner.address, [METADATA_CID, METADATA_DOMAIN]);

    await expect(tx)
      .to.emit(jbProjectsStore, 'Create')
      .withArgs(
        PROJECT_ID_2,
        projectOwner.address,
        [METADATA_CID, METADATA_DOMAIN],
        deployer.address,
      );
  });
});
