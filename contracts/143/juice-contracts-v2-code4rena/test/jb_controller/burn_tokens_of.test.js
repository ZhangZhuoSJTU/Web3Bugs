import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { impersonateAccount, packFundingCycleMetadata } from '../helpers/utils';
import errors from '../helpers/errors.json';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbTerminal from '../../artifacts/contracts/JBETHPaymentTerminal.sol/JBETHPaymentTerminal.json';
import jbToken from '../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::burnTokenOf(...)', function () {
  const PROJECT_ID = 1;
  const MEMO = 'Test Memo';
  const TOTAL_SUPPLY = 100000;
  const RESERVED_RATE = 5000;
  const EFFECTIVE_SUPPLY = (TOTAL_SUPPLY * (10000 - RESERVED_RATE)) / 10000;
  const AMOUNT_TO_BURN = 20000;
  const PREFERED_CLAIMED_TOKEN = true;
  let BURN_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    BURN_INDEX = await jbOperations.BURN();
  });

  async function setup() {
    let [deployer, projectOwner, holder, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    let [
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbToken,
      mockJbTokenStore,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbFundingCycleStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbToken.abi),
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

    await Promise.all([
      mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address),

      mockJbDirectory.mock.isTerminalOf.withArgs(PROJECT_ID, holder.address).returns(false),

      mockJbDirectory.mock.isTerminalOf.withArgs(PROJECT_ID, projectOwner.address).returns(false),

      mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
        number: 1,
        configuration: timestamp,
        basedOn: timestamp,
        start: timestamp,
        duration: 0,
        weight: 0,
        discountRate: 0,
        ballot: ethers.constants.AddressZero,
        metadata: packFundingCycleMetadata({
          pauseBurn: 0,
          allowMinting: 1,
          reservedRate: RESERVED_RATE,
        }),
      }),

      // only non-reserved are minted, minting total supply in holder account
      mockJbTokenStore.mock.mintFor
        .withArgs(holder.address, PROJECT_ID, EFFECTIVE_SUPPLY, PREFERED_CLAIMED_TOKEN)
        .returns(),

      mockJbTokenStore.mock.burnFrom
        .withArgs(holder.address, PROJECT_ID, AMOUNT_TO_BURN, PREFERED_CLAIMED_TOKEN)
        .returns(),

      mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(EFFECTIVE_SUPPLY),
    ]);

    await jbController
      .connect(projectOwner)
      .mintTokensOf(
        PROJECT_ID,
        TOTAL_SUPPLY,
        holder.address,
        MEMO,
        PREFERED_CLAIMED_TOKEN,
        true /*use fc reserved rate*/,
      );

    return {
      projectOwner,
      holder,
      addrs,
      jbController,
      mockJbOperatorStore,
      mockJbDirectory,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      mockJbToken,
      timestamp,
    };
  }

  it(`Should burn if caller is token owner and update reserved token balance of the project`, async function () {
    const { holder, jbController, mockJbTokenStore } = await setup();
    let initReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );

    await expect(
      jbController
        .connect(holder)
        .burnTokensOf(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, PREFERED_CLAIMED_TOKEN),
    )
      .to.emit(jbController, 'BurnTokens')
      .withArgs(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, holder.address);

    // New total supply = previous total supply minus amount burned
    await mockJbTokenStore.mock.totalSupplyOf
      .withArgs(PROJECT_ID)
      .returns(EFFECTIVE_SUPPLY - AMOUNT_TO_BURN);

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );
    expect(newReservedTokenBalance).to.equal(initReservedTokenBalance);
  });

  it(`Should burn token if caller is not project owner but is authorized`, async function () {
    const { holder, addrs, jbController, mockJbOperatorStore, mockJbDirectory } = await setup();
    let caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, holder.address, PROJECT_ID, BURN_INDEX)
      .returns(true);

    await mockJbDirectory.mock.isTerminalOf.withArgs(PROJECT_ID, caller.address).returns(false);

    await expect(
      jbController
        .connect(caller)
        .burnTokensOf(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, PREFERED_CLAIMED_TOKEN),
    )
      .to.emit(jbController, 'BurnTokens')
      .withArgs(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, caller.address);
  });

  it(`Can't burn token if caller is not authorized`, async function () {
    const { holder, addrs, jbController, mockJbOperatorStore, mockJbDirectory } = await setup();
    let caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, holder.address, PROJECT_ID, BURN_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, holder.address, 0, BURN_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf.withArgs(PROJECT_ID, caller.address).returns(false);

    await expect(
      jbController
        .connect(caller)
        .burnTokensOf(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, PREFERED_CLAIMED_TOKEN),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });

  it(`Should burn token if caller is a terminal of the corresponding project`, async function () {
    const { projectOwner, holder, jbController, mockJbOperatorStore, mockJbDirectory } =
      await setup();
    const terminal = await deployMockContract(projectOwner, jbTerminal.abi);
    const terminalSigner = await impersonateAccount(terminal.address);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, PROJECT_ID, BURN_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, 0, BURN_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, terminalSigner.address)
      .returns(true);

    await expect(
      jbController
        .connect(terminalSigner)
        .burnTokensOf(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, PREFERED_CLAIMED_TOKEN),
    )
      .to.emit(jbController, 'BurnTokens')
      .withArgs(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, terminalSigner.address);
  });

  it(`Can't burn 0 token`, async function () {
    const { holder, jbController } = await setup();

    await expect(
      jbController
        .connect(holder)
        .burnTokensOf(holder.address, PROJECT_ID, /*_tokenCount=*/ 0, MEMO, PREFERED_CLAIMED_TOKEN),
    ).to.be.revertedWith(errors.NO_BURNABLE_TOKENS);
  });

  it(`Can't burn token if funding cycle is paused and caller is not a terminal delegate`, async function () {
    const { holder, jbController, mockJbFundingCycleStore, timestamp } = await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ pauseBurn: 1, reservedRate: RESERVED_RATE }),
    });

    await expect(
      jbController
        .connect(holder)
        .burnTokensOf(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, PREFERED_CLAIMED_TOKEN),
    ).to.be.revertedWith(errors.BURN_PAUSED_AND_SENDER_NOT_VALID_TERMINAL_DELEGATE);
  });

  it(`Should burn token if funding cycle is paused and caller is a terminal delegate`, async function () {
    const {
      projectOwner,
      holder,
      jbController,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      mockJbDirectory,
      timestamp,
    } = await setup();

    const terminal = await deployMockContract(projectOwner, jbTerminal.abi);
    const terminalSigner = await impersonateAccount(terminal.address);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, PROJECT_ID, BURN_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, 0, BURN_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, terminalSigner.address)
      .returns(true);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ pauseBurn: 1, reservedRate: RESERVED_RATE }),
    });

    await expect(
      jbController
        .connect(terminalSigner)
        .burnTokensOf(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, PREFERED_CLAIMED_TOKEN),
    )
      .to.emit(jbController, 'BurnTokens')
      .withArgs(holder.address, PROJECT_ID, AMOUNT_TO_BURN, MEMO, terminalSigner.address);
  });
});
