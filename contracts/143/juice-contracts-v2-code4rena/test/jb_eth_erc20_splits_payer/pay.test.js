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

describe('JBETHERC20SplitsPayer::pay(...)', function () {
  const DEFAULT_PROJECT_ID = 2;
  const DEFAULT_SPLITS_PROJECT_ID = 3;
  const DEFAULT_SPLITS_DOMAIN = 1;
  const DEFAULT_SPLITS_GROUP = 1;
  const DECIMALS = 18;
  let DEFAULT_BENEFICIARY;
  const DEFAULT_PREFER_CLAIMED_TOKENS = false;
  const DEFAULT_MEMO = 'hello world';
  const DEFAULT_METADATA = '0x42';

  const PROJECT_ID = 69;
  const AMOUNT = ethers.utils.parseEther('1.0');
  const PREFER_ADD_TO_BALANCE = false;
  const BENEFICIARY = ethers.Wallet.createRandom().address;
  const PREFER_CLAIMED_TOKENS = true;
  const MIN_RETURNED_TOKENS = 1;
  const MEMO = 'hi world';
  const METADATA = '0x69';

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
      jbSplitsPayerFactory
    };
  }

  it(`Should send ETH towards allocator if set in split and emit event`, async function () {
    const { deployer, caller, jbSplitsPayer, mockJbSplitsStore } = await setup();

    let mockJbAllocator = await deployMockContract(deployer, jbAllocator.abi);

    let splits = makeSplits({
      count: 2,
      projectId: PROJECT_ID,
      allocator: mockJbAllocator.address,
    });

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

    // Payment routing
    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbSplitsPayer, 'DistributeToSplit')
          .withArgs(
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            DEFAULT_BENEFICIARY,
            caller.address,
          );
      }),
    );

    await expect(tx).to.emit(jbSplitsPayer, 'DistributeToSplitGroup').withArgs(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      caller.address,
    );
  });

  it(`Should send ERC20 with 9-decimals towards allocator if set in split and emit event`, async function () {
    const { caller, deployer, jbSplitsPayer, mockToken, mockJbSplitsStore } = await setup();
    const DECIMALS = 9;

    let mockJbAllocator = await deployMockContract(deployer, jbAllocator.abi);

    let splits = makeSplits({ projectId: PROJECT_ID, allocator: mockJbAllocator.address });

    await Promise.all(
      splits.map(async (split) => {
        await mockToken.mock.approve
          .withArgs(mockJbAllocator.address, AMOUNT.mul(split.percent).div(maxSplitsPercent))
          .returns(true);

        await mockJbAllocator.mock.allocate
          .withArgs({
            token: mockToken.address,
            amount: AMOUNT.mul(split.percent).div(maxSplitsPercent),
            decimals: DECIMALS,
            projectId: DEFAULT_PROJECT_ID,
            group: 0,
            split: split,
          })
          .returns();
      }),
    );

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    await mockToken.mock.transferFrom
      .withArgs(caller.address, jbSplitsPayer.address, AMOUNT)
      .returns(true);

    let tx = jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        mockToken.address,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      );

    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      mockToken.address,
      AMOUNT,
      DECIMALS,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
  });

  it(`Should send fund towards project terminal if project ID is set in split and add to balance if it is prefered, and emit event`, async function () {
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

    let tx = jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
  });

  it(`Should send fund towards project terminal if project ID is set in split, using pay with beneficiaries set in splits, and emit event`, async function () {
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

    let tx = jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );
    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbSplitsPayer, 'DistributeToSplit')
          .withArgs(
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            DEFAULT_BENEFICIARY,
            caller.address,
          );
      }),
    );

    await expect(tx).to.emit(jbSplitsPayer, 'DistributeToSplitGroup').withArgs(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      caller.address,
    );
  });

  it(`Should send fund towards project terminal if project ID is set in split, using pay with the default beneficiary if none is set in splits and emit event`, async function () {
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

    let tx = jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );
    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbSplitsPayer, 'DistributeToSplit')
          .withArgs(
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            DEFAULT_BENEFICIARY,
            caller.address,
          );
      }),
    );

    await expect(tx).to.emit(jbSplitsPayer, 'DistributeToSplitGroup').withArgs(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      caller.address,
    );
  });

  it(`Should send fund directly to a beneficiary set in split, if no allocator or project ID is set in splits and emit event`, async function () {
    const { caller, beneficiaryOne, beneficiaryTwo, jbSplitsPayer, mockJbSplitsStore } =
      await setup();

    let splits = makeSplits({
      count: 2,
      beneficiary: [beneficiaryOne.address, beneficiaryTwo.address],
    });

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).to.changeEtherBalance(
      beneficiaryOne,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );
    await expect(tx).to.changeEtherBalance(
      beneficiaryTwo,
      AMOUNT.mul(splits[0].percent).div(maxSplitsPercent),
    );

    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );

    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbSplitsPayer, 'DistributeToSplit')
          .withArgs(
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            DEFAULT_BENEFICIARY,
            caller.address,
          );
      }),
    );

    await expect(tx).to.emit(jbSplitsPayer, 'DistributeToSplitGroup').withArgs(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      caller.address,
    );
  });

  it(`Should send fund directly to the default beneficiary, if no allocator, project ID or beneficiary is set, and emit event`, async function () {
    const { caller, jbSplitsPayer, mockJbSplitsStore, defaultBeneficiarySigner } = await setup();

    let splits = makeSplits();

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).to.changeEtherBalance(defaultBeneficiarySigner, AMOUNT);
    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      PROJECT_ID,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbSplitsPayer, 'DistributeToSplit')
          .withArgs(
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            DEFAULT_BENEFICIARY,
            caller.address,
          );
      }),
    );

    await expect(tx).to.emit(jbSplitsPayer, 'DistributeToSplitGroup').withArgs(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      caller.address,
    );
  });

  it(`Should send fund directly to the caller, if no allocator, project ID, beneficiary or default beneficiary is set, and emit event`, async function () {
    const { caller, jbSplitsPayerFactory, mockJbSplitsStore, owner } = await setup();

    let splits = makeSplits();

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

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await jbSplitsPayerWithoutDefaultBeneficiary
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).to.changeEtherBalance(caller, 0); // -AMOUNT then +AMOUNT, gas is not taken into account
    await expect(tx).to.emit(jbSplitsPayerWithoutDefaultBeneficiary, 'Pay').withArgs(
      PROJECT_ID,
      ethers.constants.AddressZero, // default beneficary
      ethToken,
      AMOUNT,
      18,
      0, //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
    await Promise.all(
      splits.map(async (split) => {
        await expect(tx)
          .to.emit(jbSplitsPayerWithoutDefaultBeneficiary, 'DistributeToSplit')
          .withArgs(
            [
              split.preferClaimed,
              split.preferAddToBalance,
              split.percent,
              split.projectId,
              split.beneficiary,
              split.lockedUntil,
              split.allocator,
            ],
            AMOUNT.mul(split.percent).div(maxSplitsPercent),
            caller.address,
            caller.address,
          );
      }),
    );

    await expect(tx).to.emit(jbSplitsPayerWithoutDefaultBeneficiary, 'DistributeToSplitGroup').withArgs(
      DEFAULT_SPLITS_PROJECT_ID,
      DEFAULT_SPLITS_DOMAIN,
      DEFAULT_SPLITS_GROUP,
      caller.address,
    );
  });

  it(`Should send eth leftover to project id if set and emit event`, async function () {
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
      .withArgs(PROJECT_ID, ethToken)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.pay
      .withArgs(
        PROJECT_ID,
        AMOUNT.div('2'),
        ethToken,
        beneficiaryThree.address,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      )
      .returns(0); // Not used

    await expect(
      jbSplitsPayer
        .connect(caller)
        .pay(
          PROJECT_ID,
          ethToken,
          AMOUNT,
          DECIMALS,
          beneficiaryThree.address,
          MIN_RETURNED_TOKENS,
          PREFER_CLAIMED_TOKENS,
          MEMO,
          METADATA,
          {
            value: AMOUNT,
          },
        ),
    )
      .to.emit(jbSplitsPayer, 'Pay')
      .withArgs(
        PROJECT_ID,
        DEFAULT_BENEFICIARY,
        ethToken,
        AMOUNT,
        18,
        AMOUNT.div('2'), //left over
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        caller.address,
      );
  });

  it(`Should send erc20 leftover to project id if set and emit event`, async function () {
    const {
      caller,
      jbSplitsPayer,
      mockJbDirectory,
      mockJbSplitsStore,
      mockJbTerminal,
      mockToken,
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

    // Transfer to splitsPayer
    await mockToken.mock.transferFrom
      .withArgs(caller.address, jbSplitsPayer.address, AMOUNT)
      .returns(true);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    // Transfer from splitsPayer to splits beneficiaries
    await Promise.all(
      splits.map(async (split) => {
        await mockToken.mock.transfer
          .withArgs(split.beneficiary, AMOUNT.mul(split.percent).div(maxSplitsPercent))
          .returns(true);
      }),
    );

    // leftover: terminal of project ID
    await mockJbDirectory.mock.primaryTerminalOf
      .withArgs(PROJECT_ID, mockToken.address)
      .returns(mockJbTerminal.address);

    await mockJbTerminal.mock.decimalsForToken.withArgs(mockToken.address).returns(18);

    // Approve transfer to the default project ID terminal
    await mockToken.mock.approve.withArgs(mockJbTerminal.address, AMOUNT.div('2')).returns(true);

    // Pay the leftover with the default beneficiary
    await mockJbTerminal.mock.pay
      .withArgs(
        PROJECT_ID,
        AMOUNT.div('2'),
        mockToken.address,
        beneficiaryThree.address,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      )
      .returns(0); // Not used

    await expect(
      jbSplitsPayer.connect(caller).pay(
        PROJECT_ID,
        mockToken.address,
        AMOUNT,
        DECIMALS,
        beneficiaryThree.address, // default beneficiary
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      ),
    )
      .to.emit(jbSplitsPayer, 'Pay')
      .withArgs(
        PROJECT_ID,
        DEFAULT_BENEFICIARY,
        mockToken.address,
        AMOUNT,
        18,
        AMOUNT.div('2'), //left over
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        caller.address,
      );
  });

  it(`Should send eth leftover to beneficiary if no project id set and emit event`, async function () {
    const {
      caller,
      jbSplitsPayer,
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

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        0,
        ethToken,
        AMOUNT,
        DECIMALS,
        beneficiaryThree.address,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).to.changeEtherBalance(beneficiaryThree, AMOUNT.div('2'));

    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      0,
      DEFAULT_BENEFICIARY,
      ethToken,
      AMOUNT,
      18,
      AMOUNT.div('2'), //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
  });

  it(`Should send erc20 leftover to beneficiary if no project id set and emit event`, async function () {
    const {
      caller,
      jbSplitsPayer,
      mockToken,
      mockJbSplitsStore,
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

    // Transfer to splitsPayer
    await mockToken.mock.transferFrom
      .withArgs(caller.address, jbSplitsPayer.address, AMOUNT)
      .returns(true);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    // Transfer from splitsPayer to splits beneficiaries
    await Promise.all(
      splits.map(async (split) => {
        await mockToken.mock.transfer
          .withArgs(split.beneficiary, AMOUNT.mul(split.percent).div(maxSplitsPercent))
          .returns(true);
      }),
    );

    // Transfer from splitsPayer to default beneficiary
    await mockToken.mock.transfer.withArgs(beneficiaryThree.address, AMOUNT.div('2')).returns(true);

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        0,
        mockToken.address,
        AMOUNT,
        DECIMALS,
        beneficiaryThree.address,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      );

    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      0,
      DEFAULT_BENEFICIARY,
      mockToken.address,
      AMOUNT,
      DECIMALS,
      AMOUNT.div('2'), //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
  });

  it(`Should send eth leftover to the caller if no project id nor beneficiary is set and emit event`, async function () {
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

    await mockJbTerminal.mock.pay
      .withArgs(
        0,
        AMOUNT.div('2'),
        ethToken,
        ethers.constants.AddressZero,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      )
      .returns(0); // Not used

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        0,
        ethToken,
        AMOUNT,
        DECIMALS,
        ethers.constants.AddressZero,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      );

    await expect(tx).to.changeEtherBalance(caller, AMOUNT.div('-2')); // Only 50% are dsitributed
    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      0,
      caller.address,
      ethToken,
      AMOUNT,
      18,
      AMOUNT.div('2'), //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
  });

  it(`Should send erc20 leftover to the caller if no project id nor beneficiary is set and emit event`, async function () {
    const {
      caller,
      jbSplitsPayer,
      mockJbSplitsStore,
      mockToken,
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

    // Transfer to splitsPayer
    await mockToken.mock.transferFrom
      .withArgs(caller.address, jbSplitsPayer.address, AMOUNT)
      .returns(true);

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    // Transfer from splitsPayer to splits beneficiaries
    await Promise.all(
      splits.map(async (split) => {
        await mockToken.mock.transfer
          .withArgs(split.beneficiary, AMOUNT.mul(split.percent).div(maxSplitsPercent))
          .returns(true);
      }),
    );

    // Transfer leftover from splitsPayer to msg.sender
    await mockToken.mock.transfer.withArgs(caller.address, AMOUNT.div('2')).returns(true);

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        0,
        mockToken.address,
        AMOUNT,
        DECIMALS,
        ethers.constants.AddressZero,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
      );

    await expect(tx).to.emit(jbSplitsPayer, 'Pay').withArgs(
      0,
      caller.address,
      mockToken.address,
      AMOUNT,
      18,
      AMOUNT.div('2'), //left over
      MIN_RETURNED_TOKENS,
      PREFER_CLAIMED_TOKENS,
      MEMO,
      METADATA,
      caller.address,
    );
  });

  it(`Should pay to split with a null amount and emit event`, async function () {
    const { caller, jbSplitsPayer, mockJbSplitsStore } = await setup();

    let splits = makeSplits();

    await mockJbSplitsStore.mock.splitsOf
      .withArgs(DEFAULT_SPLITS_PROJECT_ID, DEFAULT_SPLITS_DOMAIN, DEFAULT_SPLITS_GROUP)
      .returns(splits);

    let tx = await jbSplitsPayer
      .connect(caller)
      .pay(
        PROJECT_ID,
        ethToken,
        0,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: 0,
        },
      );

    await expect(tx).to.changeEtherBalance(caller, 0); // Send then receive the amount (gas is not taken into account)

    await expect(tx)
      .to.emit(jbSplitsPayer, 'Pay')
      .withArgs(
        PROJECT_ID,
        DEFAULT_BENEFICIARY,
        ethToken,
        0,
        DECIMALS,
        0,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        caller.address,
      );
  });

  it(`Cannot send ETH with another token as argument`, async function () {
    const { jbSplitsPayer, mockToken } = await setup();

    await expect(
      jbSplitsPayer.pay(
        DEFAULT_PROJECT_ID,
        mockToken.address,
        AMOUNT,
        DECIMALS,
        BENEFICIARY,
        MIN_RETURNED_TOKENS,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        {
          value: AMOUNT,
        },
      ),
    ).to.be.revertedWith(errors.NO_MSG_VALUE_ALLOWED);
  });
});
