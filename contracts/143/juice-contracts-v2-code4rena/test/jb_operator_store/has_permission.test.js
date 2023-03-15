import { expect } from 'chai';
import { ethers } from 'hardhat';
import errors from '../helpers/errors.json';

describe('JBOperatorStore::hasPermission(...)', function () {
  const DOMAIN = 1;
  const DOMAIN_2 = 2;
  const PERMISSION_INDEXES_1 = [1, 2, 3];
  const PERMISSION_INDEXES_2 = [4, 5, 6];
  const PERMISSION_INDEX = 3;

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

    let jbOperatorStoreFactory = await ethers.getContractFactory('JBOperatorStore');
    let jbOperatorStore = await jbOperatorStoreFactory.deploy();

    return {
      projectOwner,
      deployer,
      addrs,
      jbOperatorStore,
    };
  }

  it('Permission index out of bounds', async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();
    await expect(
      jbOperatorStore
        .connect(deployer)
        .hasPermission(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ 1,
          /*permissionIndex=*/ 256,
        ),
    ).to.be.revertedWith(errors.PERMISSION_INDEX_OUT_OF_BOUNDS);
  });

  it('Has permission if account is caller', async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();
    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ projectOwner.address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    for (let permissionIndex of PERMISSION_INDEXES_1) {
      expect(
        await jbOperatorStore
          .connect(deployer)
          .hasPermission(
            /*operator=*/ projectOwner.address,
            /*account=*/ deployer.address,
            /*domain=*/ DOMAIN,
            /*permissionIndex=*/ permissionIndex,
          ),
      ).to.be.true;
    }
  });

  it('Has permission if account is not caller', async function () {
    let { deployer, projectOwner, addrs, jbOperatorStore } = await setup();

    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ addrs[1].address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    for (let permissionIndex of PERMISSION_INDEXES_1) {
      expect(
        await jbOperatorStore
          .connect(projectOwner)
          .hasPermission(
            /*operator=*/ addrs[1].address,
            /*account=*/ deployer.address,
            /*domain=*/ DOMAIN,
            /*permissionIndex=*/ permissionIndex,
          ),
      ).to.be.true;
    }
  });

  it("Doesn't have permission if never set", async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();
    expect(
      await jbOperatorStore
        .connect(deployer)
        .hasPermission(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN,
          /*permissionIndex=*/ PERMISSION_INDEX,
        ),
    ).to.be.be.false;
  });

  it("Doesn't have permission if indexes differ", async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();

    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ projectOwner.address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    for (let permissionIndex of PERMISSION_INDEXES_2) {
      expect(
        await jbOperatorStore
          .connect(deployer)
          .hasPermission(
            /*operator=*/ projectOwner.address,
            /*account=*/ deployer.address,
            /*domain=*/ DOMAIN,
            /*permissionIndex=*/ permissionIndex,
          ),
      ).to.be.false;
    }
  });

  it("Doesn't have permission if domain differs", async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();

    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ projectOwner.address,
        /*domain=*/ DOMAIN,
        /*permissionIndex=*/ PERMISSION_INDEXES_1,
      ]);

    for (let permissionIndex of PERMISSION_INDEXES_1) {
      expect(
        await jbOperatorStore
          .connect(deployer)
          .hasPermission(
            /*operator=*/ projectOwner.address,
            /*account=*/ deployer.address,
            /*domain=*/ DOMAIN_2,
            /*permissionIndex=*/ permissionIndex,
          ),
      ).to.be.false;
    }
  });
});
