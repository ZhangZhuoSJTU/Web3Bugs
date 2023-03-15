import { ethers } from 'hardhat';
import { expect } from 'chai';
import { makeSplits } from '../helpers/utils.js';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import errors from '../helpers/errors.json';
import ierc20 from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import jbAllocator from '../../artifacts/contracts/interfaces/IJBSplitAllocator.sol/IJBSplitAllocator.json';
import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbSplitsStore from '../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';

describe('JBETHERC20SplitsPayer::receive()', function () {
  const DEFAULT_PROJECT_ID = 2;
  const DEFAULT_SPLITS_PROJECT_ID = 3;
  const DEFAULT_SPLITS_DOMAIN = 1;
  const DEFAULT_SPLITS_GROUP = 1;
  let DEFAULT_BENEFICIARY;
  const DEFAULT_PREFER_CLAIMED_TOKENS = false;
  const DEFAULT_MEMO = 'hello world';
  const DEFAULT_METADATA = '0x69';

  const PROJECT_ID = 69;
  const AMOUNT = ethers.utils.parseEther('1.0');
  const PREFER_ADD_TO_BALANCE = false;
  const PREFER_CLAIMED_TOKENS = true;
  const MIN_RETURNED_TOKENS = 1;
  const MEMO = 'hi world';
  const METADATA = '0x42';

  let ethToken;
  let maxSplitsPercent;

  this.beforeAll(async function () {
    let jbTokensFactory = await ethers.getContractFactory('JBTokens');
    let jbTokens = await jbTokensFactory.deploy();

    ethToken = await jbTokens.ETH();

    let jbConstantsFactory = await ethers.getContractFactory('JBConstants');
    let jbConstants = await jbConstantsFactory.deploy();

    maxSplitsPercent = await jbConstants.SPLITS_TOTAL_PERCENT();
  });

  async function setup() {
    let [deployer, owner, caller, beneficiaryOne, beneficiaryTwo, beneficiaryThree, defaultBeneficiarySigner, ...addrs] =
      await ethers.getSigners();

    DEFAULT_BENEFICIARY = defaultBeneficiarySigner.address;

    let mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);
    let mockJbSplitsStore = await deployMockContract(deployer, jbSplitsStore.abi);
    let mockJbTerminal = await deployMockContract(deployer, jbTerminal.abi);
    let mockToken = await deployMockContract(deployer, ierc20.abi);

    let jbSplitsPayerFactory = await ethers.getContractFactory('contracts/JBETHERC20SplitsPayer.sol:JBETHERC20SplitsPayer');

    await mockJbSplitsStore.mock.directory.returns(mockJbDirectory.address);

    let jbSplitsPayer = await jbSplitsPayerFactory.deploy(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      mockJbSplitsStore.address,
      DEFAULT_PROJECT_ID,
      DEFAULT_BENEFICIARY,
      DEFAULT_PREFER_CLAIMED_TOKENS,
      DEFAULT_MEMO,
      DEFAULT_METADATA,
      PREFER_ADD_TO_BALANCE,
      owner.address,
    );

    return {
      beneficiaryOne,
      beneficiaryTwo,
      beneficiaryThree,
      defaultBeneficiarySigner,
      deployer,
      caller,
      owner,
      addrs,
      mockToken,
      mockJbDirectory,
      mockJbTerminal,
      mockJbSplitsStore,
      jbSplitsPayer,
      jbSplitsPayerFactory,
    };
  }

  it(`Should send ETH towards allocator if set in split`, async function () {
    const { deployer, caller, jbSplitsPayer, mockJbSplitsStore } = await setup();

    let mockJbAllocator = await deployMockContract(deployer, jbAllocator.abi);

    let splits = makeSplits({ projectId: PROJECT_ID, allocator: mockJbAllocator.address });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbAllocator.mock.allocate
          .withArgs({
            token: ethToken,
            amount: AMOUNT.mul(split.percent).div(maxSplitsPercent),
            decimals: 18,
            projectId: DEFAULT_PROJECT_ID,
            group: 0,
            split: split,
          })
          .returns();
      }),
    );

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(mockJbAllocator, AMOUNT);
  });

  it(`Should send fund towards project terminal if project ID is set in split and add to balance if it is prefered`, async function () {
    const { caller, jbSplitsPayer, mockJbSplitsStore, mockJbDirectory, mockJbTerminal } =
      await setup();

    let splits = makeSplits({ projectId: PROJECT_ID, preferAddToBalance: true });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(PROJECT_ID, ethToken)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbTerminal.mock.addToBalanceOf
          .withArgs(
            split.projectId,
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            ethToken,
            DEFAULT_MEMO,
            DEFAULT_METADATA,
          )
          .returns();
      }),
    );

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(mockJbTerminal, AMOUNT);
  });

  it(`Should send fund towards project terminal if project ID is set in split, using pay with beneficiaries set in splits`, async function () {
    const {
      caller,
      beneficiaryOne,
      beneficiaryTwo,
      jbSplitsPayer,
      mockJbSplitsStore,
      mockJbDirectory,
      mockJbTerminal,
    } = await setup();
    let splits = makeSplits({
      count: 2,
      projectId: PROJECT_ID,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(PROJECT_ID, ethToken)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbTerminal.mock.pay
          .withArgs(
            split.projectId,
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            ethToken,
            split.beneficiary,
            0 /*hardcoded*/,
            split.preferClaimed,
            DEFAULT_MEMO,
            DEFAULT_METADATA,
          )
          .returns(0); // Not used
      }),
    );

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(mockJbTerminal, AMOUNT);
  });

  it(`Should send fund towards project terminal if project ID is set in split, using pay with the default beneficiary if none is set in splits`, async function () {
    const { caller, jbSplitsPayer, mockJbSplitsStore, mockJbDirectory, mockJbTerminal } =
      await setup();

    let splits = makeSplits({ projectId: PROJECT_ID });

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(PROJECT_ID, ethToken)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await Promise.all(
      splits.map(async (split) => {
        await mockJbTerminal.mock.pay
          .withArgs(
            split.projectId,
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            ethToken,
            DEFAULT_BENEFICIARY,
            0 /*hardcoded*/,
            split.preferClaimed,
            DEFAULT_MEMO,
            DEFAULT_METADATA,
          )
          .returns(0); // Not used
      }),
    );

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(mockJbTerminal, AMOUNT);
  });

  it(`Should send fund directly to a beneficiary set in split, if no allocator or project ID is set in splits`, async function () {
    const { caller, beneficiaryOne, beneficiaryTwo, jbSplitsPayer, mockJbSplitsStore } =
      await setup();

    let splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(
      beneficiaryOne,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
    await expect(tx).to.changeEtherBalance(
      beneficiaryTwo,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
  });

  it(`Should send fund directly to the default beneficiary, if no allocator, project ID or beneficiary is set`, async function () {
    const { caller, jbSplitsPayer, mockJbSplitsStore, defaultBeneficiarySigner } = await setup();

    let splits = makeSplits();

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(defaultBeneficiarySigner, AMOUNT);
  });

  it(`Should send fund directly to the caller, if no allocator, project ID, beneficiary or default beneficiary is set`, async function () {
    const { caller, jbSplitsPayerFactory, mockJbSplitsStore, owner } = await setup();

    let jbSplitsPayerWithoutDefaultBeneficiary = await jbSplitsPayerFactory.deploy(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      mockJbSplitsStore.address,
      DEFAULT_PROJECT_ID,
      ethers.constants.AddressZero,
      DEFAULT_PREFER_CLAIMED_TOKENS,
      DEFAULT_MEMO,
      DEFAULT_METADATA,
      PREFER_ADD_TO_BALANCE,
      owner.address,
    );

    let splits = makeSplits();

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await caller.sendTransaction({ to: jbSplitsPayerWithoutDefaultBeneficiary.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(caller, 0); // -AMOUNT then +AMOUNT, gas is not taken into account
  });

  it(`Should send eth leftover to project id if set, using pay`, async function () {
    const {
      caller,
      jbSplitsPayer,
      mockJbDirectory,
      mockJbSplitsStore,
      mockJbTerminal,
      beneficiaryOne,
      beneficiaryTwo,
      beneficiaryThree,
    } = await setup();

    // 50% to beneficiaries
    let splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      percent: maxSplitsPercent.div('4'),
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(DEFAULT_PROJECT_ID, ethToken)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.pay
      .withArgs(
        DEFAULT_PROJECT_ID,
        AMOUNT.div('2'),
        ethToken,
        DEFAULT_BENEFICIARY,
        0,
        DEFAULT_PREFER_CLAIMED_TOKENS,
        DEFAULT_MEMO,
        DEFAULT_METADATA,
      )
      .returns(0); // Not used

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(
      beneficiaryOne,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
    await expect(tx).to.changeEtherBalance(
      beneficiaryTwo,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
    await expect(tx).to.changeEtherBalance(mockJbTerminal, AMOUNT.div(2));
  });

  it(`Should send eth leftover to project id if set, using addToBalance`, async function () {
    const {
      caller,
      owner,
      jbSplitsPayerFactory,
      mockJbDirectory,
      mockJbSplitsStore,
      mockJbTerminal,
      beneficiaryOne,
      beneficiaryTwo,
      beneficiaryThree,
    } = await setup();

    let jbSplitsPayerPreferAddToBalance = await jbSplitsPayerFactory.deploy(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      mockJbSplitsStore.address,
      DEFAULT_PROJECT_ID,
      DEFAULT_BENEFICIARY,
      DEFAULT_PREFER_CLAIMED_TOKENS,
      DEFAULT_MEMO,
      DEFAULT_METADATA,
      true,
      owner.address,
    );

    // 50% to beneficiaries
    let splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      percent: maxSplitsPercent.div('4'),
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(DEFAULT_PROJECT_ID, ethToken)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.addToBalanceOf
      .withArgs(DEFAULT_PROJECT_ID, AMOUNT.div('2'), ethToken, DEFAULT_MEMO, DEFAULT_METADATA)
      .returns();

    let tx = await caller.sendTransaction({
      to: jbSplitsPayerPreferAddToBalance.address,
      value: AMOUNT,
    });
    await expect(tx).to.changeEtherBalance(
      beneficiaryOne,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
    await expect(tx).to.changeEtherBalance(
      beneficiaryTwo,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
    await expect(tx).to.changeEtherBalance(mockJbTerminal, AMOUNT.div(2));
  });

  it(`Should send eth leftover to beneficiary if no project id set`, async function () {
    const {
      caller,
      owner,
      jbSplitsPayerFactory,
      mockJbSplitsStore,
      mockJbTerminal,
      beneficiaryOne,
      beneficiaryTwo,
      beneficiaryThree,
    } = await setup();

    let jbSplitsPayer = await jbSplitsPayerFactory.deploy(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      mockJbSplitsStore.address,
      0,
      beneficiaryThree.address,
      DEFAULT_PREFER_CLAIMED_TOKENS,
      DEFAULT_MEMO,
      DEFAULT_METADATA,
      true,
      owner.address,
    );
    // 50% to beneficiaries
    let splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      percent: maxSplitsPercent.div('4'),
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await mockJbTerminal.mock.pay
      .withArgs(
        0,
        AMOUNT.div('2'),
        ethToken,
        beneficiaryThree.address,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      )
      .returns(0); // Not used

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(beneficiaryThree, AMOUNT.div('2'));
  });

  it(`Should send eth leftover to the caller if no project id nor beneficiary is set`, async function () {
    const {
      caller,
      owner,
      jbSplitsPayerFactory,
      mockJbSplitsStore,
      mockJbTerminal,
      beneficiaryOne,
      beneficiaryTwo,
      beneficiaryThree,
    } = await setup();

    let jbSplitsPayer = await jbSplitsPayerFactory.deploy(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      mockJbSplitsStore.address,
      0,
      ethers.constants.AddressZero,
      DEFAULT_PREFER_CLAIMED_TOKENS,
      DEFAULT_MEMO,
      DEFAULT_METADATA,
      true,
      owner.address,
    );
    // 50% to beneficiaries
    let splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
      percent: maxSplitsPercent.div('4'),
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    await mockJbTerminal.mock.decimalsForToken.withArgs(ethToken).returns(18);

    await mockJbTerminal.mock.pay
      .withArgs(
        0,
        AMOUNT.div('2'),
        ethToken,
        beneficiaryThree.address,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      )
      .returns(0); // Not used

    let tx = await caller.sendTransaction({ to: jbSplitsPayer.address, value: AMOUNT });
    await expect(tx).to.changeEtherBalance(caller, AMOUNT.div('-2'));
  });
});
