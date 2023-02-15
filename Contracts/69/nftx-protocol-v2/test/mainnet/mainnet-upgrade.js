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

describe("Mainnet Upgrade Test", function () {
  before("Setup", async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
            blockNumber: 13361600,
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
      params: ["0x08ceb8bba685ee708c9c4c65576837cbe19b9dea"],
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

    nftx = await ethers.getContractAt(
      "NFTXVaultFactoryUpgradeable",
      "0xBE86f647b167567525cCAAfcd6f881F1Ee558216"
    );
    staking = await ethers.getContractAt(
      "NFTXLPStaking",
      "0x688c3E4658B5367da06fd629E41879beaB538E37"
    );
    zap = await ethers.getContractAt(
      "NFTXStakingZap",
      "0x28E9162fC10Bb3A7f98f44e90fA7273698fce360"
    );
    controller = await ethers.getContractAt(
      "ProxyController",
      "0x4333d66Ec59762D1626Ec102d7700E64610437Df"
    );

    await nftx.connect(dao).setFeeExclusion(staking.address, true)
  });

  it("Should set state fields", async () => {
    expect(await zap.nftxFactory()).to.equal(nftx.address);
    expect(await zap.lpStaking()).to.equal(staking.address);
    expect(await zap.sushiRouter()).to.equal(
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
    );
  });

  it("Should upgrade the factory and child", async () => {
    let oldVaultAddr = await nftx.vault(179);
    let oldVaultNum = await nftx.numVaults();
    let NewFactory = await ethers.getContractFactory("NFTXVaultFactoryUpgradeable");
    let newFactory = await NewFactory.deploy();
    await newFactory.deployed();
    await controller.connect(dao).upgradeProxyTo(0, newFactory.address);
    let NewVault = await ethers.getContractFactory("NFTXVaultUpgradeable");
    let newVault = await NewVault.deploy();
    await newVault.deployed();
    await nftx.connect(dao).upgradeChildTo(newVault.address);
    await nftx.assignFees();
    let newVaultAddr = await nftx.vault(179);
    let newVaultNum = await nftx.numVaults();
    expect(oldVaultAddr).to.equal(newVaultAddr);
    expect(newVaultNum).to.equal(oldVaultNum);
  });

  it("Should report accurate storage", async () => {
    vault = await ethers.getContractAt(
      "NFTXVaultUpgradeable",
      "0x5cE188B44266c7B4bbC67Afa3D16b2eB24eD1065"
    );
    let fees = await vault.vaultFees();
    expect(fees[0]).to.equal(await nftx.factoryMintFee()); 
    expect(fees[1]).to.equal(await nftx.factoryRandomRedeemFee()); 
    expect(fees[2]).to.equal(await nftx.factoryTargetRedeemFee()); 
    expect(fees[3]).to.equal(await nftx.factoryRandomSwapFee()); 
    expect(fees[4]).to.equal(await nftx.factoryTargetSwapFee()); 
    expect(await vault.mintFee()).to.equal(await nftx.factoryMintFee()); 
    expect(await vault.randomRedeemFee()).to.equal(await nftx.factoryRandomRedeemFee()); 
    expect(await vault.targetRedeemFee()).to.equal(await nftx.factoryTargetRedeemFee()); 
    expect(await vault.randomSwapFee()).to.equal(await nftx.factoryRandomSwapFee()); 
    expect(await vault.targetSwapFee()).to.equal(await nftx.factoryTargetSwapFee()); 

    await nftx.connect(dao).setVaultFees(179, BASE.div(20), BASE.div(25), BASE.div(10), BASE.div(25), BASE.div(20))
    let newFees = await vault.vaultFees();
    expect(newFees[0]).to.equal(BASE.div(20)); 
    expect(newFees[1]).to.equal(BASE.div(25)); 
    expect(newFees[2]).to.equal(BASE.div(10)); 
    expect(newFees[3]).to.equal(BASE.div(25)); 
    expect(newFees[4]).to.equal(BASE.div(20)); 
    expect(await vault.mintFee()).to.equal(BASE.div(20)); 
    expect(await vault.randomRedeemFee()).to.equal(BASE.div(25)); 
    expect(await vault.targetRedeemFee()).to.equal(BASE.div(10)); 
    expect(await vault.randomSwapFee()).to.equal(BASE.div(25)); 
    expect(await vault.targetSwapFee()).to.equal(BASE.div(20)); 

    await nftx.connect(dao).disableVaultFees(179);
    let disabledFees = await vault.vaultFees();
    expect(disabledFees[0]).to.equal(await nftx.factoryMintFee()); 
    expect(disabledFees[1]).to.equal(await nftx.factoryRandomRedeemFee()); 
    expect(disabledFees[2]).to.equal(await nftx.factoryTargetRedeemFee()); 
    expect(disabledFees[3]).to.equal(await nftx.factoryRandomSwapFee()); 
    expect(disabledFees[4]).to.equal(await nftx.factoryTargetSwapFee()); 
    expect(await vault.mintFee()).to.equal(await nftx.factoryMintFee()); 
    expect(await vault.randomRedeemFee()).to.equal(await nftx.factoryRandomRedeemFee()); 
    expect(await vault.targetRedeemFee()).to.equal(await nftx.factoryTargetRedeemFee()); 
    expect(await vault.randomSwapFee()).to.equal(await nftx.factoryRandomSwapFee()); 
    expect(await vault.targetSwapFee()).to.equal(await nftx.factoryTargetSwapFee()); 
  })

  it("Should add liquidity with 721 on existing pool", async () => {
    vaults.push(vault);
    const assetAddress = await vaults[0].assetAddress();
    const uwus = await ethers.getContractAt("ERC721", assetAddress);
    await uwus.connect(kiwi).setApprovalForAll(zap.address, true);
    await uwus.connect(kiwi).setApprovalForAll(vaults[0].address, true);

    const router = await ethers.getContractAt("IUniswapV2Router01", "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    const pair = await ethers.getContractAt("IUniswapV2Pair", "0xfd52305d58f612aad5f7e5e331c7a0d77e352ec3")
    const {
      reserve0,
      reserve1,
    } = await pair.getReserves();
    const amountToLP = BASE.mul(2); //.sub(mintFee.mul(5)) no fee anymore
    const amountETH = await router.quote(amountToLP, reserve0, reserve1)
    await vaults[0].connect(kiwi).approve(zap.address, BASE.mul(1000))
    await zap.connect(kiwi).addLiquidity721ETH(179, [6663, 1679], amountETH.sub(500), {value: amountETH})
    const postDepositBal = await pair.balanceOf(staking.address);
  });

  it("Should mint to generate some rewards", async () => {
    let newDisttoken = await staking.newRewardDistributionToken(179);
    let oldBal = await vaults[0].balanceOf(newDisttoken);
    await vaults[0].connect(kiwi).mint([1747], [1]);
    let newBal = await vaults[0].balanceOf(newDisttoken);
    expect(oldBal).to.not.equal(newBal);
  })

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

  it("Should pass some time", async () => {
    await ethers.provider.send("evm_increaseTime",  [24*60*60]);
    await ethers.provider.send("evm_mine", []);
  });

  it("Should distribute current new rewards to new LP token", async () => {
    let newDisttoken = await staking.newRewardDistributionToken(179);
    let oldBal = await vaults[0].balanceOf(newDisttoken);
    await vaults[0].connect(kiwi).mint([5720], [1]);
    let newBal = await vaults[0].balanceOf(newDisttoken);
    expect(oldBal).to.not.equal(newBal);
  });

  it("Should allow to exit and claim locked tokens after lock", async () => {
    let oldBal = await vaults[0].balanceOf(kiwi.getAddress());
    await staking.connect(kiwi).claimMultipleRewards([179, nft1155Id]);
    let newBal = await vaults[0].balanceOf(kiwi.getAddress());
    expect(newBal).to.not.equal(oldBal);
    // expect(await staking.lockedLPBalance(31, kiwi.getAddress())).to.equal(0);
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
});
