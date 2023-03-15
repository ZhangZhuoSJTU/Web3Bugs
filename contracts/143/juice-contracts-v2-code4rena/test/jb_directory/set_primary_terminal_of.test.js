import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { impersonateAccount, packFundingCycleMetadata } from '../helpers/utils';

import errors from '../helpers/errors.json';

import jbController from '../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';

describe('JBDirectory::setPrimaryTerminalOf(...)', function () {
  const PROJECT_ID = 13;

  let SET_PRIMARY_TERMINAL_PERMISSION_INDEX;
  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    SET_PRIMARY_TERMINAL_PERMISSION_INDEX = await jbOperations.SET_PRIMARY_TERMINAL();
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

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

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

    await mockJbProjects.mock.count.returns(PROJECT_ID);

    await jbDirectory.connect(projectOwner).setControllerOf(PROJECT_ID, controller.address);

    return {
      controller,
      projectOwner,
      deployer,
      addrs,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      terminal1,
      terminal2,
      timestamp,
    };
  }

  it('Should set primary terminal and emit an event', async function () {
    const { projectOwner, jbDirectory, terminal1 } = await setup();

    // Initially no terminals should be set.
    let initialTerminals = [...(await jbDirectory.connect(projectOwner).terminalsOf(PROJECT_ID))];
    expect(initialTerminals.length).to.equal(0);

    const terminal1TokenAddress = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(terminal1TokenAddress);
    await terminal1.mock.acceptsToken.withArgs(terminal1TokenAddress, PROJECT_ID).returns(true);

    let tx = await jbDirectory
      .connect(projectOwner)
      .setPrimaryTerminalOf(PROJECT_ID, terminal1TokenAddress, terminal1.address);
    await expect(tx)
      .to.emit(jbDirectory, 'SetPrimaryTerminal')
      .withArgs(PROJECT_ID, terminal1TokenAddress, terminal1.address, projectOwner.address);

    let resultTerminals = [...(await jbDirectory.connect(projectOwner).terminalsOf(PROJECT_ID))];
    resultTerminals.sort();

    // After the primary terminal is set it should be added to the project.
    let expectedTerminals = [terminal1.address];
    expectedTerminals.sort();

    expect(resultTerminals).to.eql(expectedTerminals);
  });

  it('Should set primary terminal if caller is not project owner but has permissions', async function () {
    const { projectOwner, addrs, jbDirectory, mockJbOperatorStore, terminal1 } = await setup();
    let caller = addrs[1];

    let mockToken = ethers.Wallet.createRandom().address;

    await terminal1.mock.token.returns(mockToken);
    await terminal1.mock.acceptsToken.withArgs(mockToken, PROJECT_ID).returns(true);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        caller.address,
        projectOwner.address,
        PROJECT_ID,
        SET_PRIMARY_TERMINAL_PERMISSION_INDEX,
      )
      .returns(true);

    await expect(
      jbDirectory.connect(caller).setPrimaryTerminalOf(PROJECT_ID, mockToken, terminal1.address),
    ).to.not.be.reverted;
  });

  it('Should set a new primary terminal if the funding cycle prohibits it but caller is the controller', async function () {
    const {
      projectOwner,
      addrs,
      controller,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      terminal1,
      timestamp,
    } = await setup();
    let caller = addrs[1];

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

    let mockToken = ethers.Wallet.createRandom().address;

    await terminal1.mock.token.returns(mockToken);
    await terminal1.mock.acceptsToken.withArgs(mockToken, PROJECT_ID).returns(true);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        controller.address,
        projectOwner.address,
        PROJECT_ID,
        SET_PRIMARY_TERMINAL_PERMISSION_INDEX,
      )
      .returns(true);

    await expect(
      jbDirectory
        .connect(await impersonateAccount(controller.address))
        .setPrimaryTerminalOf(PROJECT_ID, mockToken, terminal1.address),
    ).to.be.not.reverted;
  });

  it('Cannot set a new primary terminal if the funding cycle prohibits it', async function () {
    const {
      projectOwner,
      addrs,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      terminal1,
      timestamp,
    } = await setup();
    let caller = addrs[1];

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

    let mockToken = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(mockToken);
    await terminal1.mock.acceptsToken.withArgs(mockToken, PROJECT_ID).returns(true);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        caller.address,
        projectOwner.address,
        PROJECT_ID,
        SET_PRIMARY_TERMINAL_PERMISSION_INDEX,
      )
      .returns(true);

    await expect(
      jbDirectory.connect(caller).setPrimaryTerminalOf(PROJECT_ID, mockToken, terminal1.address),
    ).to.be.revertedWith(errors.SET_TERMINALS_NOT_ALLOWED);
  });

  it('Should set a primary terminal if the funding cycle prohibits it but terminals is already added', async function () {
    const {
      projectOwner,
      addrs,
      controller,
      jbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      terminal1,
      terminal2,
      timestamp,
    } = await setup();

    await jbDirectory
      .connect(projectOwner)
      .setTerminalsOf(PROJECT_ID, [terminal1.address, terminal2.address]);

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

    let mockToken = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(mockToken);
    await terminal1.mock.acceptsToken.withArgs(mockToken, PROJECT_ID).returns(true);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        controller.address,
        projectOwner.address,
        PROJECT_ID,
        SET_PRIMARY_TERMINAL_PERMISSION_INDEX,
      )
      .returns(true);

    await expect(
      jbDirectory
        .connect(projectOwner)
        .setPrimaryTerminalOf(PROJECT_ID, mockToken, terminal1.address),
    ).to.be.not.reverted;
  });

  it(`Can't set primary terminal if caller is not project owner and does not have permission`, async function () {
    const { projectOwner, addrs, jbDirectory, mockJbOperatorStore, terminal1 } = await setup();
    let caller = addrs[1];

    let mockToken = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(mockToken);
    await terminal1.mock.acceptsToken.withArgs(mockToken, PROJECT_ID).returns(true);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        caller.address,
        projectOwner.address,
        PROJECT_ID,
        SET_PRIMARY_TERMINAL_PERMISSION_INDEX,
      )
      .returns(false);

    await expect(
      jbDirectory.connect(caller).setPrimaryTerminalOf(PROJECT_ID, mockToken, terminal1.address),
    ).to.be.reverted;
  });

  it('Should set multiple terminals for the same project with the same token', async function () {
    const { projectOwner, jbDirectory, terminal1, terminal2 } = await setup();

    let token = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(token);
    await terminal1.mock.acceptsToken.withArgs(token, PROJECT_ID).returns(true);

    await terminal2.mock.token.returns(token);
    await terminal2.mock.acceptsToken.withArgs(token, PROJECT_ID).returns(true);

    let terminals = [terminal1.address, terminal2.address];
    await jbDirectory.connect(projectOwner).setTerminalsOf(PROJECT_ID, terminals);

    await jbDirectory
      .connect(projectOwner)
      .setPrimaryTerminalOf(PROJECT_ID, token, terminal1.address);
    expect(await jbDirectory.connect(projectOwner).primaryTerminalOf(PROJECT_ID, token)).to.equal(
      terminal1.address,
    );

    await jbDirectory
      .connect(projectOwner)
      .setPrimaryTerminalOf(PROJECT_ID, token, terminal2.address);
    expect(await jbDirectory.connect(projectOwner).primaryTerminalOf(PROJECT_ID, token)).to.equal(
      terminal2.address,
    );
  });

  it('Cannot set primary terminal if the terminal does not accept the token', async function () {
    const { projectOwner, jbDirectory, terminal1 } = await setup();

    let initialTerminals = [...(await jbDirectory.connect(projectOwner).terminalsOf(PROJECT_ID))];
    expect(initialTerminals.length).to.equal(0);

    const terminal1TokenAddress = ethers.Wallet.createRandom().address;
    await terminal1.mock.token.returns(terminal1TokenAddress);
    await terminal1.mock.acceptsToken.withArgs(terminal1TokenAddress, PROJECT_ID).returns(false);

    await expect(
      jbDirectory
        .connect(projectOwner)
        .setPrimaryTerminalOf(PROJECT_ID, terminal1TokenAddress, terminal1.address),
    ).to.be.revertedWith(errors.TOKEN_NOT_ACCEPTED);

    // Terminals shouldn't have changed
    let resultTerminals = [...(await jbDirectory.connect(projectOwner).terminalsOf(PROJECT_ID))];
    resultTerminals.sort();

    expect(resultTerminals).to.eql(initialTerminals);
  });
});
