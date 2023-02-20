const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


const {
  verifyBalances,
  verifyAllowance,

  verifyPoolsStatus,
  verifyPoolsStatusForIndex,

  verifyValueOfUnderlying,

  verifyIndexStatus,

  verifyVaultStatus_legacy,
  verifyVaultStatusOf_legacy,
  verifyDebtOf,

  verifyRate
} = require('../test-utils')

const{ 
  NULL_ADDRESS
} = require('../constant-utils');

async function snapshot () {
  return network.provider.send('evm_snapshot', [])
}

async function restore (snapshotId) {
  return network.provider.send('evm_revert', [snapshotId])
}

describe("Vault", function () {

  const initialMint = BigNumber.from("100000"); //initial token amount for users

  const depositAmount = BigNumber.from("10000"); //default deposit amount for test
  const depositAmountLarge = BigNumber.from("40000"); //default deposit amount (large) for test
  const defaultRate = BigNumber.from("1000000"); //initial rate between USDC and LP token
  const insureAmount = BigNumber.from("10000"); //default insure amount for test

  const governanceFeeRate = BigNumber.from("100000"); //10% of the Premium
  const RATE_DIVIDER = BigNumber.from("1000000"); //1e6
  const UTILIZATION_RATE_LENGTH_1E8 = BigNumber.from("1000000"); //1e6
  const padded1 = ethers.utils.hexZeroPad("0x1", 32);


  before(async () => {
    //import
    [creator, alice, bob, chad] = await ethers.getSigners();

    const Ownership = await ethers.getContractFactory("Ownership");
    const DAI = await ethers.getContractFactory("TestERC20Mock");
    const Vault = await ethers.getContractFactory("Vault");
    const Registry = await ethers.getContractFactory("Registry");
    const Contorller = await ethers.getContractFactory("ControllerMock");

    //deploy
    ownership = await Ownership.deploy();
    dai = await DAI.deploy();
    tokenA = await DAI.deploy();
    registry = await Registry.deploy(ownership.address);
    controller = await Contorller.deploy(dai.address, ownership.address);
    vault = await Vault.deploy(
      dai.address,
      registry.address,
      controller.address,
      ownership.address
    );

    //set up
    await dai.mint(alice.address, (100000).toString());
    await tokenA.mint(alice.address, (100000).toString());
    await controller.setVault(vault.address);

    await registry.supportMarket(alice.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot()
  });

  afterEach(async () => {
    await restore(snapshotId)
  })
  
  describe("Condition", function () {
    it("Should contracts be deployed", async () => {
      expect(dai.address).to.exist;
      expect(vault.address).to.exist;
      expect(controller.address).to.exist;
    });
  });

  describe("vault functions", function () {
    beforeEach(async () => {
      await dai.connect(alice).approve(vault.address, 10000);
    });

    it("allows add and withdraw value", async () => {
      await vault.connect(alice).addValue(10000, alice.address, alice.address);
      await controller.yield();

      expect(await vault.underlyingValue(alice.address)).to.equal(15000);
      expect(await vault.getPricePerFullShare()).to.equal(
        "1500000"
      );

      await vault.connect(alice).withdrawAllAttribution(alice.address);

      expect(await dai.balanceOf(alice.address)).to.equal(105000);
    });

    it("DISALLOWS controller to call utilize when disabled", async () => {
      await vault.connect(alice).addValue(10000, alice.address, alice.address);
      await vault.connect(creator).setKeeper(NULL_ADDRESS);

      await expect(controller.yield()).to.revertedWith("ERROR_NOT_KEEPER");
    });

    it("allows only keeper to call utilize when address is set", async () => {
      await vault.connect(alice).addValue(10000, alice.address, alice.address);
      await vault.connect(creator).setKeeper(controller.address);
      await controller.yield();

      expect(await vault.underlyingValue(alice.address)).to.equal(15000);
      expect(await vault.getPricePerFullShare()).to.equal("1500000");

      await expect(vault.connect(alice).utilize()).to.revertedWith("ERROR_NOT_KEEPER");
    });

    it("allows transfer value", async () => {
      await vault.connect(alice).addValue(10000, alice.address, alice.address);
      await controller.yield();

      expect(await vault.underlyingValue(alice.address)).to.equal(15000);

      await vault.connect(alice).transferValue(15000, bob.address);

      expect(await vault.underlyingValue(bob.address)).to.equal(15000);
      expect(await vault.attributionOf(bob.address)).to.equal(10000);

      await vault.connect(bob).transferAttribution(10000, chad.address);
      await vault.connect(chad).withdrawAllAttribution(chad.address);

      expect(await dai.balanceOf(chad.address)).to.equal(15000);
    });

    it("doesn't count direct transfer", async () => {
      await dai.connect(alice).transfer(vault.address, 10000);

      expect(await vault.balance()).to.equal(0);
      expect(await dai.balanceOf(vault.address)).to.equal(10000);

      await vault.connect(creator).withdrawRedundant(dai.address, creator.address);

      expect(await dai.balanceOf(creator.address)).to.equal(10000);
    });

    it("withdraw redundant token balance", async () => {
      await tokenA.connect(alice).transfer(vault.address, 10000);

      expect(await vault.balance()).to.equal(0);
      expect(await tokenA.balanceOf(vault.address)).to.equal(10000);

      await vault.connect(creator).withdrawRedundant(tokenA.address, creator.address);

      expect(await tokenA.balanceOf(creator.address)).to.equal(10000);
    });
  });
});
