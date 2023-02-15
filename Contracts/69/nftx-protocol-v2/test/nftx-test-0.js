const { expect } = require("chai");
const { expectRevert, expectException } = require("../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../addresses/rinkeby.json");

const BASE = BigNumber.from(10).pow(18);
const PERC25_FEE = BASE.div(40);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice, bob;
let nftx;
let staking;
let erc721;
let erc1155;
let flashBorrower;
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
      unsafeAllow: 'delegatecall'
    });
    await staking.deployed();

    const Vault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    const vault = await Vault.deploy();
    await vault.deployed();

    const FeeDistributor = await ethers.getContractFactory(
      "NFTXSimpleFeeDistributor"
    );
    const feeDistrib = await upgrades.deployProxy(
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

    const Erc1155 = await ethers.getContractFactory("ERC1155");
    erc1155 = await Erc1155.deploy("");
    await erc1155.deployed();

    for (let i = 0; i < numTokenIds; i++) {
      await erc721.publicMint(primary.address, i);
      await erc1155.publicMint(primary.address, i, 1);
    }

    const FlashBorrower = await ethers.getContractFactory("FlashBorrower");
    flashBorrower = await FlashBorrower.deploy();
    await flashBorrower.deployed();
  });

  ////////////////////////////
  // Vault 0: ERC721, Basic //
  ////////////////////////////

  it("Should set alice as guardian", async () => {
    await nftx.setIsGuardian(alice.address, true);
  });

  it("Should set excluded from fees", async () => {
    await nftx.setFeeExclusion(alice.address, true);
    expect(await nftx.excludedFromFees(alice.address)).to.be.equal(true)
    await nftx.setFeeExclusion(alice.address, false);
    expect(await nftx.excludedFromFees(alice.address)).to.be.equal(false)
  });

  it("Should allow alice as guardian to pause vault creation", async () => {
    await nftx.connect(alice).pause(0);
    expect(await nftx.isPaused(0)).to.equal(true);
  });

  it("Should not allow vault creation after pausing", async () => {
    let respPromise = nftx
      .connect(alice)
      .createVault("CryptoPandas", "PANDA", erc721.address, false, true);
    await expectRevert(respPromise);
  });

  it("Should allow owner to unpause vault creation", async () => {
    await nftx.connect(primary).unpause(0);
    expect(await nftx.isPaused(0)).to.equal(false);
  });

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
    await vaults[0].connect(primary).setVaultFeatures(true, true, true, true, true);
    expect(await vaults[0].enableMint()).to.eq(true);
    expect(await vaults[0].enableRandomRedeem()).to.eq(true);
    expect(await vaults[0].enableTargetRedeem()).to.eq(true);
    expect(await vaults[0].enableRandomSwap()).to.eq(true);
    expect(await vaults[0].enableTargetSwap()).to.eq(true);
  });

  it("Should set fees to 0", async () => {
    await vaults[0].connect(primary).setFees(0, 0, 0, 0, 0);
    expect(await vaults[0].mintFee()).to.eq(0);
    expect(await vaults[0].randomRedeemFee()).to.eq(0);
    expect(await vaults[0].targetRedeemFee()).to.eq(0);
    expect(await vaults[0].randomSwapFee()).to.eq(0);
    expect(await vaults[0].targetSwapFee()).to.eq(0);
  });

  it("Should allow changing the metadata", async () => {
    expect(await vaults[0].name()).to.eq("CryptoPandas");
    expect(await vaults[0].symbol()).to.eq("PANDA");
    await vaults[0]
      .connect(primary)
      .setVaultMetadata("TESTPANDA", "TESTPANDA NFT");
    expect(await vaults[0].name()).to.eq("TESTPANDA");
    expect(await vaults[0].symbol()).to.eq("TESTPANDA NFT");
  });

  it("Should allow alice as guardian to pause minting", async () => {
    await nftx.connect(alice).pause(1);
  });

  it("Should not allow minting after pausing", async () => {
    const tokenId = 0;
    await erc721.transferFrom(primary.address, alice.address, tokenId);
    expect(await erc721.balanceOf(alice.address)).to.equal(1);
    await erc721.connect(alice).approve(vaults[0].address, tokenId);
    await expectRevert(vaults[0].connect(alice).mint([tokenId], [1]));
    expect(await erc721.balanceOf(alice.address)).to.equal(1);
    expect(await erc721.balanceOf(vaults[0].address)).to.equal(0);
    expect(await vaults[0].balanceOf(alice.address)).to.equal(0);
    await erc721
      .connect(alice)
      .transferFrom(alice.address, primary.address, tokenId);
  });

  it("Should not allow guardian to unpause", async () => {
    await expectRevert(nftx.connect(alice).unpause(1));
    expect(await nftx.isPaused(1)).to.equal(true);
  });

  it("Should allow owner to unpause minting", async () => {
    await nftx.connect(primary).unpause(1);
    expect(await nftx.isPaused(1)).to.equal(false);
  });

  it("Should allow minting one at a time through pushing by alice", async () => {
    for (let i = 0; i < numLoops; i++) {
      const tokenId = i;
      await erc721.transferFrom(primary.address, vaults[0].address, tokenId);
      await vaults[0].connect(alice).mint([tokenId], [1]);
      // Should reject minting again when pushing.
      await expectException(vaults[0].connect(alice).mint([tokenId], [1]), "Trying to use an owned NFT")
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

  it("Should properly return list of items", async () => {
    let list = await vaults[0].allHoldings();
    expect(list.length).to.equal(await vaults[0].totalHoldings());
  });

  it("Should allow alice as guardian to pause redeeming", async () => {
    await nftx.connect(alice).pause(2);
  });

  it("Should not allow redeeming by bob once paused", async () => {
    await expectRevert(vaults[0].connect(bob).redeem(numLoops, []));
  });

  it("Should allow owner to unpause redeeming", async () => {
    await nftx.connect(primary).unpause(2);
    expect(await nftx.isPaused(2)).to.equal(false);
  });

  it("Should allow redeeming one at a time by alice", async () => {
    expect(await erc721.balanceOf(alice.address)).to.equal(0);
    for (let i = 0; i < numLoops - 1; i++) {
      expect(await erc721.balanceOf(alice.address)).to.equal(i);
      await vaults[0].connect(alice).redeem(1, [i]);
      expect(await erc721.balanceOf(alice.address)).to.equal(i + 1);
      expect(await erc721.balanceOf(vaults[0].address)).to.equal(
        numLoops * 2 - (i + 1)
      );
      expect(await vaults[0].balanceOf(alice.address)).to.equal(
        BASE.mul(numLoops - (i + 1))
      );
    }
  });

  let firstSwapId = numLoops - 4;
  let swapId2;
  it("Should allow me to swap ERC721", async () => {
    swapId2 = await vaults[0].nftIdAt(0);
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - 1);
    await erc721.connect(alice).approve(vaults[0].address, firstSwapId);
    await vaults[0].connect(alice).swap([firstSwapId], [1], [swapId2]);
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - 1);
  });

  it("Should allow me to swap random ERC721", async () => {
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - 1);
    await erc721.connect(alice).approve(vaults[0].address, swapId2);
    await vaults[0].connect(alice).swap([swapId2], [1], []);
    expect(await erc721.balanceOf(alice.address)).to.equal(numLoops - 1);
  });

  it("Should allow redeeming in bulk by bob", async () => {
    expect(await erc721.balanceOf(bob.address)).to.equal(0);
    await vaults[0].connect(bob).redeem(numLoops, []);
    expect(await erc721.balanceOf(bob.address)).to.equal(numLoops);
    expect(await erc721.balanceOf(vaults[0].address)).to.equal(1);
    expect(await vaults[0].balanceOf(bob.address)).to.equal(0);
  });

  it("[refresh NFT owner]", async () => {
    for (let i = 0; i < numLoops; i++) {
      const ownerAddr = await erc721.ownerOf(i);
      const owner = [alice, bob].find((a) => a.address === ownerAddr);
      if (owner == null) {
        continue;
      }
      await erc721
        .connect(owner)
        .transferFrom(owner.address, primary.address, i);
    }
  });

  it("Should let flash loan borrow and pay back", async () => {
    await flashBorrower.flashBorrow(
      vaults[0].address,
      vaults[0].address,
      BASE.mul(10000000000000)
    );
    expect(await vaults[0].balanceOf(flashBorrower.address)).to.equal(0);
  });

  it("Shouldnt let flash loan steal funds", async () => {
    let tx = flashBorrower.flashBorrowAndSteal(
      vaults[0].address,
      vaults[0].address,
      BASE.mul(10000000000000)
    );
    await expectRevert(tx);
    expect(await vaults[0].balanceOf(flashBorrower.address)).to.equal(0);
  });

  it("Shouldnt let flash loan reenter and steal funds", async () => {
    await flashBorrower.flashBorrowAndReenter(
      vaults[0].address,
      vaults[0].address,
      BASE.mul(10000000000000)
    );
    expect(await vaults[0].balanceOf(flashBorrower.address)).to.equal(0);
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
    expect(await vaults[1].enableRandomSwap()).to.eq(true);
    expect(await vaults[1].enableTargetSwap()).to.eq(true);
  });

  it("Should set fees to 0", async () => {
    let perc25 = ethers.utils.parseEther("0.025")
    await vaults[1].connect(primary).setFees(perc25, perc25, perc25, perc25, perc25);
    expect(await vaults[1].mintFee()).to.eq(perc25);
    expect(await vaults[1].randomRedeemFee()).to.eq(perc25);
    expect(await vaults[1].targetRedeemFee()).to.eq(perc25);
    expect(await vaults[1].randomSwapFee()).to.eq(perc25);
    expect(await vaults[1].targetSwapFee()).to.eq(perc25);
  });

  it("Should allow ERC1155 with fee minting one at a time by alice", async () => {
    for (let i = 0; i < numLoops-5; i++) {
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
  
  it("Should allow ERC1155 with fee minting one at a time by alice", async () => {
    for (let i = numLoops-5; i < numLoops; i++) {
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

  // Test default fee rate.
  it("Should allow ERC1155 minting with fee in bulk by bob", async () => {
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
    expect(await vaults[1].balanceOf(bob.address)).to.equal(
      BASE.mul(numLoops).sub(PERC25_FEE.mul(numLoops))
    );
  });

  it("Should allow ERC1155 target redeeming with fee one at a time by alice", async () => {
    for (let i = 0; i < numLoops - 2; i++) {
      await vaults[1].connect(alice).redeem(1, [i]);
      expect(await vaults[1].balanceOf(alice.address)).to.equal(
        BASE.mul(numLoops - (i + 1)).sub(PERC25_FEE.mul(i + numLoops + 1))
      );
    }
  });

  let swapId;
  it("Should allow me to swap ERC1155", async () => {
    swapId = await vaults[1].nftIdAt(0);
    expect(await erc1155.balanceOf(alice.address, numLoops - 6)).to.equal(1);
    expect(await erc1155.balanceOf(alice.address, swapId)).to.equal(0);
    await vaults[1].connect(alice).swap([numLoops - 6], [1], [swapId]);
    expect(await erc1155.balanceOf(alice.address, numLoops - 6)).to.equal(0);
    expect(await erc1155.balanceOf(alice.address, swapId)).to.equal(1);
  });

  it("Should allow upgrading the factory", async () => {
    const TestFactoryUpgrade = await ethers.getContractFactory(
      "TestFactoryUpgrade"
    );
    const testFactoryUpgrade = await TestFactoryUpgrade.deploy();
    await testFactoryUpgrade.deployed();
    const upgraded = await upgrades.upgradeProxy(
      nftx.address,
      TestFactoryUpgrade, {
        unsafeAllow: 'delegatecall'
      }
    );
    expect(await upgraded.isUpgraded()).to.equal(true);
  });

  it("Should allow me to swap random ERC1155", async () => {
    expect(await erc1155.balanceOf(alice.address, swapId)).to.equal(1);
    await vaults[1].connect(alice).swap([swapId], [1], []);
    expect(await erc1155.balanceOf(alice.address, swapId)).to.equal(0);
  });
  
  it("Should allow upgrading the vaults", async () => {
    const TestVaultUpgrade = await ethers.getContractFactory(
      "TestVaultUpgrade"
    );
    const testVaultUpgrade = await TestVaultUpgrade.deploy();
    await testVaultUpgrade.deployed();
    await nftx.upgradeChildTo(testVaultUpgrade.address);
    expect(await nftx.childImplementation()).to.equal(testVaultUpgrade.address);
    const newVault = await ethers.getContractAt(
      "TestVaultUpgrade",
      vaults[0].address
    );
    expect(await newVault.isUpgraded()).to.equal(true);
  });
});
