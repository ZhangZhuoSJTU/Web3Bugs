const { expect } = require("chai");
const { expectRevert } = require("../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../addresses/rinkeby.json");

const BASE = BigNumber.from(10).pow(18);
const PERC1_FEE = BASE.div(10);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice, bob;
let nftx;
let staking;
let eligManager;
let erc721;
let erc1155;
const vaults = [];

const numLoops = 10;
const eligibleUntil = 6;
const numTokenIds = numLoops * 2;

describe("Main Eligibility", function () {
  before("Setup with Eligibility", async () => {
    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];
    bob = signers[2];

    const Vault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    const vault = await Vault.deploy();
    await vault.deployed();

    const MockFeeDistributor = await ethers.getContractFactory(
      "MockDistributor"
    );
    const mockFeeDistrib = await upgrades.deployProxy(
      MockFeeDistributor,
      [],
      {
        initializer: "__MockDistributor_init",
      }
    );
    await mockFeeDistrib.deployed();

    const Nftx = await ethers.getContractFactory("NFTXVaultFactoryUpgradeable");
    nftx = await upgrades.deployProxy(
      Nftx,
      [vault.address, mockFeeDistrib.address],
      {
        initializer: "__NFTXVaultFactory_init",
        unsafeAllow: 'delegatecall'
      }
    );
    await nftx.deployed();

    const Elig = await ethers.getContractFactory("NFTXEligibilityManager");
    eligManager = await upgrades.deployProxy(
      Elig,
      [],
      {
        initializer: "__NFTXEligibilityManager_init",
        unsafeAllow: 'delegatecall'
      }
    );
    await eligManager.deployed();

    await nftx.setEligibilityManager(eligManager.address)

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
      false
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
    await vaults[0].connect(primary).setVaultFeatures(true, true, true, true, true);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(true);
    expect(await vaults[0].enableTargetRedeem()).to.eq(true);
  });

  it("Should set fees to 0", async () => {
    await vaults[0].connect(primary).setFees(0, 0, 0, 0, 0);
    expect(await vaults[0].mintFee()).to.eq(0);
    expect(await vaults[0].randomRedeemFee()).to.eq(0);
    expect(await vaults[0].targetRedeemFee()).to.eq(0);
  });

  it("Should deploy a list module and add", async () => {
    const ListElig = await ethers.getContractFactory("NFTXListEligibility");
    const listElig = await ListElig.deploy();
    await listElig.deployed();
    await eligManager.addModule(listElig.address);
    let module = await eligManager.modules(0);
    expect(module.implementation).to.equal(listElig.address);
    expect(module.name).to.equal("List");
    expect(module.targetAsset).to.equal(zeroAddr);
  });

  it("Should reject minting all of alices NFTs", async () => {
    for (let i = 0; i < numLoops; i++) {
      const tokenId = i;
      await erc721.transferFrom(primary.address, alice.address, tokenId);
      expect(await erc721.balanceOf(alice.address)).to.equal(i+1);
      await erc721.connect(alice).approve(vaults[0].address, tokenId);
      await expectRevert(vaults[0].connect(alice).mint([tokenId], [1]));
    }
  });

  it("Should allow deploying and assigning a List module", async () => {
    let decoder = ethers.utils.defaultAbiCoder;
    let encoded = decoder.encode(["uint256[]"], [[0, 1, 2, 3, 4, 5]]);
    await vaults[0].connect(primary).deployEligibilityStorage(0, encoded);
  });

  it("Should allow minting one at a time by alice", async () => {
    for (let i = 0; i < eligibleUntil; i++) {
      const tokenId = i;
      expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - i);
      await erc721.connect(alice).approve(vaults[0].address, tokenId);
      await vaults[0].connect(alice).mint([tokenId], [1]);
      expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - i - 1);
      expect(await erc721.balanceOf(vaults[0].address)).to.equal(i + 1);
      expect(await vaults[0].balanceOf(alice.address)).to.equal(
        BASE.mul(i + 1)
      );
    }
  });

  it("Should not allow minting out of eligibility by alice", async () => {
    for (let i = 6; i < numLoops; i++) {
      const tokenId = i;
      expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - eligibleUntil);
      await erc721.connect(alice).approve(vaults[0].address, tokenId);
      await expectRevert(vaults[0].connect(alice).mint([tokenId], [1]));
    }
  });

  /////////////////////////////
  // Vault 1: ERC1155, Basic //
  /////////////////////////////

  it("Should allow ERC1155 vault creation", async () => {
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

  it("Should allow all ERC1155 vault features", async () => {
    await vaults[1].connect(primary).setVaultFeatures(true, true, true, true, true);
    expect(await vaults[1].enableMint()).to.eq(true);
    expect(await vaults[1].enableRandomRedeem()).to.eq(true);
    expect(await vaults[1].enableTargetRedeem()).to.eq(true);
  });

  it("Should allow ERC1155 with fee minting one at a time by alice", async () => {
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
});