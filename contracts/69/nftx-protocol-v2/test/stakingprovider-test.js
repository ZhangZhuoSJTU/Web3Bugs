const { expect } = require("chai");

const { ethers, upgrades } = require("hardhat");

let primary, alice, bob;
let provider;
let dummyWETH, dummyPUNK;

describe("Staking provider", function () {
  before("Setup", async () => {
    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];
    bob = signers[2];

    const DummyToken = await ethers.getContractFactory(
      "DummyToken"
    );
    dummyPUNK = await DummyToken.deploy("PUNK", "PUNK");
    await dummyPUNK.deployed();
    dummyWETH = await DummyToken.deploy("WETH", "WETH");
    await dummyWETH.deployed();

    const StakingProvider = await ethers.getContractFactory(
      "StakingTokenProvider"
    );
    provider = await upgrades.deployProxy(
      StakingProvider,
      [
        "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac" /*Sushiswap*/, 
        dummyWETH.address /*WETH*/,
        "x",
      ],
      {
        initializer: "__StakingTokenProvider_init",
      }
    );
    await provider.deployed();
  });

  it("Staking provider staked token address is correct", async () => {
    const stakedTokenName = await provider.nameForStakingToken(dummyPUNK.address);
    console.log(stakedTokenName);
    expect(stakedTokenName).to.equal("xPUNKWETH");
  })

  let stakedTokenAddr;
  it("Staking provider provides the corrent name", async () => {
    stakedTokenAddr = await provider.stakingTokenForVaultToken(dummyPUNK.address);
    console.log(stakedTokenAddr);
  })

  it("Should allow changing paired token by owner", async () => {
    const DummyToken = await ethers.getContractFactory(
      "DummyToken"
    );
    let dummyNFTX = await DummyToken.deploy("NFTX", "NFTX");
    await dummyNFTX.deployed();
    await provider.setPairedTokenForVaultToken(dummyPUNK.address, dummyNFTX.address, "nftx");
  });

  it("Staking provider provides the updated name", async () => {
    const stakedTokenName = await provider.nameForStakingToken(dummyPUNK.address);
    console.log(stakedTokenName);
    expect(stakedTokenName).to.equal("nftxPUNKNFTX");
  })

  it("Staking provider changed staking token for updated pair", async () => {
    const newStakedTokenAddr = await provider.stakingTokenForVaultToken(dummyPUNK.address);
    expect(newStakedTokenAddr).to.not.equal(stakedTokenAddr);
  })

  it("Staking provider DAI/WETH should be accurate with sushi", async () => {
    await provider.setDefaultPairedToken("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" /* mainnet weth */, "x");
    const newStakedTokenAddr = await provider.stakingTokenForVaultToken("0x6B175474E89094C44Da98b954EedeAC495271d0F" /* mainnet DAI */);
    expect(newStakedTokenAddr).to.equal("0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f" /* mainnet sushi dai/eth */);
  })

  it("Staking provider NFTX/WETH should be accurate with sushi", async () => {
    const newStakedTokenAddr = await provider.stakingTokenForVaultToken("0x87d73E916D7057945c9BcD8cdd94e42A6F47f776" /* mainnet NFTX */);
    expect(newStakedTokenAddr).to.equal("0x31d64f9403E82243e71C2af9D8F56C7DBe10C178" /* mainnet sushi nftx/eth */);
  })
});
