import { expect } from 'chai';
import { ethers } from 'hardhat';
import errors from '../helpers/errors.json';

describe('JBOperatorStore::hasPermissions(...)', function () {
  const DOMAIN = 1;
  const DOMAIN_2 = 2;
  const PERMISSION_INDEXES_1 = [1, 2, 3];
  const PERMISSION_INDEXES_2 = [4, 5, 6];
  const PERMISSION_INDEXES_OUT_OF_BOUND = [256];

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
        .hasPermissions(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN,
          /*permissionIndexes=*/ PERMISSION_INDEXES_OUT_OF_BOUND,
        ),
    ).to.be.revertedWith(errors.PERMISSION_INDEX_OUT_OF_BOUNDS);
  });

  it('Account is caller', async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();
    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ projectOwner.address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    expect(
      await jbOperatorStore
        .connect(deployer)
        .hasPermissions(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN,
          /*permissionIndexes=*/ PERMISSION_INDEXES_1,
        ),
    ).to.be.true;
  });

  it('Account is not caller', async function () {
    const { deployer, projectOwner, addrs, jbOperatorStore } = await setup();

    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ addrs[0].address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    expect(
      await jbOperatorStore
        .connect(projectOwner)
        .hasPermissions(
          /*operator=*/ addrs[0].address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN,
          /*permissionIndexes=*/ PERMISSION_INDEXES_1,
        ),
    ).to.be.true;
  });

  it("Doesn't have permissions if never set", async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();
    expect(
      await jbOperatorStore
        .connect(deployer)
        .hasPermissions(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN,
          /*permissionIndexes=*/ PERMISSION_INDEXES_1,
        ),
    ).to.be.false;
  });

  it("Doesn't have permissions if indexes differ", async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();

    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ projectOwner.address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    expect(
      await jbOperatorStore
        .connect(deployer)
        .hasPermissions(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN,
          /*permissionIndexes=*/ PERMISSION_INDEXES_2,
        ),
    ).to.be.false;
  });

  it("Doesn't have permissions if domain differs", async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();

    await jbOperatorStore
      .connect(deployer)
      .setOperator([
        /*operator=*/ projectOwner.address,
        /*domain=*/ DOMAIN,
        /*permissionIndexes=*/ PERMISSION_INDEXES_1,
      ]);

    expect(
      await jbOperatorStore
        .connect(deployer)
        .hasPermissions(
          /*operator=*/ projectOwner.address,
          /*account=*/ deployer.address,
          /*domain=*/ DOMAIN_2,
          /*permissionIndexes=*/ PERMISSION_INDEXES_1,
        ),
    ).to.be.false;
  });
});
