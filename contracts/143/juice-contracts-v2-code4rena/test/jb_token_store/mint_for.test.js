import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import errors from '../helpers/errors.json';

describe('JBTokenStore::mintFor(...)', function () {
  const PROJECT_ID = 2;
  const TOKEN_NAME = 'TestTokenDAO';
  const TOKEN_SYMBOL = 'TEST';

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

  it('Should mint claimed tokens and emit event if caller is controller', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more claimed tokens
    const numTokens = 20;
    const mintForTx = await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, numTokens, /* preferClaimedTokens= */ true);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(0);
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(numTokens);

    await expect(mintForTx)
      .to.emit(jbTokenStore, 'Mint')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        numTokens,
        /* shouldClaimTokens= */ true,
        /* preferClaimedTokens= */ true,
        controller.address,
      );
  });

  it('Should mint unclaimed tokens and emit event if caller is controller', async function () {
    const { controller, newHolder, mockJbDirectory, jbTokenStore } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(controller.address);

    await jbTokenStore.connect(controller).issueFor(PROJECT_ID, TOKEN_NAME, TOKEN_SYMBOL);

    // Mint more unclaimed tokens
    const numTokens = 20;
    const mintForTx = await jbTokenStore
      .connect(controller)
      .mintFor(newHolder.address, PROJECT_ID, numTokens, /* preferClaimedTokens= */ false);

    expect(await jbTokenStore.unclaimedBalanceOf(newHolder.address, PROJECT_ID)).to.equal(
      numTokens,
    );
    expect(await jbTokenStore.balanceOf(newHolder.address, PROJECT_ID)).to.equal(numTokens);

    await expect(mintForTx)
      .to.emit(jbTokenStore, 'Mint')
      .withArgs(
        newHolder.address,
        PROJECT_ID,
        numTokens,
        /* shouldClaimTokens= */ false,
        /* preferClaimedTokens= */ false,
        controller.address,
      );
  });

  it(`Can't mint tokens if caller does not have permission`, async function () {
    const { newHolder, mockJbDirectory, jbTokenStore } = await setup();

    // Return a random controller address.
    await mockJbDirectory.mock.controllerOf
      .withArgs(PROJECT_ID)
      .returns(ethers.Wallet.createRandom().address);

    await expect(
      jbTokenStore.mintFor(
        newHolder.address,
        PROJECT_ID,
        /* amount= */ 1,
        /* preferClaimedTokens= */ true,
      ),
    ).to.be.revertedWith(errors.CONTROLLER_UNAUTHORIZED);
  });
});
