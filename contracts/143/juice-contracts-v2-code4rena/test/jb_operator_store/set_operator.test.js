import { expect } from 'chai';
import { ethers } from 'hardhat';

import { makePackedPermissions } from '../helpers/utils';
import errors from '../helpers/errors.json';

describe('JBOperatorStore::setOperator(...)', function () {
  const DOMAIN = 1;
  const PERMISSION_INDEXES_EMPTY = [];
  const PERMISSION_INDEXES_1 = [1, 2, 3];
  const PERMISSION_INDEXES_2 = [4, 5, 6];
  const PERMISSION_INDEXES_OUT_OF_BOUND = [1, 2, 256];

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

  async function setOperatorAndValidateEvent(
    jbOperatorStore,
    operator,
    account,
    domain,
    permissionIndexes,
    packedPermissionIndexes,
  ) {
    const tx = await jbOperatorStore
      .connect(account)
      .setOperator([
        /*operator=*/ operator.address,
        /*domain=*/ domain,
        /*permissionsIndexes=*/ permissionIndexes,
      ]);

    await expect(tx)
      .to.emit(jbOperatorStore, 'SetOperator')
      .withArgs(
        operator.address,
        account.address,
        domain,
        permissionIndexes,
        packedPermissionIndexes,
      );

    expect(await jbOperatorStore.permissionsOf(operator.address, account.address, domain)).to.equal(
      packedPermissionIndexes,
    );
  }

  it('Set operator with no previous value, override it, and clear it', async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();

    await setOperatorAndValidateEvent(
      jbOperatorStore,
      projectOwner,
      /*account=*/ deployer,
      DOMAIN,
      PERMISSION_INDEXES_1,
      makePackedPermissions(PERMISSION_INDEXES_1),
    );

    await setOperatorAndValidateEvent(
      jbOperatorStore,
      projectOwner,
      /*account=*/ deployer,
      DOMAIN,
      PERMISSION_INDEXES_2,
      makePackedPermissions(PERMISSION_INDEXES_2),
    );

    await setOperatorAndValidateEvent(
      jbOperatorStore,
      projectOwner,
      /*account=*/ deployer,
      DOMAIN,
      PERMISSION_INDEXES_EMPTY,
      makePackedPermissions(PERMISSION_INDEXES_EMPTY),
    );
  });

  it('Index out of bounds', async function () {
    const { deployer, projectOwner, jbOperatorStore } = await setup();
    let permissionIndexes = [1, 2, 256];

    await expect(
      jbOperatorStore
        .connect(deployer)
        .setOperator([projectOwner.address, DOMAIN, PERMISSION_INDEXES_OUT_OF_BOUND]),
    ).to.be.revertedWith(errors.PERMISSION_INDEX_OUT_OF_BOUNDS);
  });
});
