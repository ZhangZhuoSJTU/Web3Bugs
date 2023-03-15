import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { packFundingCycleMetadata } from '../../helpers/utils.js';
import errors from '../../helpers/errors.json';
import jbDirectory from '../../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbController from '../../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbOperatoreStore from '../../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbToken from '../../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbPrices from '../../../artifacts/contracts/JBPrices.sol/JBPrices.json';
import jbPayDelegate from '../../../artifacts/contracts/interfaces/IJBPayDelegate.sol/IJBPayDelegate.json';

describe('JBPayoutRedemptionPaymentTerminal::pay(...)', function () {
  const PROJECT_ID = 1;
  const MEMO = 'Memo Test';
  const ADJUSTED_MEMO = 'test test memo';
  const METADATA = '0x69';
  const FUNDING_CYCLE_NUMBER = 1;
  const ADJUSTED_WEIGHT = 10;
  const MIN_TOKEN_REQUESTED = 90;
  const TOKEN_TO_MINT = 200;
  const TOKEN_RECEIVED = 100;
  const ETH_TO_PAY = ethers.utils.parseEther('1');
  const PREFER_CLAIMED_TOKENS = true;
  const CURRENCY_ETH = 1;
  const DECIMALS = 1;

  let ethToken;

  async function setup() {
    let [deployer, terminalOwner, caller, beneficiary, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;
    const SPLITS_GROUP = 1;

    let [
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPayDelegate,
      mockJbPrices,
      mockJbController,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPayDelegate.abi),
      deployMockContract(deployer, jbPrices.abi),
      deployMockContract(deployer, jbController.abi),
    ]);

    const mockJbToken = await deployMockContract(deployer, jbToken.abi);
    const NON_ETH_TOKEN = mockJbToken.address;

    let jbEthTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );
    let jbErc20TerminalFactory = await ethers.getContractFactory(
      'contracts/JBERC20PaymentTerminal.sol:JBERC20PaymentTerminal',
      deployer,
    );

    let jbEthPaymentTerminal = await jbEthTerminalFactory
      .connect(deployer)
      .deploy(
        CURRENCY_ETH,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    ethToken = await jbEthPaymentTerminal.token();

    await mockJbToken.mock.decimals.returns(DECIMALS);

    let JBERC20PaymentTerminal = await jbErc20TerminalFactory
      .connect(deployer)
      .deploy(
        NON_ETH_TOKEN,
        CURRENCY_ETH,
        CURRENCY_ETH,
        SPLITS_GROUP,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, jbEthPaymentTerminal.address)
      .returns(true);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, JBERC20PaymentTerminal.address)
      .returns(true);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        caller.address,
        [
          /*token*/ '0x000000000000000000000000000000000000eeee',
          /*amount paid*/ ETH_TO_PAY,
          /*decimal*/ 18,
          CURRENCY_ETH,
        ],
        PROJECT_ID,
        CURRENCY_ETH,
        beneficiary.address,
        MEMO,
        METADATA,
      )
      .returns(
        {
          // mock JBFundingCycle obj
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata(),
        },
        TOKEN_TO_MINT,
        ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      );

    return {
      terminalOwner,
      caller,
      beneficiary,
      addrs,
      jbEthPaymentTerminal,
      JBERC20PaymentTerminal,
      mockJbToken,
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbPayDelegate,
      mockJbController,
      timestamp,
    };
  }

  it('Should record payment and emit event', async function () {
    const {
      caller,
      jbEthPaymentTerminal,
      mockJbDirectory,
      mockJbController,
      timestamp,
      beneficiary,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbController.mock.mintTokensOf
      .withArgs(
        PROJECT_ID,
        TOKEN_TO_MINT,
        beneficiary.address,
        '',
        PREFER_CLAIMED_TOKENS,
        /* useReservedRate */ true,
      )
      .returns(TOKEN_RECEIVED);

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .pay(
          PROJECT_ID,
          ETH_TO_PAY,
          ethers.constants.AddressZero,
          beneficiary.address,
          MIN_TOKEN_REQUESTED,
          PREFER_CLAIMED_TOKENS,
          MEMO,
          METADATA,
          { value: ETH_TO_PAY },
        ),
    )
      .to.emit(jbEthPaymentTerminal, 'Pay')
      .withArgs(
        /*fundingCycle.configuration=*/ timestamp,
        FUNDING_CYCLE_NUMBER,
        PROJECT_ID,
        caller.address,
        beneficiary.address,
        ETH_TO_PAY,
        TOKEN_RECEIVED,
        ADJUSTED_MEMO,
        METADATA,
        caller.address,
      );
  });

  it('Should record payment with delegate and emit delegate event', async function () {
    const {
      caller,
      jbEthPaymentTerminal,
      mockJbPayDelegate,
      mockJBPaymentTerminalStore,
      mockJbDirectory,
      mockJbController,
      timestamp,
      beneficiary,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbController.mock.mintTokensOf
      .withArgs(
        PROJECT_ID,
        TOKEN_TO_MINT,
        /* beneficiary */ beneficiary.address,
        '',
        PREFER_CLAIMED_TOKENS,
        /* useReservedRate */ true,
      )
      .returns(TOKEN_RECEIVED);

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        caller.address,
        [
          /*token*/ '0x000000000000000000000000000000000000eeee',
          /*amount paid*/ ETH_TO_PAY,
          /*decimal*/ 18,
          CURRENCY_ETH,
        ],
        PROJECT_ID,
        CURRENCY_ETH,
        beneficiary.address,
        MEMO,
        METADATA,
      )
      .returns(
        {
          // mock JBFundingCycle obj
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata(),
        },
        TOKEN_TO_MINT,
        mockJbPayDelegate.address,
        ADJUSTED_MEMO,
      );

    await mockJbPayDelegate.mock.didPay
      .withArgs({
        // JBDidPayData obj
        payer: caller.address,
        projectId: PROJECT_ID,
        currentFundingCycleConfiguration: timestamp,
        amount: {
          token: '0x000000000000000000000000000000000000eeee',
          value: ETH_TO_PAY,
          decimals: 18,
          currency: CURRENCY_ETH,
        },
        projectTokenCount: TOKEN_RECEIVED,
        beneficiary: beneficiary.address,
        preferClaimedTokens: PREFER_CLAIMED_TOKENS,
        memo: ADJUSTED_MEMO,
        metadata: METADATA,
      })
      .returns();

    const tx = await jbEthPaymentTerminal
      .connect(caller)
      .pay(
        PROJECT_ID,
        ETH_TO_PAY,
        ethers.constants.AddressZero,
        beneficiary.address,
        MIN_TOKEN_REQUESTED,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        { value: ETH_TO_PAY },
      );

    await expect(tx).to.emit(jbEthPaymentTerminal, 'DelegateDidPay');
    // AssertionError: expected [ Array(4) ] to equal [ Array(4) ]

    // .withArgs(
    //   mockJbPayDelegate.address,
    //   [
    //     // JBDidPayData obj
    //     caller.address,
    //     PROJECT_ID,
    //     [
    //       "0x000000000000000000000000000000000000EEEe",
    //       ETH_TO_PAY,
    //       ethers.BigNumber.from(18),
    //       ethers.BigNumber.from(CURRENCY_ETH)
    //     ],
    //     TOKEN_RECEIVED,
    //     beneficiary.address,
    //     ADJUSTED_MEMO,
    //     METADATA,
    //   ],
    //   caller.address,
    // );

    await expect(tx)
      .to.emit(jbEthPaymentTerminal, 'Pay')
      .withArgs(
        /*fundingCycle.configuration=*/ timestamp,
        FUNDING_CYCLE_NUMBER,
        PROJECT_ID,
        caller.address,
        beneficiary.address,
        ETH_TO_PAY,
        TOKEN_RECEIVED,
        ADJUSTED_MEMO,
        METADATA,
        caller.address,
      );
  });

  it('Should work with eth terminal with non msg.value amount sent', async function () {
    const { caller, jbEthPaymentTerminal, mockJbDirectory, mockJbController, beneficiary } =
      await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbController.mock.mintTokensOf
      .withArgs(
        PROJECT_ID,
        TOKEN_TO_MINT,
        /* beneficiary */ beneficiary.address,
        '',
        PREFER_CLAIMED_TOKENS,
        /* useReservedRate */ true,
      )
      .returns(TOKEN_RECEIVED);

    await jbEthPaymentTerminal
      .connect(caller)
      .pay(
        PROJECT_ID,
        ETH_TO_PAY + 1,
        ethers.constants.AddressZero,
        beneficiary.address,
        MIN_TOKEN_REQUESTED,
        /*preferClaimedToken=*/ true,
        MEMO,
        METADATA,
        { value: ETH_TO_PAY },
      );
  });
  it('Should work with no token amount returned from recording payment', async function () {
    const { caller, jbEthPaymentTerminal, mockJBPaymentTerminalStore, beneficiary, timestamp } =
      await setup();

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        caller.address,
        [
          /*token*/ '0x000000000000000000000000000000000000eeee',
          /*amount paid*/ ETH_TO_PAY,
          /*decimal*/ 18,
          CURRENCY_ETH,
        ],
        PROJECT_ID,
        CURRENCY_ETH,
        beneficiary.address,
        MEMO,
        METADATA,
      )
      .returns(
        {
          // mock JBFundingCycle obj
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata(),
        },
        0,
        ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      );

    await jbEthPaymentTerminal
      .connect(caller)
      .pay(
        PROJECT_ID,
        ETH_TO_PAY + 1,
        ethers.constants.AddressZero,
        beneficiary.address,
        0,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        { value: ETH_TO_PAY },
      );
  });

  it('Should work with non-eth terminal if no value is sent', async function () {
    const {
      caller,
      JBERC20PaymentTerminal,
      mockJbToken,
      mockJbDirectory,
      mockJbController,
      mockJBPaymentTerminalStore,
      beneficiary,
      timestamp,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);

    await mockJbController.mock.mintTokensOf
      .withArgs(
        PROJECT_ID,
        TOKEN_TO_MINT,
        beneficiary.address,
        '',
        PREFER_CLAIMED_TOKENS,
        /* useReservedRate */ true,
      )
      .returns(TOKEN_RECEIVED);

    await mockJbToken.mock.transferFrom
      .withArgs(caller.address, JBERC20PaymentTerminal.address, ETH_TO_PAY)
      .returns(0);

    let tokenAddress = await JBERC20PaymentTerminal.token();
    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        caller.address,
        [/*token*/ tokenAddress, /*amount paid*/ ETH_TO_PAY, /*decimal*/ DECIMALS, CURRENCY_ETH],
        PROJECT_ID,
        CURRENCY_ETH,
        beneficiary.address,
        MEMO,
        METADATA,
      )
      .returns(
        {
          // mock JBFundingCycle obj
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata(),
        },
        TOKEN_TO_MINT,
        ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      );

    await JBERC20PaymentTerminal.connect(caller).pay(
      PROJECT_ID,
      ETH_TO_PAY,
      ethers.constants.AddressZero,
      beneficiary.address,
      MIN_TOKEN_REQUESTED,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      { value: 0 },
    );
  });

  it("Can't pay with value if terminal token isn't ETH", async function () {
    const { caller, JBERC20PaymentTerminal } = await setup();

    await expect(
      JBERC20PaymentTerminal.connect(caller).pay(
        PROJECT_ID,
        ETH_TO_PAY,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        { value: ETH_TO_PAY },
      ),
    ).to.be.revertedWith(errors.NO_MSG_VALUE_ALLOWED);
  });

  it("Can't send tokens to the zero address", async function () {
    const { caller, jbEthPaymentTerminal } = await setup();

    await expect(
      jbEthPaymentTerminal
        .connect(caller)
        .pay(
          PROJECT_ID,
          ETH_TO_PAY,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          MIN_TOKEN_REQUESTED,
          PREFER_CLAIMED_TOKENS,
          MEMO,
          METADATA,
          { value: ETH_TO_PAY },
        ),
    ).to.be.revertedWith(errors.PAY_TO_ZERO_ADDRESS);
  });

  it("Can't pay if current terminal doesn't belong to project", async function () {
    const { caller, jbEthPaymentTerminal, mockJbDirectory } = await setup();

    const otherProjectId = 18;
    await mockJbDirectory.mock.isTerminalOf
      .withArgs(otherProjectId, jbEthPaymentTerminal.address)
      .returns(false);

    await expect(
      jbEthPaymentTerminal
        .connect(caller)
        .pay(
          otherProjectId,
          ETH_TO_PAY,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          MIN_TOKEN_REQUESTED,
          PREFER_CLAIMED_TOKENS,
          MEMO,
          METADATA,
          { value: ETH_TO_PAY },
        ),
    ).to.be.revertedWith(errors.PROJECT_TERMINAL_MISMATCH);
  });
  it("Can't pay if minted tokens for beneficiary is less than expected", async function () {
    const { caller, jbEthPaymentTerminal, mockJBPaymentTerminalStore, beneficiary, timestamp } =
      await setup();

    await mockJBPaymentTerminalStore.mock.recordPaymentFrom
      .withArgs(
        caller.address,
        [
          /*token*/ '0x000000000000000000000000000000000000eeee',
          /*amount paid*/ ETH_TO_PAY,
          /*decimal*/ 18,
          CURRENCY_ETH,
        ],
        PROJECT_ID,
        CURRENCY_ETH,
        beneficiary.address,
        MEMO,
        METADATA,
      )
      .returns(
        {
          // mock JBFundingCycle obj
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata(),
        },
        0,
        ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      );

    await expect(
      jbEthPaymentTerminal
        .connect(caller)
        .pay(
          PROJECT_ID,
          ETH_TO_PAY + 1,
          ethers.constants.AddressZero,
          beneficiary.address,
          MIN_TOKEN_REQUESTED,
          PREFER_CLAIMED_TOKENS,
          MEMO,
          METADATA,
          { value: ETH_TO_PAY },
        ),
    ).to.be.revertedWith(errors.INADEQUATE_TOKEN_COUNT);
  });
});
