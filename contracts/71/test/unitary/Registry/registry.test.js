const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}
const { ZERO_ADDRESS } = require("../constant-utils");

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("registry", function () {
  before(async () => {
    //import
    [creator, alice, market1, market2, market3, cds1, cds2, factory] =
      await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    const Registry = await ethers.getContractFactory("Registry");
    //deploy
    ownership = await Ownership.deploy();
    registry = await Registry.deploy(ownership.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("Should contracts be deployed", async () => {
      expect(registry.address).to.exist;
    });
  });

  describe("setFactory() / factory()", function () {
    it("reverts when called by non-admin address", async () => {
      it("reverts", async function () {
        await expect(
          registry.connect(alice).setFactory(factory.address)
        ).to.revertedWith("Restricted: caller is not allowed to operate");
      });
    });
    it("should not be zero address", async () => {
      it("reverts", async function () {
        await expect(registry.setFactory(ZERO_ADDRESS)).to.revertedWith(
          "ERROR: ZERO_ADDRESS"
        );
      });
    });
    it("should registar the factory address", async () => {
      await registry.setFactory(factory.address);
      expect(await registry.factory()).to.equal(factory.address);
    });
  });

  describe("supportMarket() / isListed()", function () {
    it("should only register once", async () => {
      it("reverts", async function () {
        await registry.supportMarket(market1.address);
        await expect(registry.supportMarket(market1.address)).to.revertedWith(
          "ERROR: ALREADY_REGISTERED"
        );
      });
    });
    it("msgSender should be either the factory address or the owner address", async () => {
      await registry.setFactory(factory.address);
      await registry.supportMarket(market1.address);
      await registry.connect(factory).supportMarket(market2.address);
      await expect(
        registry.connect(alice).supportMarket(market3.address)
      ).to.revertedWith("ERROR: UNAUTHORIZED_CALLER");
    });

    it("market address should not be zero address", async () => {
      await expect(registry.supportMarket(ZERO_ADDRESS)).to.revertedWith(
        "ERROR: ZERO_ADDRESS"
      );
    });

    it("should return true if registered", async () => {
      await registry.supportMarket(market1.address);
      expect(await registry.isListed(market1.address)).to.equal(true);
      expect(await registry.isListed(market2.address)).to.equal(false);
    });

    it("should push data to all market array", async () => {
      await registry.supportMarket(market1.address);
      expect(await registry.getAllMarkets()).to.deep.equal([market1.address]);
    });
  });

  describe("setExistence() / confirmExistence()", function () {
    it("msgSender should be either the factory address or the owner address", async () => {
      await registry.setFactory(factory.address);
      await registry.setExistence(market1.address, ZERO_ADDRESS);
      await registry
        .connect(factory)
        .setExistence(market2.address, ZERO_ADDRESS);
      await expect(
        registry.connect(alice).setExistence(market3.address, ZERO_ADDRESS)
      ).to.revertedWith("ERROR: UNAUTHORIZED_CALLER");
    });
    it("should set existence if registered", async () => {
      await registry.setExistence(market1.address, ZERO_ADDRESS);
      expect(
        await registry.confirmExistence(market1.address, ZERO_ADDRESS)
      ).to.equal(true);
      expect(
        await registry.confirmExistence(market2.address, ZERO_ADDRESS)
      ).to.equal(false);
    });
  });

  describe("setCDS() / getCDS()", function () {
    it("msgSender should be the owner address", async () => {
      await registry.setCDS(market2.address, cds1.address);
      await expect(
        registry.connect(factory).setCDS(market2.address, cds1.address)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });
    it("cds address should not be zero address", async () => {
      await expect(
        registry.setCDS(market2.address, ZERO_ADDRESS)
      ).to.revertedWith("ERROR: ZERO_ADDRESS");
    });
    it("should set CDS address", async () => {
      await registry.setCDS(market2.address, cds1.address);
      expect(await registry.getCDS(market2.address)).to.equal(cds1.address);
      expect(await registry.getCDS(market1.address)).to.equal(ZERO_ADDRESS);
    });
  });
});
