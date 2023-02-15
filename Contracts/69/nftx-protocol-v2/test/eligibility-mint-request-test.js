const { expect } = require("chai");
const { expectRevert } = require("../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../addresses/rinkeby.json");

const BASE = BigNumber.from(10).pow(18);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice;
const vaults = [];

describe("Main", function () {
  before("Setup", async () => {
    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];

    const Erc721 = await ethers.getContractFactory("ERC721");
    erc721 = await Erc721.deploy(`CryptoPandas`, `CRYPTOPANDAS`);
    await erc721.deployed();

    const Vault = await ethers.getContractFactory("MockVault");
    const vault = await Vault.deploy(erc721.address, false);
    await vault.deployed();
    vaults.push(vault);

    const RequestEligibility = await ethers.getContractFactory(
      "NFTXMintRequestEligibility"
    );
    reqElig = await upgrades.deployProxy(
      RequestEligibility,
      [primary.address, vault.address, false, []],
      {
        initializer: "__NFTXEligibility_init",
      }
    );
    await reqElig.deployed();

    for (let i = 0; i <= 10; i++) {
      await erc721.publicMint(alice.address, i);
    }
  });

  it("Should not be eligible before", async () => {
    expect(await reqElig.checkAllIneligible([0, 1, 2, 3])).to.equal(true)
  })

  it("Should allow mint requests", async () => {
    await erc721.connect(alice).approve(reqElig.address, 0);
    await reqElig.connect(alice).requestMint([0], [1]);
    await erc721.connect(alice).approve(reqElig.address, 1);
    await erc721.connect(alice).approve(reqElig.address, 2);
    await erc721.connect(alice).approve(reqElig.address, 3);
    await reqElig.connect(alice).requestMint([1, 2, 3], [1, 1, 1]);
  });

  it("Should allow approving mint request", async () => {
    await reqElig.approveMintRequests([0], [alice.address], false);
    await reqElig.approveMintRequests([1, 2, 3], [alice.address, alice.address, alice.address], true);
    await reqElig.connect(alice).claimUnminted([0], [alice.address]);
  });

  it("Should be eligible after", async () => {
    expect(await reqElig.checkAllEligible([0, 1, 2, 3])).to.equal(true)
  })
});
