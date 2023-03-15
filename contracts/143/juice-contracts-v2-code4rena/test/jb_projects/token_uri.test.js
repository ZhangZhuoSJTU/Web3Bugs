import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbOperatoreStore from '../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbTokenUriResolver from '../../artifacts/contracts/interfaces/IJBTokenUriResolver.sol/IJBTokenUriResolver.json';

describe('JBProjects::tokenURI(...)', function () {
  const TOKEN_URI = 'ipfs://randommetadatacidipsaddress';
  const PROJECT_ID = 69;

  async function setup() {
    let [deployer] = await ethers.getSigners();

    let mockJbTokenUriResolver = await deployMockContract(deployer, jbTokenUriResolver.abi);
    let mockJbOperatorStore = await deployMockContract(deployer, jbOperatoreStore.abi);

    let jbProjectsFactory = await ethers.getContractFactory('JBProjects');
    let jbProjects = await jbProjectsFactory.deploy(mockJbOperatorStore.address);

    mockJbTokenUriResolver.mock.getUri.withArgs(PROJECT_ID).returns(TOKEN_URI);

    return {
      deployer,
      jbProjects,
      mockJbTokenUriResolver,
    };
  }

  it(`Should return an empty string if the token URI resolver is not set`, async function () {
    const { jbProjects } = await setup();

    expect(await jbProjects.tokenURI(PROJECT_ID)).to.equal('');
  });

  it(`Should return the correct URI if the token URI resolver is set`, async function () {
    const { deployer, jbProjects, mockJbTokenUriResolver } = await setup();

    await jbProjects.connect(deployer).setTokenUriResolver(mockJbTokenUriResolver.address);

    expect(await jbProjects.tokenURI(PROJECT_ID)).to.equal(TOKEN_URI);
  });
});
