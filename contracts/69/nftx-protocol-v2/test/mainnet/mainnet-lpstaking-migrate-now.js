const { expect } = require("chai");
const { expectRevert, expectException } = require("../../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../../addresses/rinkeby.json");
const { zeroPad } = require("ethers/lib/utils");

const BASE = BigNumber.from(10).pow(18);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice, bob, kiwi;
let dev;
let dao;
let founder;

let nftx;
let zap, oldZap;
let staking;
let erc721;
let feeDistrib;
let controller;
let liveBugUser, liveZapLockUser;
const vaults = [];

describe("LP Staking Upgrade Migrate Now Test", function () {
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
      params: ["0x8B0C8c18993a31F57e60d81761F532Ef14633153"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8F217D5cCCd08fD9dCe24D6d42AbA2BB4fF4785B"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x08ceb8bba685ee708c9c4c65576837cbe19b9dea"],
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
    liveBugUser = await ethers.provider.getSigner(
      "0x8B0C8c18993a31F57e60d81761F532Ef14633153"
    );
    liveZapLockUser = await ethers.provider.getSigner(
      "0x08ceb8bba685ee708c9c4c65576837cbe19b9dea"
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
    staking = await ethers.getContractAt(
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

  it("Should exclude the zap from fees", async () => {
    await nftx.connect(dao).setFeeExclusion(zap.address, true);
  })

  it("Should set state fields", async () => {
    expect(await zap.nftxFactory()).to.equal(nftx.address);
    expect(await zap.lpStaking()).to.equal(staking.address);
    expect(await zap.sushiRouter()).to.equal(
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
    );
  });

  it("Should upgrade the LP staking", async () => {
    let NewStaking = await ethers.getContractFactory("NFTXLPStaking");
    let newStaking = await NewStaking.deploy();
    await newStaking.deployed();
    await controller.connect(dao).upgradeProxyTo(3, newStaking.address);
  });
  
  it("Should upgrade the factory and child", async () => {
    let NewFactory = await ethers.getContractFactory("NFTXVaultFactoryUpgradeable");
    let newFactory = await NewFactory.deploy();
    await newFactory.deployed();
    await controller.connect(dao).upgradeProxyTo(0, newFactory.address);
    let NewVault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    let newVault = await NewVault.deploy();
    await newVault.deployed();
    await nftx.connect(dao).upgradeChildTo(newVault.address);
  });

  // it("Should let v2 staker to migrate with claiming", async () => {
  //   let oldDisttoken = await staking.oldRewardDistributionToken(31);
  //   let address = await nftx.vault(31);
  //   let vaultToken = await ethers.getContractAt("IERC20Upgradeable", address)
  //   let oldBal = await vaultToken.balanceOf(kiwi.getAddress());
  //   let oldDistBal = await vaultToken.balanceOf(oldDisttoken);
  //   await staking.connect(kiwi).emergencyMigrate(31);
  //   let newBal = await vaultToken.balanceOf(kiwi.getAddress());
  //   let newDistBal = await vaultToken.balanceOf(oldDisttoken);
  //   expect(newBal).to.not.equal(oldBal);
  //   expect(newDistBal).to.not.equal(oldDistBal);
  // })

  it("Should add liquidity with 721 on existing pool", async () => {
    vault = await ethers.getContractAt(
      "NFTXVaultUpgradeable",
      "0x5ce188b44266c7b4bbc67afa3d16b2eb24ed1065"
    );
    vaults.push(vault);
    const assetAddress = await vaults[0].assetAddress();
    const uwus = await ethers.getContractAt("ERC721", assetAddress);
    await uwus.connect(kiwi).setApprovalForAll(zap.address, true);

    const router = await ethers.getContractAt("IUniswapV2Router01", "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    const pair = await ethers.getContractAt("IUniswapV2Pair", "0xfd52305d58f612aad5f7e5e331c7a0d77e352ec3")
    const {
      reserve0,
      reserve1,
    } = await pair.getReserves();
    const amountToLP = BASE.mul(2); //.sub(mintFee.mul(5)) no fee anymore
    const amountETH = await router.quote(amountToLP, reserve0, reserve1)
    await vaults[0].connect(kiwi).approve(zap.address, BASE.mul(1000))
    await zap.connect(kiwi).addLiquidity721ETH(179, [1746,7088], amountETH.sub(500), {value: amountETH});
    const postDepositBal = await pair.balanceOf(staking.address);
  });

  it("Should have locked balance", async () => {
    let newDisttoken = await staking.newRewardDistributionToken(179);
    let distToken = await ethers.getContractAt("IERC20Upgradeable", newDisttoken)
    const locked = await staking.lockedUntil(179, kiwi.getAddress());
    expect(await staking.lockedLPBalance(179, kiwi.getAddress())).to.equal(
      await distToken.balanceOf(kiwi.getAddress())
    );
    expect(locked).to.be.gt(1625729248);
  });

  it("Should mint to generate some rewards", async () => {
    let newDisttoken = await staking.newRewardDistributionToken(179);
    let oldBal = await vaults[0].balanceOf(newDisttoken);
    await vaults[0].connect(kiwi).mint([1750], [1]);
    let newBal = await vaults[0].balanceOf(newDisttoken);
    expect(oldBal).to.not.equal(newBal);
  })

  it("Should not allow to withdraw locked tokens before lock", async () => {
    await expectException(staking.connect(kiwi).exit(179), "User locked");
  });

  it("Should allow claiming rewards before unlocking", async () => {
    let oldBal = await vaults[0].balanceOf(kiwi.getAddress());
    await staking.connect(kiwi).claimRewards(179);
    let newBal = await vaults[0].balanceOf(kiwi.getAddress());
    expect(newBal).to.not.equal(oldBal);
  })
  
  it("Should pass some time", async () => {
    await ethers.provider.send("evm_increaseTime",  [24*60*60]);
    await ethers.provider.send("evm_mine", []);
  });


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

  it("Should add mint some for 1155", async () => {
    await noPool1155NFT.connect(kiwi).setApprovalForAll(zap.address, true);
    await vaults[1].connect(kiwi).approve(zap.address, BASE.mul(1000))
    await noPool1155NFT.connect(kiwi).setApprovalForAll(vaults[1].address, true);
    await vaults[1].connect(kiwi).mint([3], [4])
  });

  it("Should add liquidity with 1155 using weth with no pool for someone else", async () => {
    const amountETH = ethers.utils.parseEther("1.0");
    const WETH = await zap.WETH();
    const weth = await ethers.getContractAt("contracts/solidity/NFTXStakingZap.sol:IWETH", WETH);
    await weth.connect(kiwi).deposit({value: amountETH});

    const weth20 = await ethers.getContractAt("IERC20Upgradeable", WETH);
    await weth20.connect(kiwi).approve(zap.address, BASE.mul(500))
    await zap.connect(kiwi).addLiquidity1155To(nft1155Id, [0, 1, 2], [5, 5, 5], amountETH, amountETH, primary.getAddress())
  });

  it("Should add liquidity with 1155 an eth", async () => {
    const amountETH = ethers.utils.parseEther("1.0");
    await zap.connect(kiwi).addLiquidity1155ETH(nft1155Id, [0, 1, 2], [5, 5, 5], amountETH, {value: amountETH})
  });

  it("Should not allow to withdraw locked tokens for someone else before lock", async () => {
    await expectException(staking.connect(primary).exit(nft1155Id), "User locked");
  });
  it("Should not allow to withdraw locked tokens before lock", async () => {
    await expectException(staking.connect(kiwi).exit(nft1155Id), "User locked");
  });

  it("Should not allow to withdraw locked tokens before lock", async () => {
    await expectException(staking.connect(kiwi).exit(179), "User locked");
  });

  it("Should not allow transfer before lock", async () => {
    let newDisttoken = await staking.newRewardDistributionToken(179);
    let distToken = await ethers.getContractAt("IERC20Upgradeable", newDisttoken)
    await expectException(distToken.connect(kiwi).transfer(dao.getAddress(), 1), "User locked");
  });

  it("Should pass some time", async () => {
    await ethers.provider.send("evm_increaseTime",  [24*60*60]);
    await ethers.provider.send("evm_mine", []);
  });

  it("Should distribute current new rewards to new LP token", async () => {
    let newDisttoken = await staking.newRewardDistributionToken(179);
    let oldBal = await vaults[0].balanceOf(newDisttoken);
    await vaults[0].connect(kiwi).mint([2886], [1]);
    let newBal = await vaults[0].balanceOf(newDisttoken);
    expect(oldBal).to.not.equal(newBal);
  });

  it("Should allow to exit and claim locked tokens after lock", async () => {
    let oldBal = await vaults[0].balanceOf(kiwi.getAddress());
    await staking.connect(kiwi).claimMultipleRewards([179, nft1155Id]);
    let newBal = await vaults[0].balanceOf(kiwi.getAddress());
    expect(newBal).to.not.equal(oldBal);
    expect(await staking.lockedLPBalance(179, kiwi.getAddress())).to.equal(0);
  });

  it("Should pass some time", async () => {
    await ethers.provider.send("evm_increaseTime",  [24*60*60]);
    await ethers.provider.send("evm_mine", []);
  });

  it("Should allow to withdraw locked tokens for someone else after lock", async () => {
    await staking.connect(primary).exit(nft1155Id);
  });

  it("Should allow to withdraw locked 1155 tokens after lock", async () => {
    await staking.connect(kiwi).exit(nft1155Id);
  });
  
  it("Should upgrade the vault contract", async () => {
    let NewVault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    let newVault = await NewVault.deploy();
    await newVault.deployed();
    await nftx.connect(dao).upgradeChildTo(newVault.address);
  });
});
