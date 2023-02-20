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

let arr = [];
for (let i = 0; i <= 10; i++) {
  arr.push(i);
}

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

    const UniqueEligibility = await ethers.getContractFactory(
      "NFTXUniqueEligibility"
    );
    uniqueElig = await upgrades.deployProxy(
      UniqueEligibility,
      [primary.address, vault.address, false, false, []],
      {
        initializer: "__NFTXEligibility_init",
      }
    );
    await uniqueElig.deployed();
  });

  it("Should return false when no eligibilities are set", async () => {
    expect(await uniqueElig.checkIsEligible(0)).to.equal(false);
    expect(await uniqueElig.checkIsEligible(42)).to.equal(false);
    expect(await uniqueElig.checkAllEligible([0])).to.equal(false);
    expect(await uniqueElig.checkAllEligible([42])).to.equal(false);
    expect(await uniqueElig.checkAllEligible([0, 42])).to.equal(false);
    expect(await uniqueElig.checkAllIneligible([0])).to.equal(true);
    expect(await uniqueElig.checkAllIneligible([42])).to.equal(true);
    expect(await uniqueElig.checkAllIneligible([0, 42])).to.equal(true);
  });

  it("Should disallow eligibilities to be set by user", async () => {
    await expectRevert(
      uniqueElig.connect(alice).setUniqueEligibilities(arr, true)
    );
  });

  it("Should allow eligibilities to be set by owner", async () => {
    await uniqueElig.setUniqueEligibilities(arr, true);
  });

  it("Should return correct boolean", async () => {
    for (let i = 0; i < arr.length; i++) {
      const index = arr[i];
      expect(await uniqueElig.checkIsEligible(index)).to.equal(true);
    }
    expect(await uniqueElig.checkIsEligible(11)).to.equal(false);
    expect(await uniqueElig.checkIsEligible(42)).to.equal(false);
    expect(await uniqueElig.checkAllEligible([0])).to.equal(true);
    expect(await uniqueElig.checkAllEligible([0, 1])).to.equal(true);
    expect(await uniqueElig.checkAllEligible(arr)).to.equal(true);
    arr.push(11);
    expect(await uniqueElig.checkAllEligible(arr)).to.equal(false);
    expect(await uniqueElig.checkAllEligible([0, 42])).to.equal(false);
    expect(await uniqueElig.checkAllIneligible([42])).to.equal(true);
  });
});
