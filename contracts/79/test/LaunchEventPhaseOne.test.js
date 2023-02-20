const { ethers, network } = require("hardhat");
const { BigNumber } = ethers;
const { expect } = require("chai");
const { advanceTimeAndBlock, duration } = require("./utils/time");
const { HARDHAT_FORK_CURRENT_PARAMS } = require("./utils/hardhat");
const { deployRocketFactory, createLaunchEvent } = require("./utils/contracts");

describe("launch event contract phase one", function () {
  before(async function () {
    // The wallets taking part in tests.
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.penaltyCollector = this.signers[1];
    this.issuer = this.signers[2];
    this.participant = this.signers[3];

    this.RocketJoeTokenCF = await ethers.getContractFactory("RocketJoeToken");
    this.ERC20TokenCF = await ethers.getContractFactory("ERC20Token");

    // Fork the avalanche network to work with WAVAX.
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
  });

  describe("interacting with phase one", function () {
    describe("depositing in phase one", function () {
      it("should revert if issuer tries to participate", async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        expect(
          this.LaunchEvent.connect(this.issuer).depositAVAX({
            value: ethers.utils.parseEther("1.0"),
          })
        ).to.be.revertedWith("LaunchEvent: issuer cannot participate");
      });

      it("should revert if sale has not started yet", async function () {
        expect(
          this.LaunchEvent.connect(this.participant).depositAVAX({
            value: ethers.utils.parseEther("1.0"),
          })
        ).to.be.revertedWith("LaunchEvent: not in phase one");
      });

      it("should allow burning of rJOE even if it's not approved", async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        await this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        });
      });

      it("should revert if withdraw zero", async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        await expect(
          this.LaunchEvent.connect(this.participant).withdrawAVAX(0)
        ).to.be.revertedWith("LaunchEvent: invalid withdraw amount");
      });

      it("should be payable with AVAX", async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        await this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        });
        expect(
          this.LaunchEvent.getUserInfo(this.participant.address).amount
        ).to.equal(ethers.utils.parseEther("1.0").number);
      });

      it("should revert on deposit if stopped", async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        await this.LaunchEvent.connect(this.dev).allowEmergencyWithdraw();
        expect(
          this.LaunchEvent.connect(this.participant).depositAVAX({
            value: 6000,
          })
        ).to.be.revertedWith("LaunchEvent: stopped");
      });

      it("should revert if AVAX sent more than max allocation", async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        expect(
          this.LaunchEvent.connect(this.participant).depositAVAX({
            value: ethers.utils.parseEther("6"),
          })
        ).to.be.revertedWith("LaunchEvent: amount exceeds max allocation");
      });

      it("should burn rJOE on succesful deposit", async function () {
        let rJOEBefore = await this.rJOE.totalSupply();

        await advanceTimeAndBlock(duration.seconds(120));

        await this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        });

        expect(await this.rJOE.totalSupply()).to.be.equal(
          rJOEBefore.sub(ethers.utils.parseEther("100.0"))
        );
      });
    });

    describe("withdrawing in phase one", function () {
      beforeEach(async function () {
        await advanceTimeAndBlock(duration.seconds(120));
        await this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        });
      });

      it("should apply no fee if withdraw in first day", async function () {
        // Test the amount received
        const balanceBefore = await this.participant.getBalance();
        await this.LaunchEvent.connect(this.participant).withdrawAVAX(
          ethers.utils.parseEther("1.0")
        );
        expect(await this.participant.getBalance()).to.be.above(balanceBefore);
        // Check the balance of penalty collecter.
        expect(await this.penaltyCollector.getBalance()).to.equal(
          ethers.utils.parseEther("10000")
        );
      });

      it("should apply gradient fee if withdraw in second day", async function () {
        await advanceTimeAndBlock(duration.hours(36));
        await this.LaunchEvent.connect(this.participant).withdrawAVAX(
          ethers.utils.parseEther("1.0")
        );

        // Check the balance of penalty collecter.
        expect(await this.penaltyCollector.getBalance()).to.be.above(
          ethers.utils.parseEther("10000")
        );
      });

      it("should keep allocation after withdraw", async function () {
        await advanceTimeAndBlock(duration.hours(36));
        const allocationBefore = this.LaunchEvent.getUserInfo(
          this.participant.address
        );
        await this.LaunchEvent.connect(this.participant).withdrawAVAX(
          ethers.utils.parseEther("1.0")
        );
        const allocation = this.LaunchEvent.getUserInfo(
          this.participant.address
        );
        expect(allocation.allocation).to.be.equal(allocationBefore.allocation);
      });

      it("can deposit when have excess allocation", async function () {
        await advanceTimeAndBlock(duration.hours(36));
        await this.LaunchEvent.connect(this.participant).withdrawAVAX(
          ethers.utils.parseEther("1.0")
        );
        await this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        });
      });

      it("burns enough joe when re-entering", async function () {
        await this.LaunchEvent.connect(this.participant).withdrawAVAX(
          ethers.utils.parseEther("0.5")
        );

        await this.LaunchEvent.connect(this.participant).depositAVAX({
          value: ethers.utils.parseEther("1.0"),
        });
      });
    });

    it("should revert if not stopped by RJFactory owner", async function () {
      // issuer of the LaunchEvent
      await expect(
        this.LaunchEvent.connect(this.issuer).allowEmergencyWithdraw()
      ).to.be.revertedWith("LaunchEvent: caller is not RocketJoeFactory owner");

      // any user
      await expect(
        this.LaunchEvent.connect(this.participant).allowEmergencyWithdraw()
      ).to.be.revertedWith("LaunchEvent: caller is not RocketJoeFactory owner");
    });

    it("should revert try to create pool during phase one", async function () {
      await advanceTimeAndBlock(duration.seconds(120));
      expect(
        this.LaunchEvent.connect(this.dev).createPair()
      ).to.be.revertedWith("LaunchEvent: not in phase three");
    });

    it("should revert trying to send AVAX to the contract", async function () {
      await expect(
        this.participant.sendTransaction({
          to: this.LaunchEvent.address,
          value: ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith(
        "LaunchEvent: you can't send AVAX directly to this contract"
      );
    });

    it("should report it is in the correct phase", async function () {
      await expect(this.LaunchEvent.currentPhase() == 1);
    });
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});
