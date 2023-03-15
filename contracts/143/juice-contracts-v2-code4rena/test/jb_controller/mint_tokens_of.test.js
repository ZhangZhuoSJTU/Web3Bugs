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
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';
import jbToken from '../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbTokenStore from '../../artifacts/contracts/JBTokenStore.sol/JBTokenStore.json';

describe('JBController::mintTokensOf(...)', function () {
  const PROJECT_ID = 1;
  const MEMO = 'Test Memo';
  const AMOUNT_TO_MINT = 20000;
  const RESERVED_RATE = 5000; // 50%
  const AMOUNT_TO_RECEIVE = AMOUNT_TO_MINT - (AMOUNT_TO_MINT * RESERVED_RATE) / 10000;

  let MINT_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    MINT_INDEX = await jbOperations.MINT();
  });

  async function setup() {
    let [deployer, projectOwner, beneficiary, mockDatasource, ...addrs] = await ethers.getSigners();

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

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, projectOwner.address)
      .returns(false);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowMinting: 1, reservedRate: RESERVED_RATE }),
    });

    await mockJbTokenStore.mock.mintFor
      .withArgs(beneficiary.address, PROJECT_ID, AMOUNT_TO_RECEIVE, /*_preferClaimedTokens=*/ true)
      .returns();

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT_TO_RECEIVE);

    return {
      projectOwner,
      beneficiary,
      mockDatasource,
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

  it(`Should mint token if caller is project owner and funding cycle not paused`, async function () {
    const { projectOwner, beneficiary, jbController } = await setup();

    await expect(
      jbController
        .connect(projectOwner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_RECEIVE,
        MEMO,
        RESERVED_RATE,
        projectOwner.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );
    expect(newReservedTokenBalance).to.equal(AMOUNT_TO_MINT - AMOUNT_TO_RECEIVE);
  });

  it(`Should mint token if caller is not project owner but is authorized`, async function () {
    const { projectOwner, beneficiary, addrs, jbController, mockJbOperatorStore, mockJbDirectory } =
      await setup();
    let caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, MINT_INDEX)
      .returns(true);

    await mockJbDirectory.mock.isTerminalOf.withArgs(PROJECT_ID, caller.address).returns(false);

    await expect(
      jbController
        .connect(caller)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_RECEIVE,
        MEMO,
        RESERVED_RATE,
        caller.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );
    expect(newReservedTokenBalance).to.equal(AMOUNT_TO_MINT - AMOUNT_TO_RECEIVE);
  });

  it(`Should mint token if caller is a terminal of the corresponding project`, async function () {
    const { projectOwner, beneficiary, jbController, mockJbOperatorStore, mockJbDirectory } =
      await setup();
    const terminal = await deployMockContract(projectOwner, jbTerminal.abi);
    const terminalSigner = await impersonateAccount(terminal.address);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, PROJECT_ID, MINT_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, 0, MINT_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, terminalSigner.address)
      .returns(true);

    await expect(
      jbController
        .connect(terminalSigner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_RECEIVE,
        MEMO,
        RESERVED_RATE,
        terminalSigner.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );
    expect(newReservedTokenBalance).to.equal(AMOUNT_TO_MINT - AMOUNT_TO_RECEIVE);
  });

  it(`Should mint token if caller is the current funding cycle's datasource of the corresponding project`, async function () {
    const {
      projectOwner,
      beneficiary,
      mockDatasource,
      jbController,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      mockJbDirectory,
      timestamp,
    } = await setup();
    const terminal = await deployMockContract(projectOwner, jbTerminal.abi);
    const terminalSigner = await impersonateAccount(terminal.address);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, PROJECT_ID, MINT_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, 0, MINT_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, mockDatasource.address)
      .returns(false);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({
        allowMinting: 1,
        reservedRate: RESERVED_RATE,
        dataSource: mockDatasource.address,
      }),
    });

    await expect(
      jbController
        .connect(mockDatasource)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_RECEIVE,
        MEMO,
        RESERVED_RATE,
        mockDatasource.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );
    expect(newReservedTokenBalance).to.equal(AMOUNT_TO_MINT - AMOUNT_TO_RECEIVE);
  });

  it(`Can't mint token if caller is not authorized`, async function () {
    const { projectOwner, beneficiary, addrs, jbController, mockJbOperatorStore, mockJbDirectory } =
      await setup();
    let caller = addrs[0];

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, MINT_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, MINT_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf.withArgs(PROJECT_ID, caller.address).returns(false);

    await expect(
      jbController
        .connect(caller)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });

  it(`Can't mint 0 token`, async function () {
    const { projectOwner, beneficiary, jbController } = await setup();

    await expect(
      jbController
        .connect(projectOwner)
        .mintTokensOf(
          PROJECT_ID,
          0,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    ).to.be.revertedWith(errors.ZERO_TOKENS_TO_MINT);
  });

  it(`Can't mint token if funding cycle is paused and caller is not a terminal delegate or a datasource`, async function () {
    const { projectOwner, beneficiary, jbController, mockJbFundingCycleStore, timestamp } =
      await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowMinting: 0, reservedRate: RESERVED_RATE }),
    });

    await expect(
      jbController
        .connect(projectOwner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    ).to.be.revertedWith(errors.MINT_NOT_ALLOWED_AND_NOT_TERMINAL_DELEGATE);
  });

  it(`Should mint token if funding cycle is paused and caller is a terminal delegate`, async function () {
    const {
      projectOwner,
      beneficiary,
      jbController,
      mockJbFundingCycleStore,
      mockJbOperatorStore,
      mockJbDirectory,
      timestamp,
    } = await setup();
    const terminal = await deployMockContract(projectOwner, jbTerminal.abi);
    const terminalSigner = await impersonateAccount(terminal.address);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, PROJECT_ID, MINT_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(terminalSigner.address, projectOwner.address, 0, MINT_INDEX)
      .returns(false);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, terminalSigner.address)
      .returns(true);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowMinting: 0, reservedRate: RESERVED_RATE }),
    });

    await expect(
      jbController
        .connect(terminalSigner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_RECEIVE,
        MEMO,
        RESERVED_RATE,
        terminalSigner.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );
    expect(newReservedTokenBalance).to.equal(AMOUNT_TO_MINT - AMOUNT_TO_RECEIVE);
  });

  it(`Should add the minted amount to the reserved tokens if reserved rate is 100%`, async function () {
    const {
      projectOwner,
      beneficiary,
      jbController,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      timestamp,
    } = await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      // mock JBFundingCycle obj
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ reservedRate: 10000, allowMinting: 1 }),
    });

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(0);

    let previousReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      /*reservedRate=*/ 10000,
    );

    await expect(
      jbController
        .connect(projectOwner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        0,
        MEMO,
        10000,
        projectOwner.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(PROJECT_ID, 10000);

    expect(newReservedTokenBalance).to.equal(previousReservedTokenBalance.add(AMOUNT_TO_MINT));
  });

  it('Should not use a reserved rate even if one is specified if the `_useReservedRate` arg is false', async function () {
    const { projectOwner, beneficiary, jbController, mockJbTokenStore } = await setup();

    await mockJbTokenStore.mock.mintFor
      .withArgs(beneficiary.address, PROJECT_ID, AMOUNT_TO_MINT, /*_preferClaimedTokens=*/ true)
      .returns();

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(0);

    let previousReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );

    await expect(
      jbController
        .connect(projectOwner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ false,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_MINT,
        MEMO,
        0,
        projectOwner.address,
      );

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT_TO_MINT);

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      RESERVED_RATE,
    );

    expect(newReservedTokenBalance).to.equal(previousReservedTokenBalance);
  });

  it(`Should not change the reserved tokens amount if reserved rate is 0%`, async function () {
    const {
      projectOwner,
      beneficiary,
      jbController,
      mockJbFundingCycleStore,
      mockJbTokenStore,
      timestamp,
    } = await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ reservedRate: 0, allowMinting: 1 }),
    });

    await mockJbTokenStore.mock.totalSupplyOf.withArgs(PROJECT_ID).returns(AMOUNT_TO_MINT); // to mint == to receive <=> reserve rate = 0

    await mockJbTokenStore.mock.mintFor
      .withArgs(beneficiary.address, PROJECT_ID, AMOUNT_TO_MINT, true)
      .returns(); // to mint == to receive (reserve rate = 0)

    let previousReservedTokenBalance = await jbController.reservedTokenBalanceOf(
      PROJECT_ID,
      /*reservedRate=*/ 0,
    );

    await expect(
      jbController
        .connect(projectOwner)
        .mintTokensOf(
          PROJECT_ID,
          AMOUNT_TO_MINT,
          beneficiary.address,
          MEMO,
          /*_preferClaimedTokens=*/ true,
          /* _useReservedRate=*/ true,
        ),
    )
      .to.emit(jbController, 'MintTokens')
      .withArgs(
        beneficiary.address,
        PROJECT_ID,
        AMOUNT_TO_MINT,
        AMOUNT_TO_MINT,
        MEMO,
        0,
        projectOwner.address,
      );

    let newReservedTokenBalance = await jbController.reservedTokenBalanceOf(PROJECT_ID, 0);

    expect(newReservedTokenBalance).to.equal(previousReservedTokenBalance);
  });
});
