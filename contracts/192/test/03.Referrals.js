const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");

describe("Referrals", function () {

  let owner;
  let trader;
  let user;
  let referrals;
  let NewTrading;

  beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, trader, user, NewTrading] = await ethers.getSigners();
    const Referrals = await deployments.get("Referrals");
    referrals = await ethers.getContractAt("Referrals", Referrals.address);
  });

  describe("Check onlyOwner", function () {
    it("Set protocol", async function() {
      await expect(referrals.connect(user).setProtocol(user.address)).to.be.revertedWith("Ownable");
    });
    it("Init refs", async function() {
      await expect(referrals.connect(user).initRefs([], [], [], [])).to.be.revertedWith("Ownable");
    });
  });

  describe("Adding old refs via initRef", function () {
    it("Should only be able to be done once", async function() {
      await referrals.connect(owner).initRefs([], [], [], []);
      await expect(referrals.connect(owner).initRefs([], [], [], [])).to.be.revertedWith("");
    });
    it("Should set referrals correctly", async function() {
      await referrals.connect(owner).initRefs([owner.address], [ethers.utils.id("testcode")], [user.address], [ethers.utils.id("testcode")]);
      expect(await referrals.getReferred(user.address)).to.be.equals(ethers.utils.id("testcode"));
      expect(await referrals.getReferral(ethers.utils.id("testcode"))).to.be.equals(owner.address);
    });
  });

  describe("Referral system", function () {
    it("Creating a referral code", async function() {
      await referrals.connect(user).createReferralCode(ethers.utils.id("testcode"));
      expect(await referrals.getReferral(ethers.utils.id("testcode"))).to.equal(user.address);
    });
    it("Creating a referral code that already exists should revert", async function() {
      await referrals.connect(owner).createReferralCode(ethers.utils.id("testcode"));
      await expect(referrals.connect(user).createReferralCode(ethers.utils.id("testcode"))).to.be.revertedWith("Referral code already exists");
    });
    it("Only protocol should set refers", async function() {
      await referrals.connect(owner).setProtocol(NewTrading.address);
      await expect(referrals.connect(user).setReferred(user.address, ethers.utils.id("testcode"))).to.be.revertedWith("!Protocol");
    });
    it("An address attempting to refer themselves should just return", async function() {
      await referrals.connect(owner).setProtocol(NewTrading.address);
      await referrals.connect(owner).createReferralCode(ethers.utils.id("testcode"));
      await referrals.connect(NewTrading).setReferred(owner.address, ethers.utils.id("testcode"));
      expect(await referrals.getReferred(owner.address)).to.be.equals("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
    it("Mapping a trader as referred permanently", async function() {
      await referrals.connect(owner).setProtocol(NewTrading.address);
      await referrals.connect(user).createReferralCode(ethers.utils.id("testcode"));
      await referrals.connect(NewTrading).setReferred(trader.address, ethers.utils.id("testcode"));
      expect(await referrals.getReferred(trader.address)).to.equal(ethers.utils.id("testcode"));
      await referrals.connect(NewTrading).setReferred(trader.address, ethers.utils.id("anothercode"));
      expect(await referrals.getReferred(trader.address)).to.equal(ethers.utils.id("testcode"));
    });
  });
});
