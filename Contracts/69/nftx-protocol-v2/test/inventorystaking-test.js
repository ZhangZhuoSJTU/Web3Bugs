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
let inventoryStaking;
let erc721;
let feeDistrib;
let provider;
const vaults = [];

const numTokenIds = 20;
const numLoops = 10;

describe("Inventory Staking Cold Test", function () {
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

    const InventoryStaking = await ethers.getContractFactory("NFTXInventoryStaking");
    inventoryStaking = await upgrades.deployProxy(
      InventoryStaking,
      [nftx.address],
      {
        initializer: "__NFTXInventoryStaking_init",
        unsafeAllow: 'delegatecall'
      }
    );
    await inventoryStaking.deployed();

    await feeDistrib.connect(primary).setNFTXVaultFactory(nftx.address);
    await feeDistrib.connect(primary).setInventoryStakingAddress(inventoryStaking.address);
    await staking.connect(primary).setNFTXVaultFactory(nftx.address);
    await inventoryStaking.connect(primary).setNFTXVaultFactory(nftx.address);


    let Zap = await ethers.getContractFactory("NFTXStakingZap");
    zap = await Zap.deploy(
      nftx.address,
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F" /* Sushi Router */
    );
    await zap.deployed();
    await nftx.connect(primary).setZapContract(zap.address);
    await nftx.connect(primary).setFeeExclusion(zap.address, true);

    await feeDistrib.addReceiver(ethers.utils.parseEther("0.8"), inventoryStaking.address, true);

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

  it("Should enable minting feature", async () => {
    await vaults[0].connect(primary).setVaultFeatures(true, false, false, false, false);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(false);
    expect(await vaults[0].enableTargetRedeem()).to.eq(false);
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

  let depositBal;
  let oldPrice;
  it("Should allow staking into the inventory staking contract", async () => {
    const bal = await vaults[0].balanceOf(alice.address);
    depositBal = bal.div(100);
    const id = await vaults[0].vaultId();
    await vaults[0].connect(alice).approve(inventoryStaking.address, depositBal);
    await inventoryStaking.connect(alice).deposit(id, depositBal);
    const newBal = await vaults[0].balanceOf(alice.address);
    expect(newBal).to.equal(bal.sub(depositBal));

    let xToken = await inventoryStaking.vaultXToken(id)
    const xTokenContract = await ethers.getContractAt("XTokenUpgradeable", xToken);
    const total = await xTokenContract.totalSupply();
    expect(total).to.equal(depositBal);

    oldPrice = await inventoryStaking.xTokenShareValue(await vaults[0].vaultId());
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
        BASE.mul(i + 1).sub(BASE.div(10).mul(ii)).sub(depositBal)
      );
    }
  });

  let newBal;
  it("Should distribute leftover rewards to other receiver", async () => {
    newBal = await vaults[0].balanceOf(await inventoryStaking.vaultXToken(await vaults[0].vaultId()));
    expect(newBal).to.equal(BASE.div(10).add(depositBal));
  })

  it("Should update share price of xToken", async () => {
    let newPrice = await inventoryStaking.xTokenShareValue(await vaults[0].vaultId());
    expect(newPrice).to.equal(oldPrice.mul(newBal.mul(100).div(depositBal)).div(100))
  })

  it("Should withdraw and include rewards", async () => {
    const id = await vaults[0].vaultId();
    let xToken = await inventoryStaking.vaultXToken(id)
    const xTokenContract = await ethers.getContractAt("XTokenUpgradeable", xToken);
    await inventoryStaking.connect(alice).withdraw(id, await xTokenContract.balanceOf(alice.getAddress()))
  })

  it("Should enable direct redeem feature", async () => {
    await vaults[0].connect(primary).setVaultFeatures(true, false, true, false, false);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(false);
    expect(await vaults[0].enableTargetRedeem()).to.eq(true);
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
});
