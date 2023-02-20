import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, BigNumber, constants, Signer } from 'ethers';

describe('Beacon Proxy', () => {
  let DummyTemplate: Contract;
  let Beacon: Contract;
  let BeaconDeployerMock: Contract;

  let wallet: Signer;
  let Dummy: Signer;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    [wallet, Dummy] = accounts;

    const DummyTemplateDeployer = await ethers.getContractFactory('contracts/mocks/DummyTemplate.sol:DummyTemplate', wallet);
    DummyTemplate = await DummyTemplateDeployer.deploy();

    const BeaconDeployer = await ethers.getContractFactory('contracts/Beacon.sol:Beacon', wallet);
    Beacon = await BeaconDeployer.deploy(DummyTemplate.address);

    const BeaconDeployerMockDeployer = await ethers.getContractFactory('contracts/mocks/BeaconDeployerMock.sol:BeaconDeployerMock', wallet);
    BeaconDeployerMock = await BeaconDeployerMockDeployer.deploy(Beacon.address);

    await BeaconDeployerMock.deployed();
  });

  describe('#deploy()', () => {
    it('should be success', async () => {
        const deployaddr = await BeaconDeployerMock.deployCalculate("sample");
        console.log(deployaddr);
        await BeaconDeployerMock.deploy("sample");
        const deployed = (await ethers.getContractFactory('contracts/mocks/DummyTemplate.sol:DummyTemplate', wallet)).attach(deployaddr);
        expect(await deployed.name()).to.equal("sample");
        expect(deployed.address).to.equal(await BeaconDeployerMock.deployCalculate("sample"));
    });
  });
});
