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
let erc1155;
const vaults = [];

const numLoops = 10;
const numTokenIds = numLoops * 2;

describe("Main", function () {
  before("Setup", async () => {
    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];
    bob = signers[2];

    const StakingProvider = await ethers.getContractFactory(
      "MockStakingProvider"
    );
    const provider = await StakingProvider.deploy();
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
    const feeDistrib = await upgrades.deployProxy(
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

    const Erc1155 = await ethers.getContractFactory("ERC1155");
    erc1155 = await Erc1155.deploy("");
    await erc1155.deployed();

    for (let i = 0; i < numTokenIds; i++) {
      await erc721.publicMint(primary.address, i);
      await erc1155.publicMint(primary.address, i, 1);
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

  it("Should allow minting in bulk by bob", async () => {
    const tokenIds = [];
    for (let i = 0; i < numLoops; i++) {
      const tokenId = numLoops + i;
      await erc721.transferFrom(primary.address, bob.address, tokenId);
      await erc721.connect(bob).approve(vaults[0].address, tokenId);
      tokenIds.push(tokenId);
    }
    expect(await erc721.balanceOf(bob.address)).to.equal(numLoops);
    await vaults[0].connect(bob).mint(
      tokenIds,
      tokenIds.map(() => 1)
    );
    expect(await erc721.balanceOf(bob.address)).to.equal(0);
    expect(await erc721.balanceOf(vaults[0].address)).to.equal(numLoops * 2);
    expect(await vaults[0].balanceOf(bob.address)).to.equal(BASE.mul(numLoops));
  });

  it("Should allow redeeming one at a time by alice", async () => {
    expect(await erc721.balanceOf(alice.address)).to.equal(0);
    for (let i = 0; i < numLoops; i++) {
      expect(await erc721.balanceOf(alice.address)).to.equal(i);
      await vaults[0].connect(alice).approve(alice.address, BASE);
      await vaults[0].connect(alice).redeem(1, []);
      expect(await erc721.balanceOf(alice.address)).to.equal(i + 1);
      expect(await erc721.balanceOf(vaults[0].address)).to.equal(
        numLoops * 2 - (i + 1)
      );
      expect(await vaults[0].balanceOf(alice.address)).to.equal(
        BASE.mul(numLoops - (i + 1))
      );
    }
  });

  it("Should allow redeeming in bulk by bob", async () => {
    expect(await erc721.balanceOf(bob.address)).to.equal(0);
    await vaults[0].connect(bob).approve(bob.address, BASE.mul(10));
    await vaults[0].connect(bob).redeem(numLoops, []);
    expect(await erc721.balanceOf(bob.address)).to.equal(numLoops);
    expect(await erc721.balanceOf(vaults[0].address)).to.equal(0);
    expect(await vaults[0].balanceOf(bob.address)).to.equal(0);
  });

  it("[refresh NFT owner]", async () => {
    for (let i = 0; i < numLoops; i++) {
      const ownerAddr = await erc721.ownerOf(i);
      const owner = [primary, alice, bob].find((a) => a.address === ownerAddr);
      await erc721
        .connect(owner)
        .transferFrom(owner.address, primary.address, i);
    }
  });

  /////////////////////////////
  // Vault 1: ERC1155, Basic //
  /////////////////////////////

  it("Should allow vault creation", async () => {
    const response = await nftx.createVault(
      "CryptoNinjas",
      "NINJA",
      erc1155.address,
      true,
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
    await vaults[1].connect(primary).setVaultFeatures(true, true, true, true);
    expect(await vaults[1].enableMint()).to.eq(true);
    expect(await vaults[1].enableRedeem()).to.eq(true);
    expect(await vaults[1].enableDirectRedeem()).to.eq(true);
    expect(await vaults[1].enableSwap()).to.eq(true);
  });

  it("Should allow minting one at a time by alice", async () => {
    for (let i = 0; i < numLoops; i++) {
      const tokenId = i;
      await erc1155.safeTransferFrom(
        primary.address,
        alice.address,
        tokenId,
        1,
        []
      );
      expect(await erc1155.balanceOf(alice.address, tokenId)).to.equal(1);
      await erc1155.connect(alice).setApprovalForAll(vaults[1].address, true);
      await vaults[1].connect(alice).mint([tokenId], [1]);
      expect(await erc1155.balanceOf(alice.address, tokenId)).to.equal(0);
      expect(await erc1155.balanceOf(vaults[1].address, tokenId)).to.equal(1);
    }
  });

  it("Should allow minting in bulk by bob", async () => {
    const tokenIds = [];
    for (let i = 0; i < numLoops; i++) {
      const tokenId = numLoops + i;
      await erc1155.safeTransferFrom(
        primary.address,
        bob.address,
        tokenId,
        1,
        []
      );
      tokenIds.push(tokenId);
      expect(await erc1155.balanceOf(bob.address, tokenId)).to.equal(1);
    }

    await erc1155.connect(bob).setApprovalForAll(vaults[1].address, true);
    await vaults[1].connect(bob).mint(
      tokenIds,
      tokenIds.map(() => 1)
    );

    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i];
      expect(await erc1155.balanceOf(bob.address, tokenId)).to.equal(0);
      expect(await erc1155.balanceOf(vaults[1].address, tokenId)).to.equal(1);
    }
    expect(await vaults[1].balanceOf(bob.address)).to.equal(BASE.mul(numLoops));
  });

  it("Should allow redeeming one at a time by alice", async () => {
    for (let i = 0; i < numLoops; i++) {
      await vaults[1].connect(alice).approve(alice.address, BASE);
      await vaults[1].connect(alice).redeem(1, []);
      expect(await vaults[1].balanceOf(alice.address)).to.equal(
        BASE.mul(numLoops - (i + 1))
      );
    }
  });
});
