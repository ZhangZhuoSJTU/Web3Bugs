import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { impersonateAccount } from '../helpers/utils';
import errors from '../helpers/errors.json';

import JbController from '../../artifacts/contracts/JBController.sol/JBController.json';
import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::prepForMigrationOf(...)', function () {
  const PROJECT_ID = 1;
  const TOTAL_SUPPLY = 20000;

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

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

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(TOTAL_SUPPLY);

    return {
      projectOwner,
      addrs,
      jbController,
      mockJbDirectory,
      mockJbTokenStore,
      mockJbController,
    };
  }

  it(`Should set the processed token tracker as the total supply if caller is not project's current controller`, async function () {
    const { jbController } = await setup();
    let controllerSigner = await impersonateAccount(jbController.address);

    const tx = jbController
      .connect(controllerSigner)
      .prepForMigrationOf(PROJECT_ID, ethers.constants.AddressZero);

    await expect(tx).to.be.not.reverted;

    // reserved token balance should be at 0 if processed token = total supply
    expect(await jbController.reservedTokenBalanceOf(PROJECT_ID, 10000)).to.equal(0);
    await expect(tx)
      .to.emit(jbController, 'PrepMigration')
      .withArgs(PROJECT_ID, ethers.constants.AddressZero, controllerSigner.address);
  });

  it(`Can't prep for migration if the caller is the current controller`, async function () {
    const { jbController, mockJbController, mockJbDirectory } = await setup();
    let controllerSigner = await impersonateAccount(mockJbController.address);

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(jbController.address);

    await expect(
      jbController
        .connect(controllerSigner)
        .prepForMigrationOf(PROJECT_ID, ethers.constants.AddressZero),
    ).to.be.revertedWith(errors.CANT_MIGRATE_TO_CURRENT_CONTROLLER);
  });
});
