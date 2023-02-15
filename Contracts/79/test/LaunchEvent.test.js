const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { HARDHAT_FORK_CURRENT_PARAMS } = require("./utils/hardhat");
const {
  getWavax,
  getJoeFactory,
  deployRocketFactory,
  createLaunchEvent,
} = require("./utils/contracts");

describe("launch event contract initialisation", function () {
  before(async function () {
    // The wallets taking part in tests.
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.penaltyCollector = this.signers[1];
    this.issuer = this.signers[2];
    this.participant = this.signers[3];
    this.factory = await getJoeFactory();
    this.wavax = await getWavax();

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

    // Keep a reference to the current block.
    this.block = await ethers.provider.getBlock();

    // Send the tokens used to the issuer and approve spending to the factory.
    await this.AUCTOK.connect(this.dev).mint(
      this.dev.address,
      ethers.utils.parseEther("105")
    );
    await this.AUCTOK.connect(this.dev).approve(
      this.RocketFactory.address,
      ethers.utils.parseEther("105")
    );

    // Valid initialization parameters for `createRJLaunchEvent` used as
    // base arguments when we want to check reversions for specific values.
    this.validParams = {
      _issuer: this.issuer.address,
      _auctionStart: this.block.timestamp + 60,
      _token: this.AUCTOK.address,
      _tokenAmount: 100,
      _tokenIncentivesPercent: ethers.utils.parseEther("0.05"),
      _floorPrice: 1,
      _withdrawPenaltyGradient: 2893517,
      _fixedWithdrawPenalty: 4e11,
      _maxAllocation: 100,
      _userTimelock: 60 * 60 * 24 * 7,
      _issuerTimelock: 60 * 60 * 24 * 8,
    };
  });

  describe("initialising the contract", function () {
    it("should create a launch event if pair created with no liquidity", async function () {
      await this.factory.createPair(this.AUCTOK.address, this.wavax.address);
      await this.RocketFactory.createRJLaunchEvent(
        this.validParams._issuer,
        this.validParams._auctionStart,
        this.validParams._token,
        this.validParams._tokenAmount,
        this.validParams._tokenIncentivesPercent,
        this.validParams._floorPrice,
        this.validParams._withdrawPenaltyGradient,
        this.validParams._fixedWithdrawPenalty,
        this.validParams._maxAllocation,
        this.validParams._userTimelock,
        this.validParams._issuerTimelock
      );
    });

    const testReverts = async (factory, args, message) => {
      await expect(
        factory.createRJLaunchEvent(
          args._issuer,
          args._auctionStart,
          args._token,
          args._tokenAmount,
          args._tokenIncentivesPercent,
          args._floorPrice,
          args._withdrawPenaltyGradient,
          args._fixedWithdrawPenalty,
          args._maxAllocation,
          args._userTimelock,
          args._issuerTimelock
        )
      ).to.be.revertedWith(message);
    };

    it("should revert if issuer address is 0", async function () {
      const args = {
        ...this.validParams,
        _issuer: ethers.constants.AddressZero,
      };
      await testReverts(
        this.RocketFactory,
        args,
        "RJFactory: issuer can't be 0 address"
      );
    });

    it("should revert if token address is 0", async function () {
      const args = {
        ...this.validParams,
        _token: ethers.constants.AddressZero,
      };
      await testReverts(
        this.RocketFactory,
        args,
        "RJFactory: token can't be 0 address"
      );
    });

    it("should revert if startime has elapsed", async function () {
      const args = {
        ...this.validParams,
        _auctionStart: this.block.timestamp - 1,
      };
      await testReverts(
        this.RocketFactory,
        args,
        "LaunchEvent: start of phase 1 cannot be in the past"
      );
    });

    it("should revert if token is wavax", async function () {
      const args = {
        ...this.validParams,
        _token: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      };
      await testReverts(
        this.RocketFactory,
        args,
        "RJFactory: token can't be wavax"
      );
    });

    it("should revert initialisation if launch pair already exists (USDC)", async function () {
      const args = {
        ...this.validParams,
        _token: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      };
      await testReverts(
        this.RocketFactory,
        args,
        "RJFactory: liquid pair already exists"
      );
    });

    it("should revert if max withdraw penalty is too high", async function () {
      const args = {
        ...this.validParams,
        _withdrawPenaltyGradient: ethers.utils.parseEther("0.5").add("1"),
      };
      await testReverts(
        this.RocketFactory,
        args,
        "LaunchEvent: maxWithdrawPenalty too big"
      );
    });

    it("should revert if fixed withdraw penalty is too high", async function () {
      const args = {
        ...this.validParams,
        _fixedWithdrawPenalty: ethers.utils.parseEther("0.5").add("1"),
      };
      await testReverts(
        this.RocketFactory,
        args,
        "LaunchEvent: fixedWithdrawPenalty too big"
      );
    });

    it("should revert initialisation if user timelock is too long", async function () {
      const args = {
        ...this.validParams,
        _userTimelock: 60 * 60 * 24 * 7 + 1,
      };
      await testReverts(
        this.RocketFactory,
        args,
        "LaunchEvent: can't lock user LP for more than 7 days"
      );
    });

    it("should revert initialisation if issuer timelock is before user", async function () {
      const args = {
        ...this.validParams,
        _userTimelock: 60 * 60 * 24 * 7,
        _issuerTimelock: 60 * 60 * 24 * 7 - 1,
      };
      await testReverts(
        this.RocketFactory,
        args,
        "LaunchEvent: issuer can't withdraw before users"
      );
    });

    it("should deploy with correct paramaters", async function () {
      await expect(
        this.RocketFactory.createRJLaunchEvent(
          this.validParams._issuer,
          this.validParams._auctionStart,
          this.validParams._token,
          this.validParams._tokenAmount,
          this.validParams._tokenIncentivesPercent,
          this.validParams._floorPrice,
          this.validParams._withdrawPenaltyGradient,
          this.validParams._fixedWithdrawPenalty,
          this.validParams._maxAllocation,
          this.validParams._userTimelock,
          this.validParams._issuerTimelock
        )
      );
    });

    it("should revert if initialised twice", async function () {
      await expect(
        this.RocketFactory.createRJLaunchEvent(
          this.validParams._issuer,
          this.validParams._auctionStart,
          this.validParams._token,
          this.validParams._tokenAmount,
          this.validParams._tokenIncentivesPercent,
          this.validParams._floorPrice,
          this.validParams._withdrawPenaltyGradient,
          this.validParams._fixedWithdrawPenalty,
          this.validParams._maxAllocation,
          this.validParams._userTimelock,
          this.validParams._issuerTimelock
        )
      );
      LaunchEvent = await ethers.getContractAt(
        "LaunchEvent",
        this.RocketFactory.getRJLaunchEvent(this.AUCTOK.address)
      );

      expect(
        LaunchEvent.initialize(
          this.validParams._issuer,
          this.validParams._auctionStart,
          this.validParams._token,
          this.validParams._tokenIncentivesPercent,
          this.validParams._floorPrice,
          this.validParams._withdrawPenaltyGradient,
          this.validParams._fixedWithdrawPenalty,
          this.validParams._maxAllocation,
          this.validParams._userTimelock,
          this.validParams._issuerTimelock
        )
      ).to.be.revertedWith("LaunchEvent: already initialized");
    });

    it("should report it is in the correct phase", async function () {
      await this.RocketFactory.createRJLaunchEvent(
        this.validParams._issuer,
        this.validParams._auctionStart,
        this.validParams._token,
        this.validParams._tokenAmount,
        this.validParams._tokenIncentivesPercent,
        this.validParams._floorPrice,
        this.validParams._withdrawPenaltyGradient,
        this.validParams._fixedWithdrawPenalty,
        this.validParams._maxAllocation,
        this.validParams._userTimelock,
        this.validParams._issuerTimelock
      );
      LaunchEvent = await ethers.getContractAt(
        "LaunchEvent",
        this.RocketFactory.getRJLaunchEvent(this.AUCTOK.address)
      );
      expect((await LaunchEvent.currentPhase()) == 0);
    });
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});
