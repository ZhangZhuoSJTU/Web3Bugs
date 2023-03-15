import { expect } from 'chai';
import { ethers } from 'hardhat';
import errors from '../helpers/errors.json';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbFundingCycleStore from '../../artifacts/contracts/JBFundingCycleStore.sol/JBFundingCycleStore.json';
import jbController from '../../artifacts/contracts/interfaces/IJBController.sol/IJBController.json';
import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../artifacts/contracts/JBProjects.sol/JBProjects.json';

describe('JBDirectory::setIsAllowedToSetFirstController(...)', function () {
  async function setup() {
    let [deployer, ...addrs] = await ethers.getSigners();

    let mockJbFundingCycleStore = await deployMockContract(deployer, jbFundingCycleStore.abi);
    let mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);
    let mockJbProjects = await deployMockContract(deployer, jbProjects.abi);
    let mockJbController = await deployMockContract(deployer, jbController.abi);

    let jbDirectoryFactory = await ethers.getContractFactory('JBDirectory');
    let jbDirectory = await jbDirectoryFactory.deploy(
      mockJbOperatorStore.address,
      mockJbProjects.address,
      mockJbFundingCycleStore.address,
      deployer.address,
    );

    return {
      deployer,
      addrs,
      jbDirectory,
      mockJbController,
    };
  }

  it('Should add a controller to the list and emit events if caller is JBDirectory owner', async function () {
    const { deployer, jbDirectory, mockJbController } = await setup();

    await expect(
      jbDirectory
        .connect(deployer)
        .setIsAllowedToSetFirstController(mockJbController.address, true),
    )
      .to.emit(jbDirectory, 'SetIsAllowedToSetFirstController')
      .withArgs(mockJbController.address, true, deployer.address);

    expect(await jbDirectory.isAllowedToSetFirstController(mockJbController.address)).to.be.true;
  });

  it('Should remove a controller and emit events if caller is JBDirectory owner', async function () {
    const { deployer, jbDirectory, mockJbController } = await setup();

    await expect(
      jbDirectory
        .connect(deployer)
        .setIsAllowedToSetFirstController(mockJbController.address, false),
    )
      .to.emit(jbDirectory, 'SetIsAllowedToSetFirstController')
      .withArgs(mockJbController.address, false, deployer.address);

    expect(await jbDirectory.isAllowedToSetFirstController(mockJbController.address)).to.be.false;
  });

  it("Can't add a controller if caller is not JBDirectory owner", async function () {
    const { addrs, jbDirectory, mockJbController } = await setup();

    await expect(
      jbDirectory
        .connect(addrs[0])
        .setIsAllowedToSetFirstController(mockJbController.address, true),
    ).to.revertedWith('Ownable: caller is not the owner');
  });
});
