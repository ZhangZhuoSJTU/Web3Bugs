const { expect } = require("chai");
const { expectRevert } = require("../utils/expectRevert");

const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, upgrades } = require("hardhat");

const addresses = require("../addresses/rinkeby.json");

const BASE = BigNumber.from(10).pow(18);
const zeroAddr = "0x0000000000000000000000000000000000000000";
const notZeroAddr = "0x000000000000000000000000000000000000dead";

let primary, alice;

describe("Eligibility Range", function () {
  before("Setup", async () => {
    signers = await ethers.getSigners();
    primary = signers[0];
    alice = signers[1];

    const RangeEligibility = await ethers.getContractFactory(
      "NFTXRangeExtendedEligibility"
    );
    rangeElig = await upgrades.deployProxy(
      RangeEligibility,
      [primary.address, 0, 0],
      {
        initializer: "__NFTXEligibility_init",
      }
    );
    await rangeElig.deployed();
  });
  it("Should return ineligible when no range set", async () => {
    expect(await rangeElig.checkIsEligible(0)).to.equal(false);
    expect(await rangeElig.checkIsEligible(42)).to.equal(false);
    expect(await rangeElig.checkAllEligible([0])).to.equal(false);
    expect(await rangeElig.checkAllEligible([42])).to.equal(false);
    expect(await rangeElig.checkAllEligible([0, 42])).to.equal(false);
    expect(await rangeElig.checkAllIneligible([0])).to.equal(true);
    expect(await rangeElig.checkAllIneligible([42])).to.equal(true);
    expect(await rangeElig.checkAllIneligible([0, 42])).to.equal(true);
  });

  it("Should disallow range to be set by user", async () => {
    await expectRevert(
      rangeElig.connect(alice).setEligibilityPreferences(0, 10)
    );
  });

  it("Should allow range to be set by owner", async () => {
    await rangeElig.setEligibilityPreferences(0, 10);
  });

  it("Should return correct boolean", async () => {
    const arr = [];
    for (let i = 0; i <= 10; i++) {
      arr.push(i);
      expect(await rangeElig.checkIsEligible(i)).to.equal(true);
    }
    expect(await rangeElig.checkIsEligible(11)).to.equal(false);
    expect(await rangeElig.checkIsEligible(42)).to.equal(false);
    expect(await rangeElig.checkAllEligible([0])).to.equal(true);
    expect(await rangeElig.checkAllEligible([0, 1])).to.equal(true);
    expect(await rangeElig.checkAllEligible(arr)).to.equal(true);
    arr.push(11);
    expect(await rangeElig.checkAllEligible(arr)).to.equal(false);
    expect(await rangeElig.checkAllEligible([0, 42])).to.equal(false);
    expect(await rangeElig.checkAllIneligible([42])).to.equal(true);
  });
});
