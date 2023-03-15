import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import errors from '../helpers/errors.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbController from '../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';
import { impersonateAccount, packFundingCycleMetadata } from '../helpers/utils';

describe('JBDirectory::setTerminalsOf(...)', function () {
  const PROJECT_ID = 1;
  const ADDRESS_TOKEN_3 = ethers.Wallet.createRandom().address;
  let SET_TERMINALS_PERMISSION_INDEX;
  let SET_CONTROLLER_PERMISSION_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    SET_TERMINALS_PERMISSION_INDEX = await jbOperations.SET_TERMINALS();
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

    let controller = await deployMockContract(projectOwner, jbController.abi);

    let terminal1 = await deployMockContract(projectOwner, jbTerminal.abi);
    let terminal2 = await deployMockContract(projectOwner, jbTerminal.abi);
    let terminal3 = await deployMockContract(projectOwner, jbTerminal.abi);

    const tokenTerminal1 = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(tokenTerminal1);
    await terminal1.mock.acceptsToken.withArgs(tokenTerminal1, PROJECT_ID).returns(true);

    const tokenTerminal2 = ethers.Wallet.createRandom().address;
    await terminal2.mock.token.returns(tokenTerminal2);
    await terminal2.mock.acceptsToken.withArgs(tokenTerminal2, PROJECT_ID).returns(true);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        projectOwner.address,
        projectOwner.address,
        PROJECT_ID,
        SET_TERMINALS_PERMISSION_INDEX,
      )
      .returns(true);

    await mockJbProjects.mock.count.returns(PROJECT_ID);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ global: { allowSetTerminals: true } }),
    });

    return {
      projectOwner,
      controller,
      deployer,
      addrs,
      jbDirectory,
      timestamp,
      terminal1,
      terminal2,
      terminal3,
      mockJbFundingCycleStore,
      mockJbProjects,
      mockJbOperatorStore,
    };
  }

  it('Should add terminals and emit events if caller is project owner', async function () {
    const { projectOwner, jbDirectory, terminal1, terminal2 } = await setup();

    const terminals = [terminal1.address, terminal2.address];

    await expect(jbDirectory.connect(projectOwner).setTerminalsOf(PROJECT_ID, terminals))
      .to.emit(jbDirectory, 'SetTerminals')
      .withArgs(PROJECT_ID, terminals, projectOwner.address);
  });

  it('Should add terminals and return the first compatible terminal if the previous primary terminal is not part of the new ones', async function () {
    const { projectOwner, jbDirectory, terminal1, terminal2, terminal3 } = await setup();

    const terminals = [terminal1.address, terminal2.address];

    await terminal3.mock.token.returns(ADDRESS_TOKEN_3);
    await terminal3.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(true);

    expect(
      await jbDirectory
        .connect(projectOwner)
        .setPrimaryTerminalOf(PROJECT_ID, ADDRESS_TOKEN_3, terminal3.address),
    )
      .to.emit(jbDirectory, 'SetPrimaryTerminal')
      .withArgs(PROJECT_ID, ADDRESS_TOKEN_3, terminal3.address, projectOwner.address);

    await expect(jbDirectory.connect(projectOwner).setTerminalsOf(PROJECT_ID, terminals)).to.emit(
      jbDirectory,
      'SetTerminals',
    );
    //.withArgs(PROJECT_ID, terminals, projectOwner.address);

    await terminal1.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(false);
    await terminal2.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(true);

    expect(await jbDirectory.primaryTerminalOf(PROJECT_ID, ADDRESS_TOKEN_3)).to.equal(
      terminal2.address,
    );
  });

  it('Should add terminals and return address 0 if the previous primary terminal is not part of the new ones and none support the token', async function () {
    const { projectOwner, jbDirectory, terminal1, terminal2, terminal3 } = await setup();

    const terminals = [terminal1.address, terminal2.address];

    await terminal3.mock.token.returns(ADDRESS_TOKEN_3);
    await terminal3.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(true);

    expect(
      await jbDirectory
        .connect(projectOwner)
        .setPrimaryTerminalOf(PROJECT_ID, ADDRESS_TOKEN_3, terminal3.address),
    )
      .to.emit(jbDirectory, 'SetPrimaryTerminal')
      .withArgs(PROJECT_ID, ADDRESS_TOKEN_3, terminal3.address, projectOwner.address);

    await expect(jbDirectory.connect(projectOwner).setTerminalsOf(PROJECT_ID, terminals)).to.emit(
      jbDirectory,
      'SetTerminals',
    );
    //.withArgs(PROJECT_ID, terminals, projectOwner.address);

    await terminal1.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(false);
    await terminal2.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(false);

    expect(await jbDirectory.primaryTerminalOf(PROJECT_ID, ADDRESS_TOKEN_3)).to.equal(
      ethers.constants.AddressZero,
    );
  });

  it('Should add terminals and keep a previous primary terminal if it is included in the new terminals', async function () {
    const { projectOwner, jbDirectory, terminal1, terminal2, terminal3 } = await setup();

    const terminals = [terminal1.address, terminal2.address, terminal3.address];

    await terminal3.mock.token.returns(ADDRESS_TOKEN_3);
    await terminal3.mock.acceptsToken.withArgs(ADDRESS_TOKEN_3, PROJECT_ID).returns(true);

    expect(
      await jbDirectory
        .connect(projectOwner)
        .setPrimaryTerminalOf(PROJECT_ID, ADDRESS_TOKEN_3, terminal3.address),
    )
      .to.emit(jbDirectory, 'SetPrimaryTerminal')
      .withArgs(PROJECT_ID, ADDRESS_TOKEN_3, terminal3.address, projectOwner.address);

    await expect(jbDirectory.connect(projectOwner).setTerminalsOf(PROJECT_ID, terminals)).to.emit(
      jbDirectory,
      'SetTerminals',
    );
    //.withArgs(PROJECT_ID, terminals, projectOwner.address);

    expect(await jbDirectory.primaryTerminalOf(PROJECT_ID, ADDRESS_TOKEN_3)).to.equal(
      terminal3.address,
    );
  });

  it('Should add if caller is controller of the project', async function () {
    const { addrs, projectOwner, jbDirectory, mockJbProjects, mockJbOperatorStore, terminal1 } =
      await setup();
    // Give the project owner permissions to set the controller.
    await mockJbProjects.mock.count.returns(1);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        projectOwner.address,
        projectOwner.address,
        PROJECT_ID,
        SET_CONTROLLER_PERMISSION_INDEX,
      )
      .returns(true);

    let controller = await deployMockContract(addrs[1], jbController.abi);
    let controllerSigner = await impersonateAccount(controller.address);

    await expect(
      jbDirectory.connect(controllerSigner).setTerminalsOf(PROJECT_ID, [terminal1.address]),
    ).to.be.reverted;

    // After the controller has been set, the controller signer should be able to add terminals.
    await jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller.address);
    await expect(
      jbDirectory.connect(controllerSigner).setTerminalsOf(PROJECT_ID, [terminal1.address]),
    ).to.not.be.reverted;
  });

  it('Should add if caller has permission but is not the project owner', async function () {
    const { addrs, projectOwner, jbDirectory, mockJbOperatorStore, terminal1 } = await setup();
    const caller = addrs[1];

    // Give the caller permission to add terminals.
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, SET_TERMINALS_PERMISSION_INDEX)
      .returns(true);

    await expect(jbDirectory.connect(caller).setTerminalsOf(PROJECT_ID, [terminal1.address])).to.not
      .be.reverted;
  });

  it('Should add if the funding cycle prohibits it but the caller is the controller', async function () {
    const {
      addrs,
      controller,
      projectOwner,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      timestamp,
      terminal1,
    } = await setup();

    await jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller.address);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ global: { allowSetTerminals: false } }),
    });

    // Give the caller permission to add terminals.
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        controller.address,
        projectOwner.address,
        PROJECT_ID,
        SET_TERMINALS_PERMISSION_INDEX,
      )
      .returns(true);

    await expect(
      jbDirectory
        .connect(await impersonateAccount(controller.address))
        .setTerminalsOf(PROJECT_ID, [terminal1.address]),
    ).to.not.be.reverted;
  });

  it('Cannot add if caller has permission but is not the controller and funding cycle prohibits it', async function () {
    const {
      addrs,
      projectOwner,
      jbDirectory,
      mockJbOperatorStore,
      mockJbFundingCycleStore,
      terminal1,
      timestamp,
    } = await setup();
    const caller = addrs[1];

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ global: { allowSetTerminals: false } }),
    });

    // Give the caller permission to add terminals.
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, SET_TERMINALS_PERMISSION_INDEX)
      .returns(true);

    await expect(
      jbDirectory.connect(caller).setTerminalsOf(PROJECT_ID, [terminal1.address]),
    ).to.be.revertedWith(errors.SET_TERMINALS_NOT_ALLOWED);
  });

  it("Can't add with duplicates", async function () {
    const { projectOwner, jbDirectory, terminal1 } = await setup();

    await expect(
      jbDirectory
        .connect(projectOwner)
        .setTerminalsOf(PROJECT_ID, [terminal1.address, terminal1.address]),
    ).to.be.revertedWith(errors.DUPLICATE_TERMINALS);
  });

  it("Can't add if caller does not have permission", async function () {
    const { addrs, projectOwner, jbDirectory, mockJbProjects, mockJbOperatorStore, terminal1 } =
      await setup();
    const caller = addrs[1];

    // Ensure the caller does not have permissions to add terminals.
    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);
    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, SET_TERMINALS_PERMISSION_INDEX)
      .returns(false);

    await expect(jbDirectory.connect(caller).setTerminalsOf(PROJECT_ID, [terminal1.address])).to.be
      .reverted;
  });
});
