import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { packFundingCycleMetadata } from '../helpers/utils';

import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbTerminal from '../../artifacts/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol/JBPayoutRedemptionPaymentTerminal.json';

describe('JBDirectory::terminalsOf(...)', function () {
  const PROJECT_ID = 13;

  async function setup() {
    let [deployer, projectOwner, ...addrs] = await ethers.getSigners();

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    let mockJbFundingCycleStore = await deployMockContract(deployer, jbFundingCycleStore.abi);
    let mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);
    let mockJbProjects = await deployMockContract(deployer, jbProjects.abi);

    let jbDirectoryFactory = await ethers.getContractFactory('JBDirectory');
    let jbDirectory = await jbDirectoryFactory.deploy(
      mockJbOperatorStore.address,
      mockJbProjects.address,
      mockJbFundingCycleStore.address,
      deployer.address,
    );

    let terminal1 = await deployMockContract(projectOwner, jbTerminal.abi);
    let terminal2 = await deployMockContract(projectOwner, jbTerminal.abi);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJbFundingCycleStore.mock.currentOf.withArgs(PROJECT_ID).returns({
      number: 1,
      configuration: timestamp,
      basedOn: timestamp,
      start: timestamp,
      duration: 0,
      weight: 0,
      discountRate: 0,
      ballot: ethers.constants.AddressZero,
      metadata: packFundingCycleMetadata({ global: { allowSetTerminals: true } }),
    });

    // Add a few terminals
    await jbDirectory
      .connect(projectOwner)
      .setTerminalsOf(PROJECT_ID, [terminal1.address, terminal2.address]);

    return { projectOwner, deployer, addrs, jbDirectory, terminal1, terminal2 };
  }

  it('Should return terminals belonging to the project', async function () {
    const { projectOwner, jbDirectory, terminal1, terminal2 } = await setup();

    let terminals = [...(await jbDirectory.connect(projectOwner).terminalsOf(PROJECT_ID))];
    terminals.sort();

    let expectedTerminals = [terminal1.address, terminal2.address];
    expectedTerminals.sort();

    expect(terminals).to.eql(expectedTerminals);
  });
});
