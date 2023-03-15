import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';

describe('JBProjectPayerDeployer::deployProjectPayer(...)', function () {
  const INITIAL_PROJECT_ID = 1;
  const INITIAL_BENEFICIARY = ethers.Wallet.createRandom().address;
  const INITIAL_PREFER_CLAIMED_TOKENS = false;
  const INITIAL_PREFER_ADD_TO_BALANCE = false;
  const INITIAL_MEMO = 'hello world';
  const INITIAL_METADATA = '0x69';

  async function setup() {
    const [deployer, owner] = await ethers.getSigners();

    const mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);

    const jbProjectPayerDeployerFactory = await ethers.getContractFactory(
      'JBETHERC20ProjectPayerDeployer',
    );
    const jbProjectPayerDeployer = await jbProjectPayerDeployerFactory.deploy();

    return {
      owner,
      mockJbDirectory,
      jbProjectPayerDeployer,
    };
  }

  it('Should deploy the project payer', async function () {
    const { owner, mockJbDirectory, jbProjectPayerDeployer } = await setup();

    const currentNonce = await ethers.provider.getTransactionCount(jbProjectPayerDeployer.address);
    const jbProjectPayerAddress = ethers.utils.getContractAddress({
      from: jbProjectPayerDeployer.address,
      nonce: currentNonce,
    });

    const tx = await jbProjectPayerDeployer
      .connect(owner)
      .deployProjectPayer(
        INITIAL_PROJECT_ID,
        INITIAL_BENEFICIARY,
        INITIAL_PREFER_CLAIMED_TOKENS,
        INITIAL_MEMO,
        INITIAL_METADATA,
        INITIAL_PREFER_ADD_TO_BALANCE,
        mockJbDirectory.address,
        owner.address,
      );

    await expect(tx)
      .to.emit(jbProjectPayerDeployer, 'DeployProjectPayer')
      .withArgs(
        jbProjectPayerAddress,
        INITIAL_PROJECT_ID,
        INITIAL_BENEFICIARY,
        INITIAL_PREFER_CLAIMED_TOKENS,
        INITIAL_MEMO,
        INITIAL_METADATA,
        INITIAL_PREFER_ADD_TO_BALANCE,
        mockJbDirectory.address,
        owner.address,
        owner.address,
      );
  });
});
