const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("Ownership", function () {
  beforeEach(async () => {
    //import
    [creator, alice, bob, futureOwner] = await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    //deploy
    ownership = await Ownership.deploy();
  });

  describe("Condition", function () {
    it("Should contracts be deployed", async () => {
      expect(ownership.address).to.exist;
    });
  });

  describe("Constructor", function () {
    it("set owner successfully", async () => {
      expect(await ownership.owner()).to.equal(creator.address);
    });
  });

  describe("future_owner()", function () {
    it("return future_owner successfully", async () => {
      await ownership.commitTransferOwnership(futureOwner.address);
      expect(await ownership.futureOwner()).to.equal(futureOwner.address);
    });
  });

  describe("transfer_ownership()", function () {
    it("commit_transfer_ownership successfully", async () => {
      await ownership.commitTransferOwnership(alice.address);
      expect(await ownership.owner()).to.equal(creator.address);
      expect(await ownership.futureOwner()).to.equal(alice.address);
    });

    it("commit_transfer_ownership emit event successfully", async () => {
      it("should emit the event", async () => {
        await expect(
          await ownership.commitTransferOwnership(alice.address)
        ).to.emit(parameters, "CommitNewOwnership");
      });
    });

    it("commit_transfer_ownership revert: onlyOwner", async () => {
      await expect(
        ownership.connect(alice).commitTransferOwnership(alice.address)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });

    it("commit_transfer_ownership revert: zero address", async () => {
      await expect(
        ownership.connect(alice).commitTransferOwnership(alice.address)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });

    it("accept_transfer_ownership successfully", async () => {
      await ownership.commitTransferOwnership(alice.address);
      //await ethers.provider.send("evm_increaseTime", [86400 * 4]);
      await ownership.connect(alice).acceptTransferOwnership();

      expect(await ownership.owner()).to.equal(alice.address);
      expect(await ownership.futureOwner()).to.equal(alice.address);
    });

    it("accept_transfer_ownership emit event successfully", async () => {
      await ownership.commitTransferOwnership(alice.address);
      //await ethers.provider.send("evm_increaseTime", [86400 * 4]);
      await expect(ownership.connect(alice).acceptTransferOwnership()).to.emit(
        ownership,
        "AcceptNewOwnership"
      );
    });

    it("accept_transfer_ownership revert: onlyFutureOwner", async () => {
      await ownership.commitTransferOwnership(alice.address);
      //await ethers.provider.send("evm_increaseTime", [86400 * 4]);
      await expect(
        ownership.connect(bob).commitTransferOwnership(alice.address)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });
  });
});
