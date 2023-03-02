const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");

describe("StableToken", function () {

  let stabletoken;
  let owner;
  let minter;
  let user;

  beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, minter, user] = await ethers.getSigners();
    const StableToken = await deployments.get("StableToken");
    stabletoken = await ethers.getContractAt("StableToken", StableToken.address);
    await stabletoken.connect(owner).setMinter(minter.address, true);
  });

  describe("Permissioned functions", function () {
    it("User calling setMinter() should revert", async function() {
      await expect(stabletoken.connect(user).setMinter(user.address, true)).to.be.revertedWith("Ownable");
    });
    it("User calling mintFor() should revert", async function() {
      await expect(stabletoken.connect(user).mintFor(user.address, 100)).to.be.revertedWith("!Minter");
    });
    it("User calling burnFrom() should revert", async function() {
      await expect(stabletoken.connect(user).burnFrom(user.address, 100)).to.be.revertedWith("!Minter");
    });
    it("Minter calling mintFor() should mint the correct amount of tokens", async function() {
      await stabletoken.connect(minter).mintFor(owner.address, 100);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(100);
    });
    it("Minter calling burnFrom() should burn the correct amount of tokens", async function() {
      await stabletoken.connect(minter).mintFor(owner.address, 100);
      await stabletoken.connect(minter).burnFrom(owner.address, 30);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(70);
    });
    it("Owner calling setMinter(address,false) should revoke user's minter role", async function() {
      await stabletoken.connect(owner).setMinter(minter.address, false);
      expect(await stabletoken.isMinter(minter.address)).to.equal(false);
    });
    it("Minter address calling mintFor() should revert on attempt to mint after role revoke", async function() {
      await stabletoken.connect(owner).setMinter(minter.address, false);
      await expect(stabletoken.connect(minter).mintFor(owner.address, 100)).to.be.revertedWith("!Minter");
    });
  });
});
