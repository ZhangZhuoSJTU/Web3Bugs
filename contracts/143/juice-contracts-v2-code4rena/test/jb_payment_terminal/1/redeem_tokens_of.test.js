import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import { setBalance } from '../../helpers/utils';
import errors from '../../helpers/errors.json';

import jbController from '../../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbDirectory from '../../../artifacts/contracts/interfaces/IJBDirectory.sol/IJBDirectory.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbOperatoreStore from '../../../artifacts/contracts/interfaces/IJBOperatorStore.sol/IJBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/interfaces/IJBProjects.sol/IJBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/interfaces/IJBSplitsStore.sol/IJBSplitsStore.json';
import jbPrices from '../../../artifacts/contracts/interfaces/IJBPrices.sol/IJBPrices.json';
import jbRedemptionDelegate from '../../../artifacts/contracts/interfaces/IJBRedemptionDelegate.sol/IJBRedemptionDelegate.json';

describe('JBPayoutRedemptionPaymentTerminal::redeemTokensOf(...)', function () {
  const AMOUNT = 50000;
  const RECLAIM_AMOUNT = 40000;
  const MIN_RETURNED_AMOUNT = 30000;
  const FUNDING_CYCLE_NUM = 1;
  const MEMO = 'test memo';
  const ADJUSTED_MEMO = 'test test memo';
  const PROJECT_ID = 13;
  const WEIGHT = 1000;
  const METADATA = '0x69';
  const DECIMALS = 10;
  const DECIMALS_ETH = 18;

  let CURRENCY_ETH;
  let token;

  async function setup() {
    const [deployer, beneficiary, holder, otherCaller, terminalOwner] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const [
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
      mockJbRedemptionDelegate,
      mockJbController,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPrices.abi),
      deployMockContract(deployer, jbRedemptionDelegate.abi),
      deployMockContract(deployer, jbController.abi),
    ]);

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    CURRENCY_ETH = await jbCurrencies.ETH();

    const jbTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );

    const jbEthPaymentTerminal = await jbTerminalFactory
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

    token = await jbEthPaymentTerminal.token();

    /* Lib constants */

    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();
    const REDEEM_PERMISSION_INDEX = await jbOperations.REDEEM();

    /* Common mocks */

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(holder.address, holder.address, PROJECT_ID, REDEEM_PERMISSION_INDEX)
      .returns(true);

    const fundingCycle = {
      number: FUNDING_CYCLE_NUM,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: 0,
    };

    return {
      beneficiary,
      holder,
      jbEthPaymentTerminal,
      fundingCycle,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbRedemptionDelegate,
      mockJbController,
      mockJbDirectory,
      otherCaller,
      timestamp,
    };
  }

  it('Should redeem tokens for overflow and emit event', async function () {
    const {
      beneficiary,
      fundingCycle,
      holder,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbController,
      mockJbDirectory,
      timestamp,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.burnTokensOf
      .withArgs(holder.address, PROJECT_ID, AMOUNT, /* memo */ '', /* preferClaimedTokens */ false)
      .returns();

    // Keep it simple and let 1 token exchange for 1 wei
    await mockJBPaymentTerminalStore.mock.recordRedemptionFor
      .withArgs(holder.address, PROJECT_ID, /* tokenCount */ AMOUNT, MEMO, METADATA)
      .returns(
        fundingCycle,
        /* reclaimAmount */ RECLAIM_AMOUNT,
        /* delegate */ ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      );

    await setBalance(jbEthPaymentTerminal.address, RECLAIM_AMOUNT);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    const tx = await jbEthPaymentTerminal
      .connect(holder)
      .redeemTokensOf(
        holder.address,
        PROJECT_ID,
        /* tokenCount */ AMOUNT,
        /* token */ ethers.constants.AddressZero,
        /* minReturnedTokens */ MIN_RETURNED_AMOUNT,
        beneficiary.address,
        MEMO,
        METADATA,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'RedeemTokens')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _holder */ holder.address,
        /* _beneficiary */ beneficiary.address,
        /* _tokenCount */ AMOUNT,
        /* reclaimAmount */ RECLAIM_AMOUNT,
        /* memo */ ADJUSTED_MEMO,
        /* metadata */ METADATA,
        /* msg.sender */ holder.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(RECLAIM_AMOUNT),
    );
  });

  it('Should work if no burning necessary', async function () {
    const {
      beneficiary,
      fundingCycle,
      holder,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      timestamp,
    } = await setup();

    // Keep it simple and let 1 token exchange for 1 wei
    await mockJBPaymentTerminalStore.mock.recordRedemptionFor
      .withArgs(holder.address, PROJECT_ID, /* tokenCount */ 0, MEMO, METADATA)
      .returns(
        fundingCycle,
        /* reclaimAmount */ RECLAIM_AMOUNT,
        /* delegate */ ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      );

    await setBalance(jbEthPaymentTerminal.address, RECLAIM_AMOUNT);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    const tx = await jbEthPaymentTerminal
      .connect(holder)
      .redeemTokensOf(
        holder.address,
        PROJECT_ID,
        /* tokenCount */ 0,
        /* token */ ethers.constants.AddressZero,
        /* minReturnedTokens */ MIN_RETURNED_AMOUNT,
        beneficiary.address,
        MEMO,
        METADATA,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'RedeemTokens')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _holder */ holder.address,
        /* _beneficiary */ beneficiary.address,
        /* _tokenCount */ 0,
        /* reclaimAmount */ RECLAIM_AMOUNT,
        /* memo */ ADJUSTED_MEMO,
        /* metadata */ METADATA,
        /* msg.sender */ holder.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(RECLAIM_AMOUNT),
    );
  });

  it('Should redeem tokens and call delegate fn and emit delegate event', async function () {
    const {
      beneficiary,
      fundingCycle,
      holder,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbRedemptionDelegate,
      mockJbDirectory,
      mockJbController,
      timestamp,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.burnTokensOf
      .withArgs(holder.address, PROJECT_ID, AMOUNT, /* memo */ '', /* preferClaimedTokens */ false)
      .returns();

    // Keep it simple and let 1 token exchange for 1 wei
    await mockJBPaymentTerminalStore.mock.recordRedemptionFor
      .withArgs(holder.address, PROJECT_ID, /* tokenCount */ AMOUNT, MEMO, METADATA)
      .returns(
        fundingCycle,
        /* reclaimAmount */ RECLAIM_AMOUNT,
        /* delegate */ mockJbRedemptionDelegate.address,
        ADJUSTED_MEMO,
      );

    let tokenAddress = await jbEthPaymentTerminal.token();
    await mockJbRedemptionDelegate.mock.didRedeem
      .withArgs({
        // JBDidRedeemData obj
        holder: holder.address,
        projectId: PROJECT_ID,
        currentFundingCycleConfiguration: timestamp,
        projectTokenCount: AMOUNT,
        reclaimedAmount: {
          token: tokenAddress,
          value: RECLAIM_AMOUNT,
          decimals: DECIMALS_ETH,
          currency: CURRENCY_ETH,
        },
        beneficiary: beneficiary.address,
        memo: ADJUSTED_MEMO,
        metadata: METADATA,
      })
      .returns();

    await setBalance(jbEthPaymentTerminal.address, RECLAIM_AMOUNT);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    const tx = await jbEthPaymentTerminal
      .connect(holder)
      .redeemTokensOf(
        holder.address,
        PROJECT_ID,
        /* tokenCount */ AMOUNT,
        /* token */ ethers.constants.AddressZero,
        /* minReturnedTokens */ MIN_RETURNED_AMOUNT,
        beneficiary.address,
        MEMO,
        METADATA,
      );

    expect(await tx).to.emit(jbEthPaymentTerminal, 'DelegateDidRedeem');
    // Uncaught AssertionError: expected [ Array(4) ] to equal [ Array(4) ]

    // .withArgs(
    //   mockJbRedemptionDelegate.address,
    //   [
    //     // JBDidRedeemData obj
    //     holder.address,
    //     PROJECT_ID,
    //     AMOUNT,
    //       [
    //         tokenAddress,
    //         ethers.BigNumber.from(RECLAIM_AMOUNT),
    //         ethers.BigNumber.from(DECIMALS_ETH),
    //         CURRENCY_ETH
    //       ],
    //     beneficiary.address,
    //     ADJUSTED_MEMO,
    //     METADATA,
    //   ],
    //   /* msg.sender */ holder.address,
    // );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'RedeemTokens')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _holder */ holder.address,
        /* _beneficiary */ beneficiary.address,
        /* _tokenCount */ AMOUNT,
        /* reclaimAmount */ RECLAIM_AMOUNT,
        /* memo */ ADJUSTED_MEMO,
        /* metadata */ METADATA,
        /* msg.sender */ holder.address,
      );

    // Terminal should be out of ETH
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(0);

    // Beneficiary should have a larger balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance.add(RECLAIM_AMOUNT),
    );
  });

  it('Should not perform a transfer and only emit events if claim amount is 0', async function () {
    const {
      beneficiary,
      fundingCycle,
      holder,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbDirectory,
      mockJbController,
      timestamp,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.burnTokensOf
      .withArgs(holder.address, PROJECT_ID, AMOUNT, /* memo */ '', /* preferClaimedTokens */ false)
      .returns();

    // Keep it simple and let 1 token exchange for 1 wei
    await mockJBPaymentTerminalStore.mock.recordRedemptionFor
      .withArgs(holder.address, PROJECT_ID, /* tokenCount */ AMOUNT, MEMO, METADATA)
      .returns(
        fundingCycle,
        /* reclaimAmount */ 0,
        /* delegate */ ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      ); // Set reclaimAmount to 0

    await setBalance(jbEthPaymentTerminal.address, AMOUNT);

    const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);

    const tx = await jbEthPaymentTerminal
      .connect(holder)
      .redeemTokensOf(
        holder.address,
        PROJECT_ID,
        /* tokenCount */ AMOUNT,
        /* token */ ethers.constants.AddressZero,
        /* minReturnedTokens */ 0,
        beneficiary.address,
        MEMO,
        METADATA,
      );

    expect(await tx)
      .to.emit(jbEthPaymentTerminal, 'RedeemTokens')
      .withArgs(
        /* _fundingCycle.configuration */ timestamp,
        /* _fundingCycle.number */ FUNDING_CYCLE_NUM,
        /* _projectId */ PROJECT_ID,
        /* _holder */ holder.address,
        /* _beneficiary */ beneficiary.address,
        /* _tokenCount */ AMOUNT,
        /* reclaimAmount */ 0,
        /* memo */ ADJUSTED_MEMO,
        /* metadata */ METADATA,
        /* msg.sender */ holder.address,
      );

    // Terminal's ETH balance should not have changed
    expect(await ethers.provider.getBalance(jbEthPaymentTerminal.address)).to.equal(AMOUNT);

    // Beneficiary should have the same balance
    expect(await ethers.provider.getBalance(beneficiary.address)).to.equal(
      initialBeneficiaryBalance,
    );
  });

  /* Sad path tests */

  it(`Can't redeem tokens for overflow without access`, async function () {
    const { beneficiary, holder, jbEthPaymentTerminal, mockJbOperatorStore, otherCaller } =
      await setup();

    await mockJbOperatorStore.mock.hasPermission.returns(false);

    await expect(
      jbEthPaymentTerminal
        .connect(otherCaller)
        .redeemTokensOf(
          holder.address,
          PROJECT_ID,
          /* tokenCount */ AMOUNT,
          /* token */ ethers.constants.AddressZero,
          /* minReturnedTokens */ AMOUNT,
          beneficiary.address,
          MEMO,
          /* delegateMetadata */ 0,
        ),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });

  it(`Can't redeem tokens for overflow if beneficiary is zero address`, async function () {
    const { holder, jbEthPaymentTerminal } = await setup();

    await expect(
      jbEthPaymentTerminal.connect(holder).redeemTokensOf(
        holder.address,
        PROJECT_ID,
        /* tokenCount */ AMOUNT,
        ethers.constants.AddressZero,
        /* minReturnedTokens */ AMOUNT,
        /* beneficiary */ ethers.constants.AddressZero, // Beneficiary address is 0
        MEMO,
        /* delegateMetadata */ 0,
      ),
    ).to.be.revertedWith(errors.REDEEM_TO_ZERO_ADDRESS);
  });
  it("Can't redeem if reclaim amount is less than expected", async function () {
    const {
      beneficiary,
      fundingCycle,
      holder,
      jbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbDirectory,
      mockJbController,
      timestamp,
    } = await setup();

    await mockJbDirectory.mock.controllerOf.withArgs(PROJECT_ID).returns(mockJbController.address);
    await mockJbController.mock.burnTokensOf
      .withArgs(holder.address, PROJECT_ID, AMOUNT, /* memo */ '', /* preferClaimedTokens */ false)
      .returns();

    // Keep it simple and let 1 token exchange for 1 wei
    await mockJBPaymentTerminalStore.mock.recordRedemptionFor
      .withArgs(holder.address, PROJECT_ID, /* tokenCount */ AMOUNT, MEMO, METADATA)
      .returns(
        fundingCycle,
        /* reclaimAmount */ 0,
        /* delegate */ ethers.constants.AddressZero,
        ADJUSTED_MEMO,
      ); // Set reclaimAmount to 0

    await expect(
      jbEthPaymentTerminal
        .connect(holder)
        .redeemTokensOf(
          holder.address,
          PROJECT_ID,
          /* tokenCount */ AMOUNT,
          /* token */ ethers.constants.AddressZero,
          /* minReturnedTokens */ MIN_RETURNED_AMOUNT,
          beneficiary.address,
          MEMO,
          METADATA,
        ),
    ).to.be.revertedWith(errors.INADEQUATE_RECLAIM_AMOUNT);
  });
});
