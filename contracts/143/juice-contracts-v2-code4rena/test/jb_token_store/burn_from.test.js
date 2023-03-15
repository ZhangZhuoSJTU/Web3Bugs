import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import errors from '../helpers/errors.json';

describe('JBTokenStore::burnFrom(...)', function () {
  const PROJECT_ID = 2;
  const TOKEN_NAME = 'TestTokenDAO';
  const TOKEN_SYMBOL = 'TEST';
  const MAX_TOKENS = BigInt(2 ** 224) - BigInt(1); // Max supply for ERC20Votes tokens

  async function setup() {
    const [deployer, controller, newHolder] = await ethers.getSigners();

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
      newHolder,
      mockJbDirectory,
      jbTokenStore,
    };
  }

  /* Happy path tests with controller access */

  it('Should burn only claimed tokens and emit event', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more claimed tokens
    const preferClaimedTokens = true;
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    // Burn the claimed tokens
    const burnFromTx = await jbTokenStore
      .connect(controller)
      .burnFrom(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(0);
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(0);
    expect(await jbTokenStore.totalSupplyOf(PROJECT_ID)).to.equal(0);

    await expect(burnFromTx)
      .to.emit(jbTokenStore, 'Burn')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        MAX_TOKENS,
        /* unclaimedBalance= */ 0,
        MAX_TOKENS,
        preferClaimedTokens,
        controller.address,
      );
  });

  it('Should burn claimed tokens, then unclaimed tokens and emit event', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more claimed tokens
    const preferClaimedTokens = true;
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    // Mint more unclaimed tokens
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, /* preferClaimedTokens= */ false);

    // Burn all claimed tokens and then some of the unclaimed tokens. Leave 1 unclaimed token.
    const burnAmt = MAX_TOKENS * BigInt(2) - BigInt(1);
    const burnFromTx = await jbTokenStore
      .connect(controller)
      .burnFrom(newHolder.address, PROJECT_ID, burnAmt, preferClaimedTokens);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(1);
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(1);
    expect(await jbTokenStore.totalSupplyOf(PROJECT_ID)).to.equal(1);

    await expect(burnFromTx)
      .to.emit(jbTokenStore, 'Burn')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        burnAmt,
        MAX_TOKENS,
        MAX_TOKENS,
        preferClaimedTokens,
        controller.address,
      );
  });

  it('Should burn unclaimed tokens only, then claimed tokens and emit event', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more claimed tokens
    const preferClaimedTokens = true;
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    // Mint more unclaimed tokens
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, /* preferClaimedTokens= */ false);

    // Burn all unclaimed tokens and then some of the claimed tokens. Leave 1 claimed token.
    const burnAmt = MAX_TOKENS * BigInt(2) - BigInt(1);
    const burnFromTx = await jbTokenStore
      .connect(controller)
      .burnFrom(newHolder.address, PROJECT_ID, burnAmt, /* preferClaimedTokens= */ false);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(0);
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(1);
    expect(await jbTokenStore.totalSupplyOf(PROJECT_ID)).to.equal(1);

    await expect(burnFromTx)
      .to.emit(jbTokenStore, 'Burn')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        burnAmt,
        MAX_TOKENS,
        MAX_TOKENS,
        /* preferClaimedTokens= */ false,
        controller.address,
      );
  });

  it('Should burn unclaimed tokens only, if there is enough of them to not burn claimed ones, and emit event', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more claimed tokens
    const preferClaimedTokens = true;
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    // Mint more unclaimed tokens
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, /* preferClaimedTokens= */ false);

    // Burn all unclaimed tokens except one.
    const burnAmt = MAX_TOKENS - BigInt(1);
    const burnFromTx = await jbTokenStore
      .connect(controller)
      .burnFrom(newHolder.address, PROJECT_ID, burnAmt, /* preferClaimedTokens= */ false);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(1);
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(
      MAX_TOKENS + BigInt(1),
    );
    expect(await jbTokenStore.totalSupplyOf(PROJECT_ID)).to.equal(MAX_TOKENS + BigInt(1));

    await expect(burnFromTx)
      .to.emit(jbTokenStore, 'Burn')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        burnAmt,
        MAX_TOKENS,
        MAX_TOKENS,
        /* preferClaimedTokens= */ false,
        controller.address,
      );
  });

  it('Should burn only unclaimed tokens and emit event', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more unclaimed tokens
    const preferClaimedTokens = false;
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    // Burn the unclaimed tokens
    const burnFromTx = await jbTokenStore
      .connect(controller)
      .burnFrom(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(0);
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(0);
    expect(await jbTokenStore.totalSupplyOf(PROJECT_ID)).to.equal(0);

    await expect(burnFromTx)
      .to.emit(jbTokenStore, 'Burn')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        MAX_TOKENS,
        MAX_TOKENS,
        0,
        preferClaimedTokens,
        controller.address,
      );
  });

  /* Sad path testing */

  it(`Can't burn tokens if caller doesn't have permission`, async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    // Return a random controller address.
    await mockJbDirectory.mock.controllerOf
      .withArgs(PROJECT_ID)
      .returns(ethers.Wallet.createRandom().address);

    await expect(
      jbTokenStore
        .connect(controller)
        .burnFrom(newHolder.address, PROJECT_ID, /* amount= */ 1, /* preferClaimedTokens= */ true),
    ).to.be.revertedWith(errors.CONTROLLER_UNAUTHORIZED);
  });

  it(`Can't burn more tokens than the available balance`, async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more claimed tokens
    const preferClaimedTokens = true;
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, preferClaimedTokens);

    // Mint more unclaimed tokens
    await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, MAX_TOKENS, /* preferClaimedTokens= */ false);

    // Burn more than the available balance
    const burnAmt = MAX_TOKENS * BigInt(2) + BigInt(1);

    await expect(
      jbTokenStore
        .connect(controller)
        .burnFrom(newHolder.address, PROJECT_ID, burnAmt, preferClaimedTokens),
    ).to.be.revertedWith(errors.INSUFFICIENT_FUNDS);
  });

  it(`Can't burn any tokens if none have been issued or allocated'`, async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    const numTokens = 1;
    const preferClaimedTokens = true;

    await expect(
      jbTokenStore
        .connect(controller)
        .burnFrom(newHolder.address, PROJECT_ID, numTokens, preferClaimedTokens),
    ).to.be.revertedWith(errors.INSUFFICIENT_FUNDS);
  });
});
