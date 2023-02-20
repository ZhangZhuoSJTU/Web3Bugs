const { expect } = require("chai");
const { expectRevert, expectException } = require("../../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades, network } = require("hardhat");

const addresses = require("../../addresses/rinkeby.json");
const { zeroPad } = require("ethers/lib/utils");

const BASE = BigNumber.from(10).pow(18);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice, bob, kiwi;
let dao;
let founder;
let dev;

let nftx;
let zap;
let lpStaking;
let inventoryStaking;
let erc721;
let feeDistrib;
let controller;
const vaults = [];

describe("Mainnet Inventory Staking Test", function () {
  before("Setup", async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
            blockNumber: 13727800,
          },
        },
      ],
    });

    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];
    bob = signers[2];

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x08D816526BdC9d077DD685Bd9FA49F58A5Ab8e48"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x40d73df4f99bae688ce3c23a01022224fe16c7b2"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8F217D5cCCd08fD9dCe24D6d42AbA2BB4fF4785B"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8F217D5cCCd08fD9dCe24D6d42AbA2BB4fF4785B"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xDEA9196Dcdd2173D6E369c2AcC0faCc83fD9346a"],
    });
    
    kiwi = await ethers.provider.getSigner(
      "0x08D816526BdC9d077DD685Bd9FA49F58A5Ab8e48"
    );
    dao = await ethers.provider.getSigner(
      "0x40d73df4f99bae688ce3c23a01022224fe16c7b2"
    );
    founder = await ethers.provider.getSigner(
      "0x8F217D5cCCd08fD9dCe24D6d42AbA2BB4fF4785B"
    );
    dev = await ethers.provider.getSigner(
      "0xDEA9196Dcdd2173D6E369c2AcC0faCc83fD9346a"
    );

    nftx = await ethers.getContractAt(
      "NFTXVaultFactoryUpgradeable",
      "0xBE86f647b167567525cCAAfcd6f881F1Ee558216"
    );
    lpStaking = await ethers.getContractAt(
      "NFTXLPStaking",
      "0x688c3E4658B5367da06fd629E41879beaB538E37"
    );
    controller = await ethers.getContractAt(
      "ProxyController",
      "0x4333d66Ec59762D1626Ec102d7700E64610437Df"
    );
    feeDistrib = await ethers.getContractAt(
      "NFTXSimpleFeeDistributor",
      "0xFD8a76dC204e461dB5da4f38687AdC9CC5ae4a86"
    );

  });

  it("Should upgrade the Fee Distributor", async () => {
    let NewFeeDistro = await ethers.getContractFactory("NFTXSimpleFeeDistributor");
    let feeDistro = await NewFeeDistro.connect(alice).deploy();
    await feeDistro.deployed();
    let proxyAdmin = await ethers.getContractAt("ProxyControllerSimple", "0x8e7488E4cEC0381e7Ac758234E1A8A793bE2fF30");
    await proxyAdmin.connect(dev).upgradeProxyTo(feeDistro.address, {gasLimit: 100000});
  });

  it("Should deploy inventory staking", async () => {
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
    await feeDistrib.connect(dev).setInventoryStakingAddress(inventoryStaking.address, {gasLimit: 100000})
    await feeDistrib.connect(dev).addReceiver(BASE.div(5), inventoryStaking.address, true, {gasLimit: 100000})
  })

  it("Should deploy zap", async () => {
    let Zap = await ethers.getContractFactory("NFTXStakingZap");

    zap = await Zap.deploy(
      "0xBE86f647b167567525cCAAfcd6f881F1Ee558216",
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F" /* Sushi Router */
    );
    await zap.deployed();
    await nftx.connect(dao).setFeeExclusion(zap.address, true);
  })

  it("Should set state fields", async () => {
    expect(await zap.nftxFactory()).to.equal(nftx.address);
    expect(await zap.lpStaking()).to.equal(lpStaking.address);
    expect(await zap.inventoryStaking()).to.equal(inventoryStaking.address);
    expect(await zap.sushiRouter()).to.equal(
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
    );
  });

  let depositBal;
  it("Should inventory stake with 721", async () => {
    vault = await ethers.getContractAt(
      "NFTXVaultUpgradeable",
      "0x114f1388fab456c4ba31b1850b244eedcd024136"
    );
    vaults.push(vault);
    const assetAddress = await vaults[0].assetAddress();
    const coolCats = await ethers.getContractAt("ERC721", assetAddress);
    await coolCats.connect(kiwi).setApprovalForAll(zap.address, true);

    await zap.connect(kiwi).provideInventory721(31, [6416,2271])
    depositBal = BASE.mul(2);
  });

  it("Should have locked balance", async () => {
    let xTokenAddr = await inventoryStaking.vaultXToken(31);
    let xToken = await ethers.getContractAt("XTokenUpgradeable", xTokenAddr)
    expect(await inventoryStaking.balanceOf(31, kiwi.getAddress())).to.equal(
      await xToken.balanceOf(kiwi.getAddress())
    );
    const locked = await xToken.timelockUntil(kiwi.getAddress());
    expect(locked).to.be.gt(1625729248);
  });

  it("Should mint to generate some rewards", async () => {
    let xTokenAddr = await inventoryStaking.vaultXToken(31);
    let oldBal = await vaults[0].balanceOf(xTokenAddr);
    await vaults[0].connect(kiwi).mint([7984], [1]);
    let newBal = await vaults[0].balanceOf(xTokenAddr);
    expect(newBal).to.be.gt(oldBal);
    expect(newBal.sub(oldBal)).to.equal(BASE.div(10).div(5))
  })

  it("Should not allow to withdraw locked tokens before lock", async () => {
    await expectException(inventoryStaking.connect(kiwi).withdraw(31, await inventoryStaking.balanceOf(31, kiwi.getAddress())), "User locked");
  });

  it("Should pass some time", async () => {
    await ethers.provider.send("evm_increaseTime",  [7*24*60*60]);
    await ethers.provider.send("evm_mine", []);
  });

  it("Should allow withdrawing after unlocking", async () => {
    let oldBal = await vaults[0].balanceOf(kiwi.getAddress());
    await inventoryStaking.connect(kiwi).withdraw(31, await inventoryStaking.balanceOf(31, kiwi.getAddress()))
    let newBal = await vaults[0].balanceOf(kiwi.getAddress());
    expect(newBal).to.not.equal(oldBal);
  })
  

  let noPool1155NFT;
  let nft1155Id;
  it("Should create a vault for an ERC1155 token", async () => {
    let ERC1155 = await ethers.getContractFactory("ERC1155");
    noPool1155NFT = await ERC1155.deploy("");
    await noPool1155NFT.deployed();
    const response = await nftx.createVault("FAKE", "FAKE", noPool1155NFT.address, true, true);
    const receipt = await response.wait(0);
    nft1155Id = receipt.events
      .find((elem) => elem.event === "NewVault")
      .args[0].toString();
    const vaultAddr = await nftx.vault(nft1155Id);
    await noPool1155NFT.connect(kiwi).publicMintBatch(kiwi.getAddress(), [0, 1, 2, 3], [10, 10, 10, 5]);
    let new1155Vault = await ethers.getContractAt("NFTXVaultUpgradeable", vaultAddr);
    vaults.push(new1155Vault)
  });

  let depositBal1155;
  it("Should inventory stake with 1155", async () => {
    await noPool1155NFT.connect(kiwi).setApprovalForAll(zap.address, true);
    await zap.connect(kiwi).provideInventory1155(nft1155Id, [0, 1, 2], [5, 5, 5])
    depositBal1155 = BASE.mul(15);
  });

  it("Should add mint some for 1155", async () => {
    let oldShareValue = await inventoryStaking.xTokenShareValue(nft1155Id);
    await noPool1155NFT.connect(kiwi).setApprovalForAll(vaults[1].address, true);
    await vaults[1].connect(kiwi).mint([3], [4])
    let newShareValue = await inventoryStaking.xTokenShareValue(nft1155Id);
    expect(newShareValue).to.be.gt(oldShareValue);
  });

  it("Should pass some time", async () => {
    await ethers.provider.send("evm_increaseTime",  [7*24*60*60]);
    await ethers.provider.send("evm_mine", []);
  });
});
