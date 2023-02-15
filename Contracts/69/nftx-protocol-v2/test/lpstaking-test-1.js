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
      unsafeAllow: 'delegatecall'
    });
    await staking.deployed();

    const Vault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    const vault = await Vault.deploy();
    await vault.deployed();

    const FeeDistributor = await ethers.getContractFactory(
      "NFTXSimpleFeeDistributor"
    );
    feeDistrib = await upgrades.deployProxy(
      FeeDistributor,
      [staking.address, notZeroAddr],
      {
        initializer: "__SimpleFeeDistributor__init__",
        unsafeAllow: 'delegatecall'
      }
    );
    await feeDistrib.deployed();

    const Nftx = await ethers.getContractFactory("NFTXVaultFactoryUpgradeable");
    nftx = await upgrades.deployProxy(
      Nftx,
      [vault.address, feeDistrib.address],
      {
        initializer: "__NFTXVaultFactory_init",
        unsafeAllow: 'delegatecall'
      }
    );
    await nftx.deployed();

    await feeDistrib.connect(primary).setNFTXVaultFactory(nftx.address);
    await staking.connect(primary).setNFTXVaultFactory(nftx.address);

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

  it("Should disable minting feature", async () => {
    await vaults[0].connect(primary).setVaultFeatures(false, false, false, false, false);
    expect(await vaults[0].enableMint()).to.eq(false);
    expect(await vaults[0].enableRandomRedeem()).to.eq(false);
    expect(await vaults[0].enableTargetRedeem()).to.eq(false);
    expect(await vaults[0].enableRandomSwap()).to.eq(false);
    expect(await vaults[0].enableTargetSwap()).to.eq(false);
  });

  it("Should not allow minting", async () => {
    const tokenId = 0;
    await erc721.transferFrom(primary.address, alice.address, tokenId);
    expect(await erc721.balanceOf(alice.address)).to.equal(1);
    await erc721.connect(alice).approve(vaults[0].address, tokenId);
    await expectRevert(vaults[0].connect(alice).mint([tokenId], [1]));
    expect(await erc721.balanceOf(alice.address)).to.equal(1);
    expect(await erc721.balanceOf(vaults[0].address)).to.equal(0);
    expect(await vaults[0].balanceOf(alice.address)).to.equal(0);
  })

  it("Should enable minting feature", async () => {
    await vaults[0].connect(primary).setVaultFeatures(true, false, false, false, false);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(false);
    expect(await vaults[0].enableTargetRedeem()).to.eq(false);
    expect(await vaults[0].enableRandomSwap()).to.eq(false);
    expect(await vaults[0].enableTargetSwap()).to.eq(false);
  });

  it("Should set fees to 0", async () => {
    await vaults[0].connect(primary).setFees(0, 0, 0, 0, 0);
    expect(await vaults[0].mintFee()).to.eq(0);
    expect(await vaults[0].randomRedeemFee()).to.eq(0);
    expect(await vaults[0].targetRedeemFee()).to.eq(0);
  });

  it("Should allow minting one at a time by alice after enabling", async () => {
    for (let i = 0; i < numLoops-2; i++) {
      const tokenId = i;
      if (tokenId != 0) 
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
    await vaults[0].connect(primary).setFees(fee, fee, fee, fee, fee);
    expect(await vaults[0].mintFee()).to.equal(fee);
    expect(await vaults[0].randomRedeemFee()).to.equal(fee);
    expect(await vaults[0].targetRedeemFee()).to.equal(fee);
  })

  it("Should allow adding arbitrary receivers to distributor", async () => { 
    await feeDistrib.connect(primary).addReceiver(ethers.utils.parseEther("0.2"), bob.address, false);
    const receiver = await feeDistrib.feeReceivers(1);
    expect(receiver.receiver).to.equal(bob.address);
    expect(receiver.isContract).to.equal(false);
    const bal = await vaults[0].balanceOf(bob.address);
    expect(bal).to.equal(0)
  })

  it("Should allow minting one at a time by alice after enabling", async () => {
    let ii = 0;
    for (let i = numLoops-2; i < numLoops-1; i++) {
      const tokenId = i;
      ii++
      if (tokenId != 0) 
        await erc721.transferFrom(primary.address, alice.address, tokenId);
      expect(await erc721.balanceOf(alice.address)).to.equal(1);
      await erc721.connect(alice).approve(vaults[0].address, tokenId);
      await vaults[0].connect(alice).mint([tokenId], [1]);
      expect(await erc721.balanceOf(alice.address)).to.equal(0);
      expect(await erc721.balanceOf(vaults[0].address)).to.equal(i + 1);
      expect(await vaults[0].balanceOf(alice.address)).to.equal(
        BASE.mul(i + 1).sub(BASE.div(10).mul(ii))
      );
    }
  });

  it("Should distribute leftover rewards to other receiver", async () => {
    const bal = await vaults[0].balanceOf(bob.address);
    expect(bal).to.equal(BASE.div(10));
  })

  it("Should not allow staking into depositFor", async () => {
    const bal = await vaults[0].balanceOf(alice.address);
    const depositBal = bal.div(100);
    const id = await vaults[0].vaultId();
    await vaults[0].connect(alice).approve(staking.address, depositBal);
    await expectRevert(staking.connect(alice).timelockDepositFor(id, alice.address, depositBal, 600));
  })

  it("Should allow staking into the fee distribution contract", async () => {
    const bal = await vaults[0].balanceOf(alice.address);
    const depositBal = bal.div(100);
    const id = await vaults[0].vaultId();
    await vaults[0].connect(alice).approve(staking.address, depositBal);
    await staking.connect(alice).deposit(id, depositBal);
    const newBal = await vaults[0].balanceOf(alice.address);
    expect(newBal).to.equal(bal.sub(depositBal));
    let distToken = await staking.newRewardDistributionToken(id)
    const rewardDist = await ethers.getContractAt("TimelockRewardDistributionTokenImpl", distToken);
    const total = await rewardDist.totalSupply();
    expect(total).to.equal(depositBal);
  })

  it("Should not allow direct redeeming", async () => {
    expect(await erc721.balanceOf(alice.address)).to.equal(0);
    await expectRevert(vaults[0].connect(alice).redeem(1, [0]), "NFTXVault: Random redeem not enabled");
    expect(await erc721.balanceOf(alice.address)).to.equal(0);
  })

  it("Should enable direct redeem feature", async () => {
    await vaults[0].connect(primary).setVaultFeatures(true, false, true, false, false);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(false);
    expect(await vaults[0].enableTargetRedeem()).to.eq(true);
    expect(await vaults[0].enableRandomSwap()).to.eq(false);
    expect(await vaults[0].enableTargetSwap()).to.eq(false);
  });

  it("Should allow direct redeeming one at a time by alice", async () => {
    const fee = BigNumber.from(10).pow(17);

    expect(await erc721.balanceOf(alice.address)).to.equal(0);
    for (let i = 0; i < numLoops-3; i++) {
      expect(await erc721.balanceOf(alice.address)).to.equal(i);
      await vaults[0].connect(alice).redeem(1, [i]);
      expect(await erc721.balanceOf(alice.address)).to.equal(i+1);
    }
  });

  it("Should distribute rewards properly to both receivers", async () => {
    const bal = await vaults[0].balanceOf(bob.address);
    expect(bal).to.equal(BASE.div(10).add(BASE.div(50).mul(numLoops-3)));
    const id = await vaults[0].vaultId();
    let distToken = await staking.newRewardDistributionToken(id)
    const bal2 = await vaults[0].balanceOf(distToken);
    expect(bal2).to.equal(BASE.mul(40).div(500).mul(numLoops-3));
  })

  it("Should not allow random redeeming", async () => {
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops-3);
    await expectRevert(vaults[0].connect(alice).redeem(1, []), "NFTXVault: Random redeem not enabled");
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops-3);
  })

  it("Should enable random redeem feature", async () => {
    await vaults[0].connect(primary).setVaultFeatures(true, true, false, false, false);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(true);
    expect(await vaults[0].enableTargetRedeem()).to.eq(false);
    expect(await vaults[0].enableRandomSwap()).to.eq(false);
    expect(await vaults[0].enableTargetSwap()).to.eq(false);
  });

  it("Should allow random redeeming", async () => {
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops-3);
    await vaults[0].connect(alice).redeem(1, []);
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops-2);
  })
  
  it("Should allow claiming from the staking contract", async () => {
    const id = await vaults[0].vaultId();
    await staking.connect(alice).claimRewards(id);
    const bal = await vaults[0].balanceOf(alice.address);
    expect(bal).to.gt(BASE.div(2));
  })

  it("Should distribute rewards to other receiver", async () => {
    const bal = await vaults[0].balanceOf(bob.address);
    expect(bal).to.gt(100000);
  })

  it("Should allow withdraw from the distribution contract", async () => {
    const id = await vaults[0].vaultId();
    const rewardAddr = await staking.newRewardDistributionToken(id);
    const rewardDistToken = await ethers.getContractAt("IERC20Upgradeable", rewardAddr);
    const bal = await rewardDistToken.balanceOf(alice.address);
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
    const rewardAddr = await staking.newRewardDistributionToken(id);
    const rewardToken = await ethers.getContractAt("IERC20Upgradeable", rewardAddr);
    const bal = await rewardToken.balanceOf(alice.address);
    await rewardToken.connect(alice).approve(staking.address, bal);
    await expectRevert(staking.connect(alice).withdraw(id, bal), "function call to a non-contract");
  })

  it("Should allow emergency withdrawing normally after change", async () => {
    const id = await vaults[0].vaultId();
    const rewardAddr = await staking.newRewardDistributionToken(id);
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
