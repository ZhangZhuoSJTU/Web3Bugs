const { ethers, network, upgrades } = require("hardhat");
const { expect } = require("chai");
const { advanceTimeAndBlock, duration } = require("./utils/time");
const { deployRocketFactory, createLaunchEvent } = require("./utils/contracts");
const { HARDHAT_FORK_CURRENT_PARAMS } = require("./utils/hardhat");

describe("Rocket Joe Token", function () {
  before(async function () {
    this.RocketJoeStakingCF = await ethers.getContractFactory(
      "RocketJoeStaking"
    );
    this.RocketJoeTokenCF = await ethers.getContractFactory("RocketJoeToken");
    this.ERC20TokenCF = await ethers.getContractFactory("ERC20Token");

    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.owner = this.signers[1];
    this.penaltyCollector = this.signers[2];
    this.alice = this.signers[3];
    this.bob = this.signers[4];

    await network.provider.request({
      method: "hardhat_reset",
      params: HARDHAT_FORK_CURRENT_PARAMS,
    });
  });

  beforeEach(async function () {
    this.rJOE = await this.RocketJoeTokenCF.deploy();

    this.RocketFactory = await deployRocketFactory(
      this.dev,
      this.rJOE,
      this.penaltyCollector
    );

    await this.rJOE.transferOwnership(this.owner.address);
  });

  describe("Should allow transfer from and to authorized address", function () {
    it("should allow minting", async function () {
      await this.rJOE
        .connect(this.owner)
        .mint(this.alice.address, ethers.utils.parseEther("1"));
    });

    it("should allow burning if caller is a launch event", async function () {
      await this.rJOE
        .connect(this.owner)
        .mint(this.bob.address, ethers.utils.parseEther("100"));

      const AUCTOK = await this.ERC20TokenCF.deploy();
      await AUCTOK.mint(this.dev.address, ethers.utils.parseEther("105"));
      await AUCTOK.approve(
        this.RocketFactory.address,
        ethers.utils.parseEther("105")
      );

      const block = await ethers.provider.getBlock();

      const LaunchEvent = await createLaunchEvent(
        this.RocketFactory,
        this.alice,
        block,
        AUCTOK
      );

      await advanceTimeAndBlock(duration.seconds(120));

      await LaunchEvent.connect(this.bob).depositAVAX({
        value: ethers.utils.parseEther("1"),
      });
    });

    it("should allow transferring from owner", async function () {
      await this.rJOE
        .connect(this.owner)
        .mint(this.owner.address, ethers.utils.parseEther("1"));

      await this.rJOE
        .connect(this.owner)
        .transfer(this.alice.address, ethers.utils.parseEther("1"));
    });

    it("should allow transferring to a launch event", async function () {
      await this.rJOE
        .connect(this.owner)
        .mint(this.owner.address, ethers.utils.parseEther("1"));

      const AUCTOK = await this.ERC20TokenCF.deploy();
      await AUCTOK.mint(this.dev.address, ethers.utils.parseEther("105"));
      await AUCTOK.approve(
        this.RocketFactory.address,
        ethers.utils.parseEther("105")
      );

      const block = await ethers.provider.getBlock();

      const LaunchEvent = await createLaunchEvent(
        this.RocketFactory,
        this.alice,
        block,
        AUCTOK
      );

      await this.rJOE
        .connect(this.owner)
        .transfer(LaunchEvent.address, ethers.utils.parseEther("1"));
    });

    it("should revert if user tries to transfer token to a non-authorized address", async function () {
      await this.rJOE
        .connect(this.owner)
        .mint(this.alice.address, ethers.utils.parseEther("1"));
      await this.rJOE
        .connect(this.owner)
        .mint(this.bob.address, ethers.utils.parseEther("1"));

      await expect(
        this.rJOE
          .connect(this.alice)
          .transfer(this.bob.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("RocketJoeToken: can't send token");

      await expect(
        this.rJOE
          .connect(this.bob)
          .transfer(this.alice.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("RocketJoeToken: can't send token");
    });

    it("should revert if burn from is called from a non launch event address", async function () {
      await this.rJOE
        .connect(this.owner)
        .mint(this.alice.address, ethers.utils.parseEther("1"));

      await expect(
        this.rJOE
          .connect(this.bob)
          .burnFrom(this.bob.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("RocketJoeToken: caller is not a RJLaunchEvent");

      await expect(
        this.rJOE
          .connect(this.bob)
          .burnFrom(this.alice.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("RocketJoeToken: caller is not a RJLaunchEvent");
    });
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});
