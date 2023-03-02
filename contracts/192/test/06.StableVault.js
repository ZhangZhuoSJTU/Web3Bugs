const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const { signERC2612Permit } = require('eth-permit');

describe("StableVault", function () {

  let owner;
  let node;
  let user;

  let Forwarder;
  let forwarder;

  let StableVault;
  let stablevault;

  let StableToken;
  let stabletoken;

  let MockDAI;
  let mockdai;

  let MockMIM;
  let mockmim;

  let MockFRAX;
  let mockfrax;

  let MockUSDC;
  let mockusdc;

  let MockUSDT;
  let mockusdt;

  before(async function () {
    await deployments.fixture(['test']);
    [owner, node, user] = await ethers.getSigners();
    Forwarder = await deployments.get("Forwarder");
    forwarder = await ethers.getContractAt("Forwarder", Forwarder.address);
    StableToken = await deployments.get("StableToken");
    stabletoken = await ethers.getContractAt("StableToken", StableToken.address);
    StableVault = await deployments.get("StableVault");
    stablevault = await ethers.getContractAt("StableVault", StableVault.address);
    MockDAI = await deployments.get("MockDAI");
    mockdai = await ethers.getContractAt("MockERC20", MockDAI.address);
    MockMIM = await deployments.get("MockMIM");
    mockmim = await ethers.getContractAt("MockERC20", MockMIM.address);
    MockFRAX = await deployments.get("MockFRAX");
    mockfrax = await ethers.getContractAt("MockERC20", MockFRAX.address);
    MockUSDC = await deployments.get("MockUSDC");
    mockusdc = await ethers.getContractAt("MockERC20", MockUSDC.address);
    MockUSDT = await deployments.get("MockUSDT");
    mockusdt = await ethers.getContractAt("MockERC20", MockUSDT.address);
  });

  describe("Listing tokens", function () {
    it("Non-owner listing a token should revert", async function () {
      await expect(stablevault.connect(user).listToken(MockUSDT.address)).to.be.revertedWith("Ownable");
    });
    it("Non-owner delisting a token should revert", async function () {
      await expect(stablevault.connect(user).delistToken(MockUSDT.address)).to.be.revertedWith("Ownable");
    });
    it("Listing a token should push it into the correct array and mapping", async function () {
      await stablevault.connect(owner).listToken(MockDAI.address);
      expect(await stablevault.tokens(0)).to.equal(MockDAI.address);
      expect(await stablevault.allowed(MockDAI.address)).to.equal(true);
    });
    it("Listing a token twice should revert", async function () {
      await expect(stablevault.connect(owner).listToken(MockDAI.address)).to.be.revertedWith("Already added");
    });
    it("Delisting a non-listed token should revert", async function () {
      await expect(stablevault.connect(owner).delistToken(MockUSDT.address)).to.be.revertedWith("Not added");
    });
    it("Delisting a listed token should remove it from tokens array and allowed mapping", async function () {
      await stablevault.connect(owner).listToken(MockMIM.address);
      await stablevault.connect(owner).listToken(MockFRAX.address);
      await stablevault.connect(owner).delistToken(MockFRAX.address);
      expect(await stablevault.allowed(MockFRAX.address)).to.equal(false);
      expect(await stablevault.tokens(0)).to.not.equal(MockFRAX.address);
      expect(await stablevault.tokens(1)).to.not.equal(MockFRAX.address); // was index 1 before delisting
    });
  });
  describe("Deposit/withdraw functions", function () {
    it("Depositing a non-listed token should revert", async function () {
      await expect(stablevault.connect(owner).deposit(MockUSDT.address, 100000)).to.be.revertedWith("Token not listed");
    });
    it("Depositing listed tokens should mint equal amount of tigASSET", async function () {
      await mockdai.connect(owner).approve(StableVault.address, 5000000);
      await stablevault.connect(owner).deposit(MockDAI.address, 5000000);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(5000000);      
    });
    it("Depositing with permit with max allowance should work as expected", async function () {
      const sig = await signERC2612Permit(owner, MockDAI.address, await owner.getAddress(), StableVault.address, ethers.constants.MaxUint256);
      await stablevault.connect(owner).depositWithPermit(MockDAI.address, 100000, sig.deadline, true, sig.v, sig.r, sig.s);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(5100000);      
    });
    it("Depositing with permit with limited allowance should work as expected", async function () {
      const sig = await signERC2612Permit(owner, MockDAI.address, await owner.getAddress(), StableVault.address, 100000);
      await stablevault.connect(owner).depositWithPermit(MockDAI.address, 100000, sig.deadline, false, sig.v, sig.r, sig.s);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(5200000);      
    });
    it("Withdrawing should work as expected", async function () {
      const _output = await stablevault.connect(owner).callStatic.withdraw(MockDAI.address, 2000000);
      expect(_output).to.equal(2000000);
    });
  });
});
