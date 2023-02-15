const { expect } = require("chai");
const { expectRevert } = require("../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../addresses/rinkeby.json");

const BASE = BigNumber.from(10).pow(18);
const PERC1_FEE = BASE.div(100);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice, bob;
let sparklEligModule;

const numLoops = 5;

describe("Mainnet Sparkl Elig test", function () {
  before("Setup", async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
            blockNumber: 12729851,
          },
        },
      ],
    });

    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];
    bob = signers[2];

    const SparklElig = await ethers.getContractFactory(
      "UniswapV3SparkleEligibility"
    );
    sparklEligModule = await upgrades.deployProxy(
      SparklElig,
      [
        [
          "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8" /* USDC/WETH 0.3% */,
          "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed" /* WBTC/WETH 0.3% */,
          "0x7858e59e0c01ea06df3af3d20ac7b0003275d4bf" /* USDC/USDT 0.05% */,
          "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36" /* ETH/WUSDT 0.3% */,
          "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640" /* USDC/WETH 0.05% */,
          "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801" /* UNI/WETH 0.3% */,
          "0xe8c6c9227491c0a8156a0106a0204d881bb7e531" /* MKR/WETH 0.3% */,
          "0x99ac8ca7087fa4a2a1fb6357269965a2014abc35" /* WBTC/USDC 0.3% */,
          "0x6f48eca74b38d2936b02ab603ff4e36a6c0e3a77" /* DAI/USDT 0.05% */,
          "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8" /* DAI/WETH 0.3% */,
          "0xa6cc3c2531fdaa6ae1a3ca84c2855806728693e8" /* LINK/WETH 0.3% */,
          "0x8f8ef111b67c04eb1641f5ff19ee54cda062f163" /* WBTC/PAX 0.3% */,
          "0x60594a405d53811d3bc4766596efd80fd545a270" /* DAI/WETH 0.05% */,
          "0x4585fe77225b41b697c938b018e2ac67ac5a20c0" /* WBTC/WETH 0.05% */,
          "0x8f8ef111b67c04eb1641f5ff19ee54cda062f163" /* WBTC/PAX 0.3% */,
          "0xea4ba4ce14fdd287f380b55419b1c5b6c3f22ab6" /* COMP/WETH 0.3% */,
          "0x5ab53ee1d50eef2c1dd3d5402789cd27bb52c1bb" /* AAVE/WETH 0.3% */,
        ],
        primary.address,
      ],
      {
        initializer: "__NFTXEligibility_init",
      }
    );
    await sparklEligModule.deployed();
  });

  ////////////////////////////
  // Vault 0: ERC721, Basic //
  ////////////////////////////

  it("Should state that nft is correctly rare", async () => {
    expect(await sparklEligModule.checkIsEligible(57529)).to.be.equal(true);
    expect(await sparklEligModule.checkIsEligible(62185)).to.be.equal(true);
  });

  it("Should state that nft is correctly not rare", async () => {
    expect(await sparklEligModule.checkIsEligible(5729)).to.be.equal(false);
    expect(await sparklEligModule.checkIsEligible(5555)).to.be.equal(false);
    expect(await sparklEligModule.checkIsEligible(1139)).to.be.equal(false);
    expect(await sparklEligModule.checkIsEligible(6285)).to.be.equal(false);
  });
});
