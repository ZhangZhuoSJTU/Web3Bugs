const { expect } = require("chai");
const { expectRevert } = require("../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../addresses/rinkeby.json");

const BASE = BigNumber.from(10).pow(18);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice, bob;
let nftx;
let staking;
let erc721;
let feeDistrib;
let provider;
const vaults = [];

const numTokenIds = 20;
const numLoops = 10;

describe("LP Staking", function () {
  before("Setup", async () => {
    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];
    bob = signers[2];

    const StakingProvider = await ethers.getContractFactory(
      "MockStakingProvider"
    );
    provider = await StakingProvider.deploy();
    await provider.deployed();

    const Staking = await ethers.getContractFactory("NFTXLPStaking");
    staking = await upgrades.deployProxy(Staking, [provider.address], {
      initializer: "__NFTXLPStaking__init",
    });
    await staking.deployed();

    const Vault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    const vault = await Vault.deploy();
    await vault.deployed();

    const FeeDistributor = await ethers.getContractFactory(
      "NFTXFeeDistributor"
    );
    feeDistrib = await upgrades.deployProxy(
      FeeDistributor,
      [staking.address, notZeroAddr],
      {
        initializer: "__FeeDistributor__init__",
      }
    );
    await feeDistrib.deployed();

    const Nftx = await ethers.getContractFactory("NFTXVaultFactoryUpgradeable");
    nftx = await upgrades.deployProxy(
      Nftx,
      [vault.address, notZeroAddr, feeDistrib.address],
      {
        initializer: "__NFTXVaultFactory_init",
      }
    );
    await nftx.deployed();

    await feeDistrib.connect(primary).setNFTXVaultFactory(nftx.address);
    await staking.connect(primary).setNFTXVaultFactory(nftx.address);
    await staking.connect(primary).setFeeDistributor(feeDistrib.address);


    const Erc721 = await ethers.getContractFactory("ERC721");
    erc721 = await Erc721.deploy(`CryptoPandas`, `CRYPTOPANDAS`);
    await erc721.deployed();

    for (let i = 0; i < numTokenIds; i++) {
      await erc721.publicMint(primary.address, i);
    }
  });

  ////////////////////////////
  // Vault 0: ERC721, Basic //
  ////////////////////////////

  it("Should allow vault creation", async () => {
    const response = await nftx.createVault(
      "CryptoPandas",
      "PANDA",
      erc721.address,
      false,
      true
    );
    const receipt = await response.wait(0);
    const vaultId = receipt.events
      .find((elem) => elem.event === "NewVault")
      .args[0].toString();
    const vaultAddr = await nftx.vault(vaultId);
    const vaultArtifact = await artifacts.readArtifact("NFTXVaultUpgradeable");
    const vault = new ethers.Contract(
      vaultAddr,
      vaultArtifact.abi,
      ethers.provider
    );
    vaults.push(vault);
  });

  it("Should allow all vault features", async () => {
    await vaults[0].connect(primary).setVaultFeatures(true, true, true, true);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRedeem()).to.eq(true);
    expect(await vaults[0].enableDirectRedeem()).to.eq(true);
    expect(await vaults[0].enableSwap()).to.eq(true);
  });

  it("Should allow minting one at a time by alice", async () => {
    for (let i = 0; i < numLoops; i++) {
      const tokenId = i;
      await erc721.transferFrom(primary.address, alice.address, tokenId);
      expect(await erc721.balanceOf(alice.address)).to.equal(1);
      await erc721.connect(alice).approve(vaults[0].address, tokenId);
      await vaults[0].connect(alice).mint([tokenId], [1]);
      expect(await erc721.balanceOf(alice.address)).to.equal(0);
      expect(await erc721.balanceOf(vaults[0].address)).to.equal(i + 1);
      expect(await vaults[0].balanceOf(alice.address)).to.equal(
        BASE.mul(i + 1)
      );
    }
  });

  it("Should allow setting a mint and redeem fee", async () => {
    const fee = BigNumber.from(10).pow(17);
    await vaults[0].connect(primary).setFees(fee, fee, 0, 0);
    expect(await vaults[0].mintFee()).to.equal(fee);
    expect(await vaults[0].redeemFee()).to.equal(fee);
  })

  it("Should allow staking into the fee distribution contract", async () => {
    const bal = await vaults[0].balanceOf(alice.address);
    const depositBal = bal.div(100);
    const id = await vaults[0].vaultId();
    await vaults[0].connect(alice).approve(staking.address, depositBal);
    await staking.connect(alice).deposit(id, depositBal);
    const newBal = await vaults[0].balanceOf(alice.address);
    expect(newBal).to.equal(bal.sub(depositBal));
    let distToken = await staking.rewardDistributionToken(id)
    const rewardDist = await ethers.getContractAt("RewardDistributionTokenUpgradeable", distToken);
    const total = await rewardDist.totalSupply();
    expect(total).to.equal(depositBal);
    console.log(await rewardDist.symbol());
  })

  it("Should allow redeeming one at a time by alice", async () => {
    const fee = BigNumber.from(10).pow(17);

    expect(await erc721.balanceOf(alice.address)).to.equal(0);
    for (let i = 0; i < numLoops-1; i++) {
      expect(await erc721.balanceOf(alice.address)).to.equal(i);
      await vaults[0].connect(alice).approve(alice.address, BASE.add(fee));
      await vaults[0].connect(alice).redeem(1, []);
    }
  });

  it("Should allow minting one at a time by alice", async () => {
    for (let i = 0; i < numLoops-10; i++) {
      const tokenId = i;
      await erc721.transferFrom(primary.address, alice.address, tokenId);
      expect(await erc721.balanceOf(alice.address)).to.equal(1);
      await erc721.connect(alice).approve(vaults[0].address, tokenId);
      await vaults[0].connect(alice).mint([tokenId], [1]);
      expect(await erc721.balanceOf(alice.address)).to.equal(0);
      expect(await erc721.balanceOf(vaults[0].address)).to.equal(i + 1);
      expect(await vaults[0].balanceOf(alice.address)).to.equal(
        BASE.mul(i + 1)
      );
    }
  });

  it("Should allow claiming from the staking contract", async () => {
    const id = await vaults[0].vaultId();
    await staking.connect(alice).claimRewards(id);
    const bal = await vaults[0].balanceOf(alice.address);
    expect(bal).to.gt(BASE.div(2));
  })

  it("Should allow withdraw from the distribution contract", async () => {
    const id = await vaults[0].vaultId();
    const rewardAddr = await staking.rewardDistributionToken(id);
    const rewardToken = await ethers.getContractAt("IERC20Upgradeable", rewardAddr);
    const bal = await rewardToken.balanceOf(alice.address);
    await rewardToken.connect(alice).approve(staking.address, bal);
    await staking.connect(alice).withdraw(id, bal.div(2));
    const newBal = await vaults[0].balanceOf(alice.address);
    expect(newBal).to.gt(bal.add(BASE.div(2)));
  })

  it("Should allow changing the provided token", async () => {
    let oldStakingToken = await provider.stakingTokenForVaultToken(vaults[0].address);
    await provider.connect(primary).setChanged(true);
    let newStakingToken = await provider.stakingTokenForVaultToken(vaults[0].address);
    expect(newStakingToken).to.not.equal(oldStakingToken);
  })

  it("Should allow updating the assigned staking token", async () => {
    const id = await vaults[0].vaultId();
    const beforePool = await staking.vaultStakingInfo(id);
    await staking.updatePoolForVault(id);
    const afterPool = await staking.vaultStakingInfo(id);
    expect(beforePool.rewardToken).to.equal(afterPool.rewardToken);
    expect(beforePool.stakingToken).to.not.equal(afterPool.stakingToken);
  })

  it("Should not allow withdrawing normally after change", async () => {
    const id = await vaults[0].vaultId();
    const rewardAddr = await staking.rewardDistributionToken(id);
    const rewardToken = await ethers.getContractAt("IERC20Upgradeable", rewardAddr);
    const bal = await rewardToken.balanceOf(alice.address);
    await rewardToken.connect(alice).approve(staking.address, bal);
    await expectRevert(staking.connect(alice).withdraw(id, bal), "function call to a non-contract");
  })

  it("Should allow emergency withdrawing normally after change", async () => {
    const id = await vaults[0].vaultId();
    const rewardAddr = await staking.rewardDistributionToken(id);
    const rewardToken = await ethers.getContractAt("IERC20Upgradeable", rewardAddr);
    const bal = await rewardToken.balanceOf(alice.address);
    await rewardToken.connect(alice).approve(staking.address, bal);
    await staking.connect(alice).emergencyExitAndClaim(vaults[0].address, vaults[0].address);
    const newBal = await vaults[0].balanceOf(alice.address);
    expect(newBal).to.gt(bal);
    const newRewardBal = await vaults[0].balanceOf(rewardAddr);
    expect(newRewardBal).to.equal(0);
  })


  ////////////////////////////////
  // Vault 1: ERC721, Allowlist //
  ////////////////////////////////

  it("Should allow vault creation with allowlist", async () => {
    // TODO
  });
});
