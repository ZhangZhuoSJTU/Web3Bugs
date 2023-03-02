const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");

async function getTimestamp() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  return timestampBefore;
}

async function getAEpoch() {
  return parseInt(await getTimestamp()/86400);
}

describe("Bonds", function () {

  let owner;
  let treasury;
  let user;
  let rndAddress;

  let Lock;
  let lock;

  let Bond;
  let bond;

  let GovNFT;
  let govnft;

  let StableToken;
  let stabletoken;

  beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, treasury, user, rndAddress] = await ethers.getSigners();
    Lock = await deployments.get("Lock");
    lock = await ethers.getContractAt("Lock", Lock.address);
    Bond = await deployments.get("BondNFT");
    bond = await ethers.getContractAt("BondNFT", Bond.address);
    StableToken = await deployments.get("StableToken");
    stabletoken = await ethers.getContractAt("StableToken", StableToken.address);
    GovNFT = await deployments.get("GovNFT");
    govnft = await ethers.getContractAt("GovNFT", GovNFT.address);
    await stabletoken.connect(owner).setMinter(owner.address, true);
    await govnft.connect(owner).mintMany(1);
    await stabletoken.connect(user).approve(Lock.address, ethers.utils.parseEther("3000"));
    await stabletoken.connect(owner).approve(Lock.address, ethers.utils.parseEther("100000000000"));
    await stabletoken.connect(owner).approve(Bond.address, ethers.utils.parseEther("100000000000"));
    await stabletoken.connect(owner).approve(GovNFT.address, ethers.utils.parseEther("100000000000"));
    await govnft.connect(owner).safeTransferMany(Lock.address, [1]);
    await lock.editAsset(StableToken.address, true);
    await bond.addAsset(StableToken.address);
  });

  describe("Owner permissions", function () {
    it("Non-owner setting bond manager should revert", async function () {
      await expect(bond.connect(user).setManager(user.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Non-owner setting allowed asset in bond should revert", async function () {
      await expect(bond.connect(user).setAllowedAsset(stabletoken.address, false)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Non-owner adding asset in bond should revert", async function () {
      await expect(bond.connect(user).addAsset(stabletoken.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Non-owner editing asset in lock should revert", async function () {
      await expect(lock.connect(user).editAsset(stabletoken.address, false)).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("Manager permissions", function () {
    it("Non-manager creating a lock should revert", async function () {
      await expect(bond.connect(user).createLock(stabletoken.address, 0, 0, user.address)).to.be.revertedWith("!manager");
    });
    it("Non-manager extending a lock should revert", async function () {
      await expect(bond.connect(user).extendLock(0, stabletoken.address, 0, 0, user.address)).to.be.revertedWith("!manager");
    });
    it("Non-manager releasing a lock should revert", async function () {
      await expect(bond.connect(user).release(0, user.address)).to.be.revertedWith("!manager");
    });
    it("Non-manager claiming rewards should revert", async function () {
      await expect(bond.connect(user).claim(0, user.address)).to.be.revertedWith("!manager");
    });
    it("Non-manager claiming debt should revert", async function () {
      await expect(bond.connect(user).claimDebt(user.address, stabletoken.address)).to.be.revertedWith("!manager");
    });
  });
  describe("Managing assets", function () {
    it("Adding asset in bond should revert if it's already added", async function () {
      await expect(bond.connect(owner).addAsset(stabletoken.address)).to.be.revertedWith("Already added");
    });
    it("Adding asset in bond should work as expected if it's not already added", async function () {
      expect(await bond.allowedAsset(rndAddress.address)).to.be.equals(false);
      await bond.connect(owner).addAsset(rndAddress.address);
      expect(await bond.allowedAsset(rndAddress.address)).to.be.equals(true);
    });
    it("Setting allowed asset in bond should revert if it's not added", async function () {
      await expect(bond.connect(owner).setAllowedAsset(owner.address, true)).to.be.revertedWith("Not added");
    });
    it("Setting allowed asset in bond should work as expected if it's added", async function () {
      expect(await bond.allowedAsset(stabletoken.address)).to.be.equals(true);
      await bond.connect(owner).setAllowedAsset(stabletoken.address, false);
      expect(await bond.allowedAsset(stabletoken.address)).to.be.equals(false);
    });
    it("totalAssets should return the correct assets length", async function () {
      await bond.connect(owner).addAsset(rndAddress.address);
      expect(await bond.totalAssets()).to.be.equals(2);
    });
  });
  describe("Locking", function () {
    it("Creating a lock with a non-allowed asset should revert", async function () {
      await bond.connect(owner).setAllowedAsset(stabletoken.address, false);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await expect(lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("1000"), 7)).to.be.revertedWith("!Asset");      
    });
    it("Locking for less than 7 days should revert", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await expect(lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("1000"), 6)).to.be.revertedWith("MIN PERIOD");      
    });
    it("Locking for more than 365 days should revert", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await expect(lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("1000"), 366)).to.be.revertedWith("MAX PERIOD");      
    });
    it("Locking a non-allowed asset should revert", async function () {
      await lock.editAsset(StableToken.address, false);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await expect(lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("1000"), 365)).to.be.revertedWith("!asset");      
    });
    it("Locking should result in correct ids and bond structs", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 100);
      expect(await bond.balanceOf(owner.address)).to.be.equals(1);
      expect(await bond.balanceOf(user.address)).to.be.equals(1);
      expect((await bond.balanceIds(owner.address)).toString()).to.be.equals('1');
      expect((await bond.balanceIds(user.address)).toString()).to.be.equals('2');
      let [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(owner.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("3000"));
      expect(mintEpoch).to.be.equals(parseInt((parseInt((Date.now()/1000).toString())/86400).toString()));
      expect(expireEpoch).to.be.equals(parseInt((parseInt((Date.now()/1000).toString())/86400).toString())+365);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals(ethers.utils.parseEther("3000"));
      expect(period).to.be.equals(365);
      expect(expired).to.be.equals(false);

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(2);
      expect(id).to.be.equals(2);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("1000"));
      expect(mintEpoch).to.be.equals(parseInt((parseInt((Date.now()/1000).toString())/86400).toString()));
      expect(expireEpoch).to.be.equals(parseInt((parseInt((Date.now()/1000).toString())/86400).toString())+100);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("273972602739726027397"); // 1000e18 * 100 / 365
      expect(period).to.be.equals(100);
      expect(expired).to.be.equals(false);
    });
  });
  describe("Rewards", function () {
    it("Distributing an unallowed asset should return", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);
      await bond.connect(owner).setAllowedAsset(stabletoken.address, false);
      await govnft.connect(owner).distribute(stabletoken.address, ethers.utils.parseEther("1000"));
      await lock.connect(owner).claimGovFees();
      expect(await bond.pending(1)).to.be.equals(0);
    });
    it("Claiming rewards from someone else's bond should revert", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 100);

      await expect(lock.connect(owner).claim(2)).to.be.revertedWith("!owner");
      await expect(lock.connect(user).claim(1)).to.be.revertedWith("!owner");
    });
    it("Rewards should be distributed correctly", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 100);

      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await govnft.distribute(stabletoken.address, ethers.utils.parseEther("1000"));
      await lock.connect(owner).claimGovFees();
      expect(await bond.pending(1)).to.be.equals("916317991631799162000");// 916.3 tigUSD
      expect(await bond.pending(2)).to.be.equals("83682008368200836712"); // 83.7 tigUSD

      await lock.connect(owner).claim(1);
      await lock.connect(user).claim(2);
      expect(await bond.pending(1)).to.be.equals("0");
      expect(await bond.pending(2)).to.be.equals("0");
      expect(await stabletoken.balanceOf(owner.address)).to.be.equals("916317991631799162000");// 916.3 tigUSD
      expect(await stabletoken.balanceOf(user.address)).to.be.equals("83682008368200836712"); // 83.7 tigUSD
    });
    it("Rewards should be stored correctly after bond transfer", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 100);

      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await govnft.distribute(stabletoken.address, ethers.utils.parseEther("1000"));
      await lock.connect(owner).claimGovFees();
      expect(await bond.pending(1)).to.be.equals("916317991631799162000");// 916.3 tigUSD
      expect(await bond.pending(2)).to.be.equals("83682008368200836712"); // 83.7 tigUSD

      await network.provider.send("evm_increaseTime", [300]);
      await network.provider.send("evm_mine");

      await bond.connect(owner).safeTransferMany(user.address, [1]);
      await bond.connect(user).safeTransferMany(owner.address, [2]);
      expect(await bond.pending(1)).to.be.equals("0");
      expect(await bond.pending(2)).to.be.equals("0");
      expect(await bond.userDebt(owner.address, stabletoken.address)).to.be.equals("916317991631799162000");// 916.3 tigUSD
      expect(await bond.userDebt(user.address, stabletoken.address)).to.be.equals("83682008368200836712"); // 83.7 tigUSD
      await lock.connect(owner).claimDebt(stabletoken.address);
      await lock.connect(user).claimDebt(stabletoken.address);
      expect(await stabletoken.balanceOf(owner.address)).to.be.equals("916317991631799162000");// 916.3 tigUSD
      expect(await stabletoken.balanceOf(user.address)).to.be.equals("83682008368200836712"); // 83.7 tigUSD
    });
    it("Rewards should be redistributed from an expired bond upon release", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("1000"), 100);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 10);

      await network.provider.send("evm_increaseTime", [864000]); // Skip 10 days
      await network.provider.send("evm_mine");

      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await bond.distribute(stabletoken.address, ethers.utils.parseEther("1000"));

      [,,,,,, expireEpoch,,,,] = await bond.idToBond(2);
      expect(await bond.epoch(stabletoken.address)).to.be.equals(expireEpoch);
      expect(await bond.isExpired(1)).to.be.equals(false);
      expect(await bond.isExpired(2)).to.be.equals(true);

      expect(await bond.pending(1)).to.be.equals("909090909090909090684");
      expect(await bond.pending(2)).to.be.equals("0");

      await lock.connect(user).release(2);
      expect(await bond.pending(1)).to.be.equals("999999999999999999725"); // Negligable difference from 1000e18 due to solidity division
    });
  });
  describe("Withdrawing", function () {
    it("Only expired bonds can be withdrawn", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("100"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await expect(lock.connect(owner).release(1)).to.be.revertedWith("!expire");
    });
    it("Only bond owner can withdraw within 7 days of post-expiration", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("100"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("100"), 10);

      await network.provider.send("evm_increaseTime", [864000]); // Skip 10 days
      await network.provider.send("evm_mine");

      await expect(lock.connect(user).release(1)).to.be.revertedWith("Bond owner priority");
    });
    it("Non bond owner can withdraw after 7 days", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("100"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("100"), 10);

      await network.provider.send("evm_increaseTime", [1728000]); // Skip 20 days
      await network.provider.send("evm_mine");

      expect(await stabletoken.balanceOf(owner.address)).to.be.equals("0");
      await lock.connect(user).release(1);
      expect(await stabletoken.balanceOf(user.address)).to.be.equals("0");
      expect(await stabletoken.balanceOf(owner.address)).to.be.equals(ethers.utils.parseEther("100"));

    });
    it("Rewards should be claimed from an expired bond upon release", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("100"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("100"), 100);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 10);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await bond.distribute(stabletoken.address, ethers.utils.parseEther("1000"));

      await network.provider.send("evm_increaseTime", [864000]); // Skip 10 days
      await network.provider.send("evm_mine");

      await bond.distribute(stabletoken.address, 0);

      [,,,,,,,pending,,,] = await bond.idToBond(1);
      expect(pending).to.be.equals("499999999999999999986");
      [,,,,,,,pending,,,] = await bond.idToBond(2);
      expect(pending).to.be.equals("499999999999999999986");

      await lock.connect(user).release(2);

      expect(await stabletoken.balanceOf(user.address)).to.be.equals("1499999999999999999986");
      [,,,,,,,pending,,,] = await bond.idToBond(1);
      expect(pending).to.be.equals("499999999999999999986");

      await network.provider.send("evm_increaseTime", [8640000]); // Skip 100 days
      await network.provider.send("evm_mine");

      [,,,,,,,pending,,,] = await bond.idToBond(1);
      expect(pending).to.be.equals("499999999999999999986");

      await lock.connect(owner).release(1);
      expect(await stabletoken.balanceOf(owner.address)).to.be.equals("599999999999999999986");
    });
  });
  describe("Extending lock", function () {
    it("Only bond owner can extend the lock", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await bond.connect(owner).setManager(owner.address);
      await expect(bond.connect(owner).extendLock(1, StableToken.address, 0, 0, owner.address)).to.be.revertedWith("!owner");
    });
    it("Extending the lock can only be max 365 days", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 365);
      await bond.connect(owner).setManager(owner.address);
      await expect(bond.connect(owner).extendLock(1, StableToken.address, 0, 1, user.address)).to.be.revertedWith("MAX PERIOD");
    });
    it("Only non-expired bond can be extended", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await bond.connect(owner).setManager(owner.address);
      await network.provider.send("evm_increaseTime", [864000]); // Skip 10 days
      await network.provider.send("evm_mine");
      await lock.connect(owner).claimGovFees();
      await expect(bond.connect(owner).extendLock(1, StableToken.address, 0, 0, user.address)).to.be.revertedWith("Expired");
    });
    it("Extending the lock with non-allowed asset should revert", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await bond.connect(owner).setManager(owner.address);
      await expect(bond.connect(owner).extendLock(1, rndAddress.address, 0, 0, user.address)).to.be.revertedWith("!BondAsset");
    });
    it("Rewards must be claimed before extending the lock", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await bond.connect(owner).setManager(owner.address);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await bond.distribute(stabletoken.address, ethers.utils.parseEther("1000"));
      await expect(bond.connect(owner).extendLock(1, stabletoken.address, 0, 0, user.address)).to.be.revertedWith(""/*No error string*/);
    });
    it("Rewards must be claimed before extending the lock", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await bond.connect(owner).setManager(owner.address);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("1000"));
      await bond.distribute(stabletoken.address, ethers.utils.parseEther("1000"));
      await expect(bond.connect(owner).extendLock(1, stabletoken.address, 0, 0, user.address)).to.be.revertedWith(""/*No error string*/);
    });
    it("Lock can only be extended if the epoch is updated", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);
      await bond.connect(owner).setManager(owner.address);
      await network.provider.send("evm_increaseTime", [864000]); // Skip 10 days
      await network.provider.send("evm_mine");
      await expect(bond.connect(owner).extendLock(1, StableToken.address, 0, 0, user.address)).to.be.revertedWith("Bad epoch");
    });
    it("Resetting lock should reset the lock period and keep locked amount correctly", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);

      await network.provider.send("evm_increaseTime", [432000]); // Skip 5 days
      await network.provider.send("evm_mine");

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      let totalShares = await bond.totalShares(stabletoken.address);
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("100"));
      expect(mintEpoch).to.be.equals(await getAEpoch()-5);
      expect(expireEpoch).to.be.equals(await getAEpoch()+5);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("2739726027397260273");
      expect(period).to.be.equals(10);
      expect(expired).to.be.equals(false);

      await lock.connect(user).extendLock(1, 0, 0);

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      expect(await bond.totalShares(stabletoken.address)).to.be.equals(totalShares);
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("100"));
      expect(mintEpoch).to.be.equals(await getAEpoch());
      expect(expireEpoch).to.be.equals(await getAEpoch()+10);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("2739726027397260273");
      expect(period).to.be.equals(10);
      expect(expired).to.be.equals(false);
    });
    it("Adding amount to lock should reset the lock period and calculate shares correctly", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);

      await network.provider.send("evm_increaseTime", [432000]); // Skip 5 days
      await network.provider.send("evm_mine");

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      expect(await bond.totalShares(stabletoken.address)).to.be.equals("2739726027397260273");
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("100"));
      expect(mintEpoch).to.be.equals(await getAEpoch()-5);
      expect(expireEpoch).to.be.equals(await getAEpoch()+5);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("2739726027397260273");
      expect(period).to.be.equals(10);
      expect(expired).to.be.equals(false);

      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).extendLock(1, ethers.utils.parseEther("100"), 0);

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      expect(await bond.totalShares(stabletoken.address)).to.be.equals("5479452054794520547");
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("200"));
      expect(mintEpoch).to.be.equals(await getAEpoch());
      expect(expireEpoch).to.be.equals(await getAEpoch()+10);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("5479452054794520547");
      expect(period).to.be.equals(10);
      expect(expired).to.be.equals(false);
    });
    it("Adding amount and time to lock should reset the lock period and calculate shares correctly", async function () {
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("100"), 10);

      await network.provider.send("evm_increaseTime", [432000]); // Skip 5 days
      await network.provider.send("evm_mine");

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      expect(await bond.totalShares(stabletoken.address)).to.be.equals("2739726027397260273");
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("100"));
      expect(mintEpoch).to.be.equals(await getAEpoch()-5);
      expect(expireEpoch).to.be.equals(await getAEpoch()+5);
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("2739726027397260273");
      expect(period).to.be.equals(10);
      expect(expired).to.be.equals(false);

      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("100"));
      await lock.connect(user).extendLock(1, ethers.utils.parseEther("100"), 10);

      [id, _owner, asset, amount, mintEpoch, mintTime, expireEpoch, pending, shares, period, expired] = await bond.idToBond(1);
      expect(await bond.totalShares(stabletoken.address)).to.be.equals("10958904109589041095");
      expect(id).to.be.equals(1);
      expect(_owner).to.be.equals(user.address);
      expect(asset).to.be.equals(StableToken.address);
      expect(amount).to.be.equals(ethers.utils.parseEther("200"));
      expect(mintEpoch).to.be.equals(await getAEpoch());
      expect(expireEpoch).to.be.equals(await getAEpoch()+20); // 10 days added
      expect(pending).to.be.equals(0);
      expect(shares).to.be.equals("10958904109589041095"); // Shares doubled with time increase
      expect(period).to.be.equals(20); // New time
      expect(expired).to.be.equals(false);
    });
  });
  describe("Bond transfers", function () {
    it("Bond can only transferred if epoch is updated", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);

      await network.provider.send("evm_increaseTime", [864000]);
      await network.provider.send("evm_mine");

      await expect(bond.connect(owner).safeTransferMany(user.address, [1])).to.be.revertedWith("Bad epoch");
    });
    it("Expired bond cannot be transferred", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 10);

      await network.provider.send("evm_increaseTime", [864000]);
      await network.provider.send("evm_mine");

      await lock.connect(owner).claimGovFees();
      await expect(bond.connect(owner).safeTransferMany(user.address, [1])).to.be.revertedWith("Expired!");
    });
    it("Bond can only be transferred 5 minutes after an update", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 10);
      await expect(bond.connect(owner).safeTransferMany(user.address, [1])).to.be.revertedWith("Recent update");
    });
    it("TransferFromMany should work as expected", async function () {
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("9000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 10);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("9000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 10);
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("9000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 10);

      await network.provider.send("evm_increaseTime", [300]);
      await network.provider.send("evm_mine");
      await lock.connect(owner).claimGovFees();

      expect(await bond.balanceOf(owner.address)).to.be.equals(3);
      expect(await bond.balanceOf(user.address)).to.be.equals(0);
      await bond.connect(owner).approveMany(user.address, [1,2,3]);
      await bond.connect(user).safeTransferFromMany(owner.address, user.address, [1,2,3]);
      expect(await bond.balanceOf(owner.address)).to.be.equals(0);
      expect(await bond.balanceOf(user.address)).to.be.equals(3);
    });
  });
  describe("Recovering NFTs", function () {
    it("Non-owner recovering NFTs should revert", async function () {
      await expect(lock.connect(user).sendNFTs([1])).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Owner should be able to recover NFTs", async function () {
      expect(await govnft.balanceOf(owner.address)).to.be.equals(0);
      expect(await govnft.balanceOf(lock.address)).to.be.equals(1);
      await lock.connect(owner).sendNFTs([1]);
      expect(await govnft.balanceOf(owner.address)).to.be.equals(1);
      expect(await govnft.balanceOf(lock.address)).to.be.equals(0);
    });
  });
  describe("BaseURI", function () {
    it("User setting baseURI should revert", async function () {
      await expect(bond.connect(user).setBaseURI("ipfs://abc.xyz/")).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Owner setting baseURI should set URI", async function () {
      await bond.connect(owner).setBaseURI("ipfs://abc.xyz/");
      expect(await bond.baseURI()).to.equal("ipfs://abc.xyz/");
    });
    it("TokenURI should use new baseURI", async function () {
      await bond.connect(owner).setBaseURI("ipfs://abc.xyz/");
      await stabletoken.connect(owner).mintFor(owner.address, ethers.utils.parseEther("3000"));
      await lock.connect(owner).lock(StableToken.address, ethers.utils.parseEther("3000"), 365);
      await stabletoken.connect(owner).mintFor(user.address, ethers.utils.parseEther("1000"));
      await lock.connect(user).lock(StableToken.address, ethers.utils.parseEther("1000"), 100);
      expect(await bond.tokenURI(1)).to.equal("ipfs://abc.xyz/1");
      expect(await bond.tokenURI(2)).to.equal("ipfs://abc.xyz/2");
    });
  });
});
