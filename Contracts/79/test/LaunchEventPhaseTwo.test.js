const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { advanceTimeAndBlock, duration } = require("./utils/time");
const { HARDHAT_FORK_CURRENT_PARAMS } = require("./utils/hardhat");
const { deployRocketFactory, createLaunchEvent } = require("./utils/contracts");

describe("launch event contract phase two", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.penaltyCollector = this.signers[1];
    this.issuer = this.signers[2];
    this.participant = this.signers[3];

    this.RocketJoeTokenCF = await ethers.getContractFactory("RocketJoeToken");
    this.ERC20TokenCF = await ethers.getContractFactory("ERC20Token");

    await network.provider.request({
      method: "hardhat_reset",
      params: HARDHAT_FORK_CURRENT_PARAMS,
    });
  });

  beforeEach(async function () {
    // Deploy the tokens used for tests.
    this.rJOE = await this.RocketJoeTokenCF.deploy();
    // XXX: Should we replace this with a standard ERC20?
    this.AUCTOK = await this.ERC20TokenCF.deploy();

    // Keep a reference to the current block.
    this.block = await ethers.provider.getBlock();

    this.RocketFactory = await deployRocketFactory(
      this.dev,
      this.rJOE,
      this.penaltyCollector
    );

    // Send the tokens used to the issuer and approve spending to the factory.
    await this.AUCTOK.connect(this.dev).mint(
      this.dev.address,
      ethers.utils.parseEther("105")
    );
    await this.AUCTOK.connect(this.dev).approve(
      this.RocketFactory.address,
      ethers.utils.parseEther("105")
    );
    await this.rJOE
      .connect(this.dev)
      .mint(this.participant.address, ethers.utils.parseEther("150")); // 150 rJOE

    this.LaunchEvent = await createLaunchEvent(
      this.RocketFactory,
      this.issuer,
      this.block,
      this.AUCTOK
    );

    await advanceTimeAndBlock(duration.seconds(120));
    await this.LaunchEvent.connect(this.participant).depositAVAX({
      value: ethers.utils.parseEther("1.0"),
    });
    expect(
      this.LaunchEvent.getUserInfo(this.participant.address).amount
    ).to.equal(ethers.utils.parseEther("1.0").number);

    await advanceTimeAndBlock(duration.days(2));
  });

  describe("interacting with phase two", function () {
    it("should revert if withdraw liquidity", async function () {
      expect(
        this.LaunchEvent.connect(this.participant).withdrawLiquidity()
      ).to.be.revertedWith(
        "LaunchEvent: can't withdraw before user's timelock"
      );
    });

    it("should revert if issuer withdraw liquidity", async function () {
      expect(
        this.LaunchEvent.connect(this.issuer).withdrawLiquidity()
      ).to.be.revertedWith(
        "LaunchEvent: can't withdraw before issuer's timelock"
      );
    });

    it("should revert if deposited", async function () {
      expect(
        this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("LaunchEvent: not in phase one");
    });

    it("should revert try to create pool", async function () {
      expect(
        this.LaunchEvent.connect(this.participant).createPair()
      ).to.be.revertedWith("LaunchEvent: not in phase three");
    });

    it("should charge a fixed withdraw penalty", async function () {
      await this.LaunchEvent.connect(this.participant).withdrawAVAX(
        ethers.utils.parseEther("1.0")
      );
      // 40% withdraw fee in tests, 10000 starting balance.
      expect(await this.penaltyCollector.getBalance()).to.equal(
        ethers.utils.parseEther("10000.4")
      );
    });

    it("should report it is in the correct phase", async function () {
      await expect(this.LaunchEvent.currentPhase() == 2);
    });

    it("should allow emergency withdraw to issuer when stopped", async function () {
      await expect(
        this.LaunchEvent.connect(this.issuer).emergencyWithdraw()
      ).to.be.revertedWith("LaunchEvent: is still running");
      await this.LaunchEvent.connect(this.dev).allowEmergencyWithdraw();
      await expect(await this.AUCTOK.balanceOf(this.issuer.address)).to.equal(
        0
      );
      await this.LaunchEvent.connect(this.issuer).emergencyWithdraw();
      await expect(
        await this.AUCTOK.balanceOf(this.LaunchEvent.address)
      ).to.equal(0);
      await expect(await this.AUCTOK.balanceOf(this.issuer.address)).to.equal(
        ethers.utils.parseEther("105.0")
      );
    });

    it("should allow emergency withdraw to user when stopped", async function () {
      await expect(
        this.LaunchEvent.connect(this.participant).emergencyWithdraw()
      ).to.be.revertedWith("LaunchEvent: is still running");
      await this.LaunchEvent.connect(this.dev).allowEmergencyWithdraw();
      const balanceBefore = await this.participant.getBalance();
      await this.LaunchEvent.connect(this.participant).emergencyWithdraw();
      // `closeTo` is used as an inaccurate approximation of gas fees.
      await expect(await this.participant.getBalance()).to.be.closeTo(
        balanceBefore.add(ethers.utils.parseEther("1")),
        ethers.utils.parseEther("0.1")
      );
    });
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});
