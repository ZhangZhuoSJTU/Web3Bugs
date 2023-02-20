const { expect } = require('chai');
const { ethers } = require('hardhat');

const deployRoyaltyVault = async () => {
  const RoyaltyVaultContract = await ethers.getContractFactory('RoyaltyVault');
  const royaltyVault = await RoyaltyVaultContract.deploy();
  return royaltyVault.deployed();
};

const deployRoyaltyFactory = async (royaltyVault) => {
  const RoyaltyVaultFactoryContract = await ethers.getContractFactory(
    'RoyaltyVaultFactory',
  );
  const royaltyVaultFactory = await RoyaltyVaultFactoryContract.deploy(
    royaltyVault,
  );
  return royaltyVaultFactory.deployed();
};

const deployWeth = async () => {
  const myWETHContract = await ethers.getContractFactory('WETH');
  const myWETH = await myWETHContract.deploy();
  return myWETH.deployed();
};

describe('Creating Royalty Vault', () => {
  let royaltyFactory;
  let wEth;
  let royaltyVault;
  let proxyVault;
  let callableProxyVault;
  let funder;
  let account1;
  let account2;

  before(async () => {
    [funder, account1, account2] = await ethers.getSigners();

    wEth = await deployWeth();
    royaltyVault = await deployRoyaltyVault();
    royaltyFactory = await deployRoyaltyFactory(royaltyVault.address);
    const splitter = account1.address;

    await royaltyFactory.connect(funder).createVault(splitter, wEth.address);

    // Compute address.
    const constructorArgs = ethers.utils.defaultAbiCoder.encode(
      ['address'],
      [splitter],
    );
    const salt = ethers.utils.keccak256(constructorArgs);
    const proxyBytecode = (await ethers.getContractFactory('ProxyVault'))
      .bytecode;
    const codeHash = ethers.utils.keccak256(proxyBytecode);
    const proxyAddress = await ethers.utils.getCreate2Address(
      royaltyFactory.address,
      salt,
      codeHash,
    );

    proxyVault = await (
      await ethers.getContractAt('ProxyVault', proxyAddress)
    ).deployed();

    callableProxyVault = await (
      await ethers.getContractAt('RoyaltyVault', proxyVault.address)
    ).deployed();
  });

  it('Should return correct RoyaltVault balance', async () => {
    await wEth
      .connect(funder)
      .transfer(proxyVault.address, ethers.utils.parseEther('1'));
    const balance = await wEth.balanceOf(proxyVault.address);

    expect(await balance).to.eq(ethers.utils.parseEther('1').toString());
  });

  it('Owner of RoyaltyProxy must be RoyaltyFactory', async () => {
    const owner = await callableProxyVault.owner();
    expect(owner).to.eq(royaltyFactory.address);
  });

  it('Gets platform fee', async () => {
    const platformFee = await callableProxyVault.platformFee();
    expect(platformFee).to.eq(500);
  });

  it('Sets platform fee', async () => {
    await royaltyFactory.setPlatformFee(proxyVault.address, 1000);
    const platformFee = await callableProxyVault.platformFee();
    expect(platformFee).to.eq('1000');
  });

  it('Sets platform fee recipient', async () => {
    await royaltyFactory.setPlatformFeeRecipient(
      proxyVault.address,
      account2.address,
    );
    const platformFee = await callableProxyVault.platformFeeRecipient();
    expect(platformFee).to.eq(account2.address);
  });

  it('Gets splitter', async () => {
    const splitter = await callableProxyVault.getSplitter();
    expect(splitter).to.eq(account1.address);
  });
});
