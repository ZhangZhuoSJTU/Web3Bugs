const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { HARDHAT_FORK_CURRENT_PARAMS } = require("./utils/hardhat");
const { deployRocketFactory, createLaunchEvent } = require("./utils/contracts");

describe("rocket factory test", function () {
  before(async function () {
    // The wallets taking part in tests.
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.penaltyCollector = this.signers[1];
    this.issuer = this.signers[2];

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

    this.RocketFactory = await deployRocketFactory(
      this.dev,
      this.rJOE,
      this.penaltyCollector
    );
  });

  it("should set rJoe token address", async function () {
    const rJOE2 = await this.RocketJoeTokenCF.deploy();
    await expect(
      this.RocketFactory.connect(this.issuer).setRJoe(rJOE2.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // should revert if address is 0x0
    await expect(
      this.RocketFactory.connect(this.dev).setRJoe(ethers.constants.AddressZero)
    ).to.be.revertedWith("function call to a non-contract account");

    // should revert if address has no `initialize` function
    await expect(
      this.RocketFactory.connect(this.dev).setRJoe(this.AUCTOK.address)
    ).to.be.revertedWith(
      "function selector was not recognized and there's no fallback function"
    );

    await this.RocketFactory.connect(this.dev).setRJoe(rJOE2.address);
    expect(await rJOE2.rocketJoeFactory()).to.be.equal(
      this.RocketFactory.address
    );

    // should revert if called twice on the same address
    await expect(
      this.RocketFactory.connect(this.dev).setRJoe(rJOE2.address)
    ).to.be.revertedWith("RocketJoeToken: already initialized");

    expect(await this.RocketFactory.rJoe()).to.equal(rJOE2.address);
  });

  it("should set penalty collector token address", async function () {
    await expect(
      this.RocketFactory.connect(this.issuer).setPenaltyCollector(
        this.signers[9].address
      )
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await this.RocketFactory.connect(this.dev).setPenaltyCollector(
      this.signers[8].address
    );
    expect(await this.RocketFactory.penaltyCollector()).to.equal(
      this.signers[8].address
    );
  });

  it("should set router token address", async function () {
    await expect(
      this.RocketFactory.connect(this.issuer).setRouter(this.signers[9].address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await this.RocketFactory.connect(this.dev).setRouter(
      this.signers[8].address
    );
    expect(await this.RocketFactory.router()).to.equal(this.signers[8].address);
  });

  it("should set factory address", async function () {
    await expect(
      this.RocketFactory.connect(this.issuer).setFactory(
        this.signers[9].address
      )
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await this.RocketFactory.connect(this.dev).setFactory(
      this.signers[8].address
    );
    expect(await this.RocketFactory.factory()).to.equal(
      this.signers[8].address
    );
  });

  it("should set rJoe per avax address", async function () {
    await expect(
      this.RocketFactory.connect(this.issuer).setRJoePerAvax(
        ethers.utils.parseEther("1")
      )
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await this.RocketFactory.connect(this.dev).setRJoePerAvax(
      ethers.utils.parseEther("31337")
    );
    expect(await this.RocketFactory.rJoePerAvax()).to.equal(
      ethers.utils.parseEther("31337")
    );
  });

  it("should increment the number of launch events", async function () {
    expect(await this.RocketFactory.numLaunchEvents()).to.equal(0);
    const token1 = await this.RocketJoeTokenCF.deploy();
    await token1
      .connect(this.dev)
      .mint(this.dev.address, ethers.utils.parseEther("105"));
    await token1
      .connect(this.dev)
      .approve(this.RocketFactory.address, ethers.utils.parseEther("105"));
    await createLaunchEvent(
      this.RocketFactory,
      this.issuer,
      await ethers.provider.getBlock(),
      token1
    );
    expect(await this.RocketFactory.numLaunchEvents()).to.equal(1);

    const token2 = await this.RocketJoeTokenCF.deploy();

    await token2
      .connect(this.dev)
      .mint(this.dev.address, ethers.utils.parseEther("105"));
    await token2
      .connect(this.dev)
      .approve(this.RocketFactory.address, ethers.utils.parseEther("105"));
    await createLaunchEvent(
      this.RocketFactory,
      this.issuer,
      await ethers.provider.getBlock(),
      token2
    );
    expect(await this.RocketFactory.numLaunchEvents()).to.equal(2);
  });

  it("should change duration of phases", async function () {
    await this.RocketFactory.connect(this.dev).setPhaseDuration(1, 3 * 86_400);

    expect(await this.RocketFactory.PHASE_ONE_DURATION()).to.be.equal(
      3 * 86_400
    );

    await this.RocketFactory.connect(this.dev).setPhaseDuration(2, 5 * 86_400);

    expect(await this.RocketFactory.PHASE_TWO_DURATION()).to.be.equal(
      5 * 86_400
    );
  });

  it("should change duration of the no phase duration", async function () {
    await this.RocketFactory.connect(this.dev).setPhaseOneNoFeeDuration(3_600);

    expect(await this.RocketFactory.PHASE_ONE_NO_FEE_DURATION()).to.be.equal(
      3_600
    );
  });

  it("should revert if duration are not set accordingly", async function () {
    await expect(
      this.RocketFactory.connect(this.dev).setPhaseDuration(1, 86_400)
    ).to.be.revertedWith(
      "RJFactory: phase one duration lower than no fee duration"
    );
    await expect(
      this.RocketFactory.connect(this.dev).setPhaseOneNoFeeDuration(2 * 86_400)
    ).to.be.revertedWith(
      "RJFactory: no fee duration bigger than phase one duration"
    );
  });

  it("should revert if user tries to change phase duration", async function () {
    await expect(
      this.RocketFactory.connect(this.issuer).setPhaseDuration(1, 999_999)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});
