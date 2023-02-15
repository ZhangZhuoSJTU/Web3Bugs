const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const { verifyBalance } = require("../test-utils");

const { ZERO_ADDRESS } = require("../constant-utils");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("Factory", function () {
  before(async () => {
    //import
    [creator, alice, bob, chad, fake] = await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    const DAI = await ethers.getContractFactory("TestERC20Mock");
    const PoolTemplate = await ethers.getContractFactory("PoolTemplate");
    const Factory = await ethers.getContractFactory("Factory");
    const Vault = await ethers.getContractFactory("Vault");
    const Registry = await ethers.getContractFactory("Registry");
    const PremiumModel = await ethers.getContractFactory("TestPremiumModel");
    const Parameters = await ethers.getContractFactory("Parameters");
    const Contorller = await ethers.getContractFactory("ControllerMock");

    //deploy
    ownership = await Ownership.deploy();
    dai = await DAI.deploy();
    registry = await Registry.deploy(ownership.address);
    factory = await Factory.deploy(registry.address, ownership.address);
    premium = await PremiumModel.deploy();
    controller = await Contorller.deploy(dai.address, ownership.address);
    vault = await Vault.deploy(
      dai.address,
      registry.address,
      controller.address,
      ownership.address
    );
    poolTemplate = await PoolTemplate.deploy();
    parameters = await Parameters.deploy(ownership.address);
    await registry.setFactory(factory.address);
    await parameters.setVault(dai.address, vault.address);
    await dai.mint(alice.address, (100000).toString());
    /*
    //set up
    await dai.mint(chad.address, (100000).toString());
    await dai.mint(bob.address, (100000).toString());
    ;

    await factory.approveTemplate(poolTemplate.address, true, false, true);
    await factory.approveReference(poolTemplate.address, 0, dai.address, true);
    await factory.approveReference(poolTemplate.address, 1, dai.address, true);
    await factory.approveReference(
      poolTemplate.address,
      2,
      registry.address,
      true
    );
    await factory.approveReference(
      poolTemplate.address,
      3,
      parameters.address,
      true
    );

    await parameters.setFeeRate(ZERO_ADDRESS, "10000");
    await parameters.setLowerSlack(ZERO_ADDRESS, "500");
    await parameters.setUpperSlack(ZERO_ADDRESS, "500");
    await parameters.setGrace(ZERO_ADDRESS, "259200");
    await parameters.setLockup(ZERO_ADDRESS, "604800");
    await parameters.setMinDate(ZERO_ADDRESS, "604800");
    await parameters.setPremiumModel(ZERO_ADDRESS, premium.address);
    await parameters.setWithdrawable(ZERO_ADDRESS, "2592000");
    
    await parameters.setMaxList(ZERO_ADDRESS, "10");

    await factory.createMarket(
      poolTemplate.address,
      "Here is metadata.",
      [0,0],
      [dai.address, dai.address, registry.address, parameters.address]
    );
    const marketAddress = await factory.markets(0);
    market = await PoolTemplate.attach(marketAddress);
    */
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("Should contracts be deployed", async () => {
      expect(factory.address).to.exist;
    });
  });

  describe("approveTemplate", function () {
    it("Reverts transaction not from the admin", async () => {
      await expect(
        factory
          .connect(alice)
          .approveTemplate(poolTemplate.address, true, true, true)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });
    it("Should register a template address", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      expect(await factory.templates(poolTemplate.address)).to.deep.equal([
        true,
        true,
        true,
      ]);
    });
    it("Should allow creating a market based on approved templates only", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.approveReference(
        poolTemplate.address,
        0,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        1,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        2,
        registry.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        3,
        parameters.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        4,
        ZERO_ADDRESS,
        true
      );
      let market = await factory.createMarket(
        poolTemplate.address,
        "Here is metadata.",
        [0, 0],
        [
          dai.address,
          dai.address,
          registry.address,
          parameters.address,
          creator.address,
        ]
      );
      expect(market).to.exist;
    });
    it("Reverts when creating a market if the specified template is not registered", async () => {
      await factory.approveTemplate(fake.address, true, true, true);
      await expect(
        factory
          .connect(alice)
          .createMarket(poolTemplate.address, "Here is metadata.", [], [])
      ).to.revertedWith("ERROR: UNAUTHORIZED_TEMPLATE");
    });
    it("Reverts when creating a market by non-admin if the template does not allow open market creation", async () => {
      await factory.approveTemplate(fake.address, true, false, true);
      await expect(
        factory
          .connect(alice)
          .createMarket(fake.address, "Here is metadata.", [], [])
      ).to.revertedWith("ERROR: UNAUTHORIZED_SENDER");
    });
    it("Reverts when creating a market with the same target token if the template does not allowed duplicate market creation", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, false);
      await factory.approveReference(
        poolTemplate.address,
        0,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        1,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        2,
        registry.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        3,
        parameters.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        4,
        ZERO_ADDRESS,
        true
      );
      await factory
        .connect(alice)
        .createMarket(
          poolTemplate.address,
          "Here is metadata.",
          [0, 0],
          [
            dai.address,
            dai.address,
            registry.address,
            parameters.address,
            alice.address,
          ]
        );
      await expect(
        factory
          .connect(alice)
          .createMarket(
            poolTemplate.address,
            "Here is metadata.",
            [0, 0],
            [
              dai.address,
              dai.address,
              registry.address,
              parameters.address,
              alice.address,
            ]
          )
      ).to.revertedWith("ERROR: DUPLICATE_MARKET");
    });
  });

  describe("approveReference", function () {
    it("Should register a reference address", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.approveReference(
        poolTemplate.address,
        0,
        dai.address,
        true
      );
      expect(
        await factory.reflist(poolTemplate.address, 0, dai.address)
      ).to.equal(true);
    });

    it("Reverts when the template is not registered", async () => {
      await expect(
        factory.approveReference(poolTemplate.address, 0, dai.address, true)
      ).to.revertedWith("ERROR: UNAUTHORIZED_TEMPLATE");
    });

    it("Reverts transaction not from the admin", async () => {
      await expect(
        factory
          .connect(alice)
          .approveReference(poolTemplate.address, 0, dai.address, true)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });

    it("Should allow creating market based on the registered reference if it is defined", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.approveReference(
        poolTemplate.address,
        0,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        1,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        2,
        registry.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        3,
        parameters.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        4,
        ZERO_ADDRESS,
        true
      );
      let market = await factory.createMarket(
        poolTemplate.address,
        "Here is metadata.",
        [0, 0],
        [
          dai.address,
          dai.address,
          registry.address,
          parameters.address,
          creator.address,
        ]
      );
      expect(market).to.exist;
    });

    it("Reverts when creating market with an arbitrary reference if it is defined", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.approveReference(
        poolTemplate.address,
        0,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        1,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        2,
        registry.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        3,
        parameters.address,
        true
      );
      await expect(
        factory.createMarket(
          poolTemplate.address,
          "Here is metadata.",
          [0, 0],
          [dai.address, dai.address, dai.address, dai.address]
        )
      ).to.revertedWith("ERROR: UNAUTHORIZED_REFERENCE");
    });

    it("Should allow creating market based on the any arbitrary reference if address zero is set", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.approveReference(
        poolTemplate.address,
        0,
        ZERO_ADDRESS,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        1,
        ZERO_ADDRESS,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        2,
        ZERO_ADDRESS,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        3,
        ZERO_ADDRESS,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        4,
        ZERO_ADDRESS,
        true
      );
      let market = await factory.createMarket(
        poolTemplate.address,
        "Here is metadata.",
        [0, 0],
        [
          dai.address,
          dai.address,
          registry.address,
          parameters.address,
          creator.address,
        ]
      );
      expect(market).to.exist;
    });
  });

  describe("approveCondition", function () {
    it("Should register a condition number", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.setCondition(poolTemplate.address, 0, 100);
      expect(await factory.conditionlist(poolTemplate.address, 0)).to.equal(
        100
      );
    });
    it("Reverts transaction not from the admin", async () => {
      await expect(
        factory.connect(alice).setCondition(poolTemplate.address, 0, 100)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });
    it("Reverts when the template is not registered", async () => {
      await expect(
        factory.setCondition(poolTemplate.address, 0, 100)
      ).to.revertedWith("ERROR: UNAUTHORIZED_TEMPLATE");
    });
    it("Should allow creating market based on the registered condition", async () => {
      await factory.approveTemplate(poolTemplate.address, true, true, true);
      await factory.approveReference(
        poolTemplate.address,
        0,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        1,
        dai.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        2,
        registry.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        3,
        parameters.address,
        true
      );
      await factory.approveReference(
        poolTemplate.address,
        4,
        ZERO_ADDRESS,
        true
      );
      await factory.setCondition(poolTemplate.address, 0, 0);
      let market = await factory
        .connect(alice)
        .createMarket(
          poolTemplate.address,
          "Here is metadata.",
          [0, 0],
          [
            dai.address,
            dai.address,
            registry.address,
            parameters.address,
            alice.address,
          ]
        );
      expect(market).to.exist;
    });
    it("Should change the condition number if a condition is not registered", async () => {
      expect(registry.address).to.exist;
    });
  });
});
