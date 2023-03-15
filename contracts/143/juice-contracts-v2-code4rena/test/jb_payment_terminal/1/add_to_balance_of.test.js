import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { makeSplits, packFundingCycleMetadata, setBalance } from '../../helpers/utils.js';

import errors from '../../helpers/errors.json';

import jbDirectory from '../../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import JBEthPaymentTerminal from '../../../artifacts/contracts/JBETHPaymentTerminal.sol/JBETHPaymentTerminal.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbOperatoreStore from '../../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbToken from '../../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbPrices from '../../../artifacts/contracts/JBPrices.sol/JBPrices.json';

describe('JBPayoutRedemptionPaymentTerminal::addToBalanceOf(...)', function () {
  const PROTOCOL_PROJECT_ID = 1;
  const PROJECT_ID = 2;
  const AMOUNT = ethers.utils.parseEther('10');
  const MIN_TOKEN_REQUESTED = 0;
  const MEMO = 'Memo Test';
  const METADATA = '0x69';
  const ETH_ADDRESS = '0x000000000000000000000000000000000000EEEe';

  let CURRENCY_ETH;
  let ETH_PAYOUT_INDEX;
  let MAX_FEE;
  let MAX_FEE_DISCOUNT;

  before(async function () {
    let jbSplitsGroupsFactory = await ethers.getContractFactory('JBSplitsGroups');
    let jbSplitsGroups = await jbSplitsGroupsFactory.deploy();

    ETH_PAYOUT_INDEX = await jbSplitsGroups.ETH_PAYOUT();

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    CURRENCY_ETH = await jbCurrencies.ETH();

    const jbConstantsFactory = await ethers.getContractFactory('JBConstants');
    const jbConstants = await jbConstantsFactory.deploy();
    MAX_FEE = await jbConstants.MAX_FEE();
    MAX_FEE_DISCOUNT = await jbConstants.MAX_FEE_DISCOUNT();
  });

  async function setup() {
    let [deployer, projectOwner, terminalOwner, caller, beneficiaryOne, beneficiaryTwo, ...addrs] =
      await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const SPLITS_GROUP = 1;

    let [
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
      mockJbToken,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, JBEthPaymentTerminal.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPrices.abi),
      deployMockContract(deployer, jbToken.abi),
    ]);

    let jbTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );
    let jbErc20TerminalFactory = await ethers.getContractFactory(
      'contracts/JBERC20PaymentTerminal.sol:JBERC20PaymentTerminal',
      deployer,
    );
    const NON_ETH_TOKEN = mockJbToken.address;

    let jbEthPaymentTerminal = await jbTerminalFactory
      .connect(deployer)
      .deploy(
        /*base weight currency*/ CURRENCY_ETH,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    const DECIMALS = 1;

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

    let fundingCycle = {
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ holdFees: 1 }),
    };

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, jbEthPaymentTerminal.address)
      .returns(true);

    await mockJbDirectory.mock.isTerminalOf
      .withArgs(PROJECT_ID, JBERC20PaymentTerminal.address)
      .returns(true);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(PROTOCOL_PROJECT_ID, ETH_ADDRESS)
      .returns(jbEthPaymentTerminal.address);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(PROTOCOL_PROJECT_ID, NON_ETH_TOKEN)
      .returns(JBERC20PaymentTerminal.address);

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT, CURRENCY_ETH)
      .returns(
        {
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata({ holdFees: 1 }),
        },
        AMOUNT,
      );

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT)
      .returns();

    await ethers.provider.send('hardhat_setBalance', [
      jbEthPaymentTerminal.address,
      '0x100000000000000000000',
    ]);

    return {
      deployer,
      projectOwner,
      terminalOwner,
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      addrs,
      jbEthPaymentTerminal,
      JBERC20PaymentTerminal,
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbToken,
      mockJbOperatorStore,
      mockJbSplitsStore,
      timestamp,
      fundingCycle,
    };
  }

  it('Should add to the project balance, refund any held fee and remove them if the transferred amount is enough, and emit event', async function () {
    const {
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    let heldFee = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    let discountedFee = ethers.BigNumber.from(heldFee[0].fee).sub(
      ethers.BigNumber.from(heldFee[0].fee)
        .mul(ethers.BigNumber.from(heldFee[0].feeDiscount))
        .div(MAX_FEE_DISCOUNT),
    );

    let feeNetAmount = ethers.BigNumber.from(heldFee[0].amount).sub(
      ethers.BigNumber.from(heldFee[0].amount).mul(MAX_FEE).div(discountedFee.add(MAX_FEE)),
    );
    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT.add(feeNetAmount))
      .returns();

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(PROJECT_ID, AMOUNT, ETH_ADDRESS, MEMO, METADATA, { value: AMOUNT }),
    )
      .to.emit(jbEthPaymentTerminal, 'AddToBalance')
      .withArgs(PROJECT_ID, AMOUNT, feeNetAmount, MEMO, METADATA, caller.address)
      .and.to.emit(jbEthPaymentTerminal, 'RefundHeldFees')
      // add to balance: AMOUNT -> refund feeNetAmount (given AMOUNT > feeNetAmount) and left over is 0
      .withArgs(PROJECT_ID, AMOUNT, feeNetAmount, 0 /*leftOver*/, caller.address);

    expect(await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID)).to.eql([]);
  });
  it('Should add to the project balance and not refund held fee if the sender is set as feeless, and emit event', async function () {
    const {
      caller,
      terminalOwner,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    let heldFee = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    await jbEthPaymentTerminal.connect(terminalOwner).setFeelessAddress(caller.address, true);

    let discountedFee = ethers.BigNumber.from(heldFee[0].fee).sub(
      ethers.BigNumber.from(heldFee[0].fee)
        .mul(ethers.BigNumber.from(heldFee[0].feeDiscount))
        .div(MAX_FEE_DISCOUNT),
    );

    let feeNetAmount = ethers.BigNumber.from(heldFee[0].amount).sub(
      ethers.BigNumber.from(heldFee[0].amount).mul(MAX_FEE).div(discountedFee.add(MAX_FEE)),
    );
    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT.add(feeNetAmount))
      .returns();

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(PROJECT_ID, AMOUNT, ETH_ADDRESS, MEMO, METADATA, { value: AMOUNT }),
    )
      .to.emit(jbEthPaymentTerminal, 'AddToBalance')
      .withArgs(PROJECT_ID, AMOUNT, 0 /*refunded fee*/, MEMO, METADATA, caller.address)
      .and.to.not.emit(jbEthPaymentTerminal, 'RefundHeldFees');

    let heldFeeAfter = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    expect(heldFeeAfter[0]).to.eql(heldFee[0]);
  });
  it('Should work with eth terminal with non msg.value amount sent', async function () {
    const { caller, jbEthPaymentTerminal, mockJBPaymentTerminalStore, fundingCycle } =
      await setup();
    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT)
      .returns();

    await jbEthPaymentTerminal
      .connect(caller)
      .addToBalanceOf(PROJECT_ID, AMOUNT + 1, ETH_ADDRESS, MEMO, METADATA, { value: AMOUNT });
  });
  it('Should work with non-eth terminal if no value is sent', async function () {
    const {
      caller,
      JBERC20PaymentTerminal,
      mockJbToken,
      mockJBPaymentTerminalStore,
      fundingCycle,
    } = await setup();
    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT)
      .returns();

    await mockJbToken.mock.transferFrom
      .withArgs(caller.address, JBERC20PaymentTerminal.address, AMOUNT)
      .returns(0);
    await JBERC20PaymentTerminal.connect(caller).addToBalanceOf(
      PROJECT_ID,
      AMOUNT,
      mockJbToken.address,
      MEMO,
      METADATA,
      {
        value: 0,
      },
    );
  });
  it('Should add to the project balance, partially refund a held fee and substract the amount from the held fee amount and emit event', async function () {
    const {
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
      fundingCycle,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    // Add 1 and refund 1
    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, 1 + 1)
      .returns();

    let heldFeeBefore = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(PROJECT_ID, 1, ETH_ADDRESS, MEMO, METADATA, { value: 1 }),
    )
      .to.emit(jbEthPaymentTerminal, 'AddToBalance')
      .withArgs(PROJECT_ID, 1, 1, MEMO, METADATA, caller.address)
      .and.to.emit(jbEthPaymentTerminal, 'RefundHeldFees')
      // add to balance: 1 -> refund 1 and left over is 0
      .withArgs(PROJECT_ID, 1 /*amount*/, 1 /*refund*/, 0 /*leftOver*/, caller.address);

    let heldFeeAfter = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);
    expect(heldFeeAfter[0].amount).to.equal(heldFeeBefore[0].amount.sub(1));
  });
  it('Should add to the project balance, refund multiple held fee by substracting the amount from the held fee amount when possible and emit event', async function () {
    const {
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
      fundingCycle,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT.div(2), CURRENCY_ETH)
      .returns(
        {
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata({ holdFees: 1 }),
        },
        AMOUNT.div(2),
      );

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT.div(2),
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT.div(2),
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    let heldFee = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    // Both held fees are identical:
    let discountedFee = ethers.BigNumber.from(heldFee[0].fee).sub(
      ethers.BigNumber.from(heldFee[0].fee)
        .mul(ethers.BigNumber.from(heldFee[0].feeDiscount))
        .div(MAX_FEE_DISCOUNT),
    );

    let feeNetAmount = ethers.BigNumber.from(heldFee[0].amount).sub(
      ethers.BigNumber.from(heldFee[0].amount).mul(MAX_FEE).div(discountedFee.add(MAX_FEE)),
    );

    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT.sub('10').add(feeNetAmount.mul(2)))
      .returns();

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(PROJECT_ID, AMOUNT.sub('10'), ETH_ADDRESS, MEMO, METADATA, {
          value: AMOUNT.sub('10'),
        }),
    )
      .to.emit(jbEthPaymentTerminal, 'AddToBalance')
      .withArgs(
        PROJECT_ID,
        AMOUNT.sub('10'),
        feeNetAmount.add(feeNetAmount),
        MEMO,
        METADATA,
        caller.address,
      )
      .and.to.emit(jbEthPaymentTerminal, 'RefundHeldFees')
      // add to balance: AMOUNT.sub('10') -> refund feeNetAmount.mul(2) and left over is 0
      .withArgs(
        PROJECT_ID,
        AMOUNT.sub('10') /*amount*/,
        feeNetAmount.mul(2) /*refund*/,
        0 /*leftOver*/,
        caller.address,
      );

    let heldFeeAfter = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);
    // Only 10 left
    expect(heldFeeAfter[0].amount).to.equal(10);
  });
  it('Should add to the project balance, refund one out of multiple held fees bigger than the amount, keep the held fee difference and emit event', async function () {
    const {
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
      fundingCycle,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await mockJBPaymentTerminalStore.mock.recordDistributionFor
      .withArgs(PROJECT_ID, AMOUNT.div(2), CURRENCY_ETH)
      .returns(
        {
          number: 1,
          configuration: timestamp,
          basedOn: timestamp,
          start: timestamp,
          duration: 0,
          weight: 0,
          discountRate: 0,
          ballot: ethers.constants.AddressZero,
          metadata: packFundingCycleMetadata({ holdFees: 1 }),
        },
        AMOUNT,
      );

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    let heldFee = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    // Both held fees are identical:
    let discountedFee = ethers.BigNumber.from(heldFee[0].fee).sub(
      ethers.BigNumber.from(heldFee[0].fee)
        .mul(ethers.BigNumber.from(heldFee[0].feeDiscount))
        .div(MAX_FEE_DISCOUNT),
    );

    // Adding amount/4 to balance while there are 2 fee held on 'amount'
    const amountToAdd = AMOUNT.div(2);

    // fee from one distribute
    let feeFromOneAmount = ethers.BigNumber.from(heldFee[0].amount).sub(
      ethers.BigNumber.from(heldFee[0].amount).mul(MAX_FEE).div(discountedFee.add(MAX_FEE)),
    );

    // fee which can be used based on amountToAdd
    let feeNetAmount = feeFromOneAmount.div(2);

    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, amountToAdd.add(feeNetAmount))
      .returns();

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(PROJECT_ID, amountToAdd, ETH_ADDRESS, MEMO, METADATA, {
          value: amountToAdd,
        }),
    )
      .to.emit(jbEthPaymentTerminal, 'AddToBalance')
      .withArgs(PROJECT_ID, amountToAdd, feeNetAmount, MEMO, METADATA, caller.address)
      .and.to.emit(jbEthPaymentTerminal, 'RefundHeldFees')
      // add to balance: amountToAdd -> refund feeNetAmount * 0.75 and left over is 0
      .withArgs(
        PROJECT_ID,
        amountToAdd /*amount*/,
        feeNetAmount /*refund*/,
        0 /*leftOver*/,
        caller.address,
      );

    let heldFeeAfter = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    // Only 25% of the initial held fee left
    expect(heldFeeAfter[0].amount).to.equal(AMOUNT.div(2));
  });
  it('Should add to the project balance, refund all the held fees if the amount to add to balance if bigger and emit event', async function () {
    const {
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbEthPaymentTerminal,
      timestamp,
      mockJbSplitsStore,
      mockJBPaymentTerminalStore,
      fundingCycle,
    } = await setup();
    const splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(PROJECT_ID, timestamp, ETH_PAYOUT_INDEX)
      .returns(splits);

    await jbEthPaymentTerminal
      .connect(caller)
      .distributePayoutsOf(
        PROJECT_ID,
        AMOUNT,
        ETH_PAYOUT_INDEX,
        ethers.constants.AddressZero,
        MIN_TOKEN_REQUESTED,
        MEMO,
      );

    // Only one held fee
    let heldFeeBefore = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);

    let discountedFee = ethers.BigNumber.from(heldFeeBefore[0].fee).sub(
      ethers.BigNumber.from(heldFeeBefore[0].fee)
        .mul(ethers.BigNumber.from(heldFeeBefore[0].feeDiscount))
        .div(MAX_FEE_DISCOUNT),
    );

    let netHeldFee = ethers.BigNumber.from(heldFeeBefore[0].amount).sub(
      ethers.BigNumber.from(heldFeeBefore[0].amount).mul(MAX_FEE).div(discountedFee.add(MAX_FEE)),
    );

    // both total amount and refund fee are added
    await mockJBPaymentTerminalStore.mock.recordAddedBalanceFor
      .withArgs(PROJECT_ID, AMOUNT.mul(2).add(netHeldFee))
      .returns();

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(PROJECT_ID, AMOUNT.mul(2), ETH_ADDRESS, MEMO, METADATA, {
          value: AMOUNT.mul(2),
        }),
    )
      .to.emit(jbEthPaymentTerminal, 'AddToBalance')
      .withArgs(PROJECT_ID, AMOUNT.mul(2), netHeldFee, MEMO, METADATA, caller.address)
      .and.to.emit(jbEthPaymentTerminal, 'RefundHeldFees')
      // add to balance: AMOUNT*2 -> refund the whole net fee and the left over is the amount for which a fee wasn't refunded
      .withArgs(
        PROJECT_ID,
        AMOUNT.mul(2) /*amount*/,
        netHeldFee /*refund*/,
        AMOUNT /*leftOver*/,
        caller.address,
      );

    let heldFeeAfter = await jbEthPaymentTerminal.heldFeesOf(PROJECT_ID);
    expect(heldFeeAfter).to.eql([]);
  });
  it("Can't add with value if terminal token isn't ETH", async function () {
    const { caller, JBERC20PaymentTerminal, mockJbToken } = await setup();

    await expect(
      JBERC20PaymentTerminal.connect(caller).addToBalanceOf(
        PROJECT_ID,
        AMOUNT,
        mockJbToken.address,
        MEMO,
        METADATA,
        {
          value: 10,
        },
      ),
    ).to.be.revertedWith(errors.NO_MSG_VALUE_ALLOWED);
  });
  it("Can't add to balance if terminal doesn't belong to project", async function () {
    const { caller, jbEthPaymentTerminal, mockJbDirectory } = await setup();

    const otherProjectId = 18;
    await mockJbDirectory.mock.isTerminalOf
      .withArgs(otherProjectId, jbEthPaymentTerminal.address)
      .returns(false);

    await expect(
      jbEthPaymentTerminal
        .connect(caller)
        .addToBalanceOf(otherProjectId, AMOUNT, ETH_ADDRESS, MEMO, METADATA, { value: 0 }),
    ).to.be.revertedWith(errors.PROJECT_TERMINAL_MISMATCH);
  });
});
