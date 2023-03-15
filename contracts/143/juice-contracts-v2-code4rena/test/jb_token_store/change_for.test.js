import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbToken from '../../artifacts/contracts/JBToken.sol/JBToken.json';
import { deployJbToken } from '../helpers/utils';
import errors from '../helpers/errors.json';

describe('JBTokenStore::changeFor(...)', function () {
  const PROJECT_ID = 2;
  const TOKEN_NAME = 'TestTokenDAO';
  const TOKEN_SYMBOL = 'TEST';
  const NEW_TOKEN_NAME = 'NewTokenDAO';
  const NEW_TOKEN_SYMBOL = 'NEW';

  async function setup() {
    const [deployer, controller, newOwner] = await ethers.getSigners();

    const mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);
    const mockJbProjects = await deployMockContract(deployer, jbProjects.abi);
    const mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);
    const mockJbToken = await deployMockContract(deployer, jbToken.abi);

    const jbTokenStoreFactory = await ethers.getContractFactory('JBTokenStore');
    const jbTokenStore = await jbTokenStoreFactory.deploy(
      mockJbOperatorStore.address,
      mockJbProjects.address,
      mockJbDirectory.address,
    );

    return {
      newOwner,
      controller,
      mockJbDirectory,
      mockJbProjects,
      mockJbToken,
      jbTokenStore,
    };
  }

  it('Should change tokens and emit event if caller is controller', async function () {
    const { newOwner, controller, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // Issue the initial token and grab a reference to it.
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);
    const initialTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);
    const initialToken = new Contract(initialTokenAddr, jbToken.abi);

    // Change to a new token.
    let newToken = await deployJbToken(NEW_TOKEN_NAME, NEW_TOKEN_SYMBOL);
    const changeTx = await jbTokenStore
      .connect(controller)
      .changeFor(PROJECT_ID, newToken.address, newOwner.address);

    const newTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);
    newToken = new Contract(newTokenAddr, jbToken.abi);

    expect(await newToken.connect(controller).name()).to.equal(NEW_TOKEN_NAME);
    expect(await newToken.connect(controller).symbol()).to.equal(NEW_TOKEN_SYMBOL);

    // The ownership of the initial token should be changed.
    expect(await initialToken.connect(controller).owner()).to.equal(newOwner.address);

    await expect(changeTx)
      .to.emit(jbTokenStore, 'Change')
      .withArgs(PROJECT_ID, newTokenAddr, initialTokenAddr, newOwner.address, controller.address);
  });

  it('Should change token to address(0), without changing the owner of address(0), and emit event if caller is controller', async function () {
    const { newOwner, controller, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // Issue the initial token and grab a reference to it.
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);
    const initialTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);
    const initialToken = new Contract(initialTokenAddr, jbToken.abi);

    // Change to a new token.
    let newToken = ethers.constants.AddressZero;
    const changeTx = await jbTokenStore
      .connect(controller)
      .changeFor(PROJECT_ID, newToken, newOwner.address);

    expect(await jbTokenStore.projectOf(newToken)).to.equal(ethers.constants.AddressZero);

    // The ownership of the initial token should be changed.
    expect(await initialToken.connect(controller).owner()).to.equal(newOwner.address);

    await expect(changeTx)
      .to.emit(jbTokenStore, 'Change')
      .withArgs(PROJECT_ID, newToken, initialTokenAddr, newOwner.address, controller.address);
  });

  it('Should change tokens without changing owner of old token', async function () {
    const { controller, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // Issue the initial token and grab a reference to it.
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);
    const initialTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);
    const initialToken = new Contract(initialTokenAddr, jbToken.abi);
    const initialTokenOwner = await initialToken.connect(controller).owner();
    expect(await jbTokenStore.connect(controller).projectOf(initialTokenAddr)).to.equal(PROJECT_ID);

    // Change to a new token without assigning a new owner for the old token
    let newToken = await deployJbToken(NEW_TOKEN_NAME, NEW_TOKEN_SYMBOL);
    const changeTx = await jbTokenStore
      .connect(controller)
      .changeFor(PROJECT_ID, newToken.address, ethers.constants.AddressZero);

    const newTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);
    newToken = new Contract(newTokenAddr, jbToken.abi);

    expect(await jbTokenStore.connect(controller).projectOf(newToken.address)).to.equal(PROJECT_ID);
    expect(await jbTokenStore.connect(controller).projectOf(initialTokenAddr)).to.equal(0);
    expect(await newToken.connect(controller).name()).to.equal(NEW_TOKEN_NAME);
    expect(await newToken.connect(controller).symbol()).to.equal(NEW_TOKEN_SYMBOL);

    // The ownership of the initial token should not be changed.
    expect(await initialToken.connect(controller).owner()).to.equal(initialTokenOwner);

    await expect(changeTx)
      .to.emit(jbTokenStore, 'Change')
      .withArgs(
        PROJECT_ID,
        newTokenAddr,
        initialTokenAddr,
        ethers.constants.AddressZero,
        controller.address,
      );
  });

  it('Should not change project of the previous token if it was the address(0), and emit event if caller is controller', async function () {
    const { newOwner, controller, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    // Issue the initial token and grab a reference to it.
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);
    const initialTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);
    const initialToken = new Contract(initialTokenAddr, jbToken.abi);

    // Change to a new token at address(0)
    let newToken = ethers.constants.AddressZero;
    let changeTx = await jbTokenStore
      .connect(controller)
      .changeFor(PROJECT_ID, newToken, newOwner.address);

    expect(await jbTokenStore.projectOf(newToken)).to.equal(ethers.constants.AddressZero);

    // The ownership of the initial token should be changed.
    expect(await initialToken.connect(controller).owner()).to.equal(newOwner.address);

    // Change to a new token
    newToken = await deployJbToken(NEW_TOKEN_NAME, NEW_TOKEN_SYMBOL);
    changeTx = await jbTokenStore
      .connect(controller)
      .changeFor(PROJECT_ID, newToken.address, newOwner.address);

    await expect(changeTx)
      .to.emit(jbTokenStore, 'Change')
      .withArgs(
        PROJECT_ID,
        newToken.address,
        ethers.constants.AddressZero,
        newOwner.address,
        controller.address,
      );

    expect(await jbTokenStore.projectOf(ethers.constants.AddressZero)).to.equal(0);
  });

  it(`Can't change tokens if caller does not have permission`, async function () {
    const { controller, mockJbDirectory, jbTokenStore } = await setup();

    // Return a random controller address.
    await mockJbDirectory.mock.controllerOf
      .withArgs(PROJECT_ID)
      .returns(ethers.Wallet.createRandom().address);

    await expect(
      jbTokenStore
        .connect(controller)
        .changeFor(
          PROJECT_ID,
          ethers.Wallet.createRandom().address,
          ethers.Wallet.createRandom().address,
        ),
    ).to.be.revertedWith(errors.CONTROLLER_UNAUTHORIZED);
  });

  it(`Can't remove the project's token if claiming is required`, async function () {
    const { controller, mockJbDirectory, mockJbProjects, jbTokenStore, newOwner } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(newOwner.address);
    // Issue the initial token.
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);
    // Require claiming.
    await jbTokenStore.connect(newOwner).shouldRequireClaimingFor(PROJECT_ID, true);

    await expect(
      jbTokenStore
        .connect(controller)
        .changeFor(PROJECT_ID, ethers.constants.AddressZero, ethers.Wallet.createRandom().address),
    ).to.be.revertedWith(errors.CANT_REMOVE_TOKEN_IF_ITS_REQUIRED);
  });

  it(`Can't change the project's token if its being used by another project`, async function () {
    const { controller, mockJbDirectory, jbTokenStore } = await setup();
    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);
    // Issue the initial token and grab a reference to it.
    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);
    const initialTokenAddr = await jbTokenStore.connect(controller).tokenOf(PROJECT_ID);

    const OTHER_PROJECT_ID = 1234;

    await mockJbDirectory.mock.controllerOf.withArgs(OTHER_PROJECT_ID).returns(controller.address);

    await expect(
      jbTokenStore
        .connect(controller)
        .changeFor(OTHER_PROJECT_ID, initialTokenAddr, ethers.Wallet.createRandom().address),
    ).to.be.revertedWith(errors.TOKEN_ALREADY_IN_USE);
  });

  it(`Can't add non-18 decimal token`, async function () {
    const { controller, mockJbDirectory, mockJbProjects, mockJbToken, jbTokenStore, newOwner } =
      await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await mockJbToken.mock.decimals.returns(19);

    await expect(
      jbTokenStore
        .connect(controller)
        .changeFor(PROJECT_ID, mockJbToken.address, ethers.Wallet.createRandom().address),
    ).to.be.revertedWith(errors.TOKENS_MUST_HAVE_18_DECIMALS);
  });
});
