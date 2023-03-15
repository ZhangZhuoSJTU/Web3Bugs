import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import errors from '../helpers/errors.json';
import { packFundingCycleMetadata, impersonateAccount } from '../helpers/utils';

import jbDirectory from '../../artifacts/contracts/interfaces/IJBDirectory.sol/IJBDirectory.json';
import jBFundingCycleStore from '../../artifacts/contracts/interfaces/IJBFundingCycleStore.sol/IJBFundingCycleStore.json';
import jbPrices from '../../artifacts/contracts/interfaces/IJBPrices.sol/IJBPrices.json';
import jbProjects from '../../artifacts/contracts/interfaces/IJBProjects.sol/IJBProjects.json';
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';
import jbTokenStore from '../../artifacts/contracts/interfaces/IJBTokenStore.sol/IJBTokenStore.json';

describe('JBSingleTokenPaymentTerminalStore::recordMigration(...)', function () {
  const PROJECT_ID = 2;
  const AMOUNT = ethers.FixedNumber.fromString('4398541.345');
  const WEIGHT = ethers.FixedNumber.fromString('900000000.23411');
  const CURRENCY = 1;
  const BASE_CURRENCY = 0;

  async function setup() {
    const [deployer] = await ethers.getSigners();

    const mockJbPrices = await deployMockContract(deployer, jbPrices.abi);
    const mockJbProjects = await deployMockContract(deployer, jbProjects.abi);
    const mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);
    const mockJbFundingCycleStore = await deployMockContract(deployer, jBFundingCycleStore.abi);
    const mockJbTerminal = await deployMockContract(deployer, jbTerminal.abi);
    const mockJbTokenStore = await deployMockContract(deployer, jbTokenStore.abi);

    const JBPaymentTerminalStoreFactory = await ethers.getContractFactory(
      'contracts/JBSingleTokenPaymentTerminalStore.sol:JBSingleTokenPaymentTerminalStore',
    );
    const JBSingleTokenPaymentTerminalStore = await JBPaymentTerminalStoreFactory.deploy(
      mockJbDirectory.address,
      mockJbFundingCycleStore.address,
      mockJbPrices.address,
    );

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    await mockJbTerminal.mock.currency.returns(CURRENCY);

    const mockJbTerminalSigner = await impersonateAccount(mockJbTerminal.address);

    return {
      mockJbTerminal,
      mockJbTerminalSigner,
      mockJbFundingCycleStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
    };
  }

  it('Should record migration with mockJbTerminal access', async function () {
    const {
      mockJbTerminalSigner,
      mockJbFundingCycleStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
    } = await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowTerminalMigration: 1 }),
    });

    // Add to balance beforehand
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordAddedBalanceFor(
      PROJECT_ID,
      AMOUNT,
    );

    // "Record migration"
    await JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordMigration(
      PROJECT_ID,
    );

    // Current balance should be set to 0
    expect(
      await JBSingleTokenPaymentTerminalStore.balanceOf(mockJbTerminalSigner.address, PROJECT_ID),
    ).to.equal(0);
  });

  it(`Can't record migration with allowTerminalMigration flag disabled`, async function () {
    const {
      mockJbTerminalSigner,
      mockJbFundingCycleStore,
      JBSingleTokenPaymentTerminalStore,
      timestamp,
    } = await setup();

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: WEIGHT,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ allowTerminalMigration: 0 }),
    });

    // Record migration
    await expect(
      JBSingleTokenPaymentTerminalStore.connect(mockJbTerminalSigner).recordMigration(PROJECT_ID),
    ).to.be.revertedWith(errors.PAYMENT_TERMINAL_MIGRATION_NOT_ALLOWED);
  });
});
