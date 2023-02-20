const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");

describe("Limbo", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  let toggleWhiteList;
  const zero = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();

    const MockAngband = await ethers.getContractFactory("MockAngband");
    this.mockAngband = await MockAngband.deploy();

    const addTokenPowerFactory = await ethers.getContractFactory("MockAddTokenPower");
    this.addTokenPower = await addTokenPowerFactory.deploy();

    const MockBehodlerFactory = await ethers.getContractFactory("MockBehodler");
    this.mockBehodler = await MockBehodlerFactory.deploy("Scarcity", "SCX", this.addTokenPower.address);

    const TransferHelperFactory = await ethers.getContractFactory("TransferHelper");
    const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await TransferHelperFactory.deploy()).address,
      },
    });

    this.limboDAO = await LimboDAOFactory.deploy();

    this.TokenFactory = await ethers.getContractFactory("MockToken");
    this.eye = await this.TokenFactory.deploy("eye", "eye", [], []);

    this.aave = await this.TokenFactory.deploy("aave", "aave", [], []);
    this.dai = await this.TokenFactory.deploy("DAI", "DAI", [], []);
    await this.dai.mint("600000000");
    await this.dai.transfer(this.mockBehodler.address, "600000000");

    const flashGovernanceFactory = await ethers.getContractFactory("FlashGovernanceArbiter");
    this.flashGovernance = await flashGovernanceFactory.deploy(this.limboDAO.address);

    await this.flashGovernance.configureSecurityParameters(10, 100, 30);
    // await this.eye.approve(this.limbo.address, 2000);
    await this.flashGovernance.configureFlashGovernance(this.eye.address, 1000, 10, true);

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(this.limboDAO.address);

    const SoulLib = await ethers.getContractFactory("SoulLib");
    const CrossingLib = await ethers.getContractFactory("CrossingLib");
    const MigrationLib = await ethers.getContractFactory("MigrationLib");
    const LimboFactory = await ethers.getContractFactory("Limbo", {
      libraries: {
        SoulLib: (await SoulLib.deploy()).address,
        CrossingLib: (await CrossingLib.deploy()).address,
        MigrationLib: (await MigrationLib.deploy()).address,
      },
    });
    this.limbo = await LimboFactory.deploy(
      this.flan.address,
      //  10000000,
      this.limboDAO.address
    );

    await this.flan.whiteListMinting(this.limbo.address, true);
    await this.flan.whiteListMinting(owner.address, true);
    // await this.flan.endConfiguration();

    await this.addTokenPower.seed(this.mockBehodler.address, this.limbo.address);

    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapFactory");

    const sushiSwapFactory = await UniswapFactoryFactory.deploy();
    const uniswapFactory = await UniswapFactoryFactory.deploy();

    const firstProposalFactory = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
    this.whiteListingProposal = await firstProposalFactory.deploy(this.limboDAO.address, "toggle whitelist");

    const morgothTokenApproverFactory = await ethers.getContractFactory("MockMorgothTokenApprover");

    this.morgothTokenApprover = await morgothTokenApproverFactory.deploy();

    const soulUpdateProposalFactory = await ethers.getContractFactory("UpdateSoulConfigProposal");

    this.soulUpdateProposal = await soulUpdateProposalFactory.deploy(
      this.limboDAO.address,
      "hello",
      this.limbo.address,
      this.morgothTokenApprover.address
    );

    //  const flanSCXPair = await sushiSwapFactory.
    this.ProposalFactoryFactory = await ethers.getContractFactory("ProposalFactory");
    this.proposalFactory = await this.ProposalFactoryFactory.deploy(
      this.limboDAO.address,
      this.whiteListingProposal.address,
      this.soulUpdateProposal.address
    );

    await this.limboDAO.seed(
      this.limbo.address,
      this.flan.address,
      this.eye.address,
      this.proposalFactory.address,
      sushiSwapFactory.address,
      uniswapFactory.address,
      this.flashGovernance.address,
      9,
      [],
      []
    );

    await this.limbo.setDAO(this.limboDAO.address);

    await this.limboDAO.makeLive();

    const SoulReaderFactory = await ethers.getContractFactory("SoulReader");
    this.soulReader = await SoulReaderFactory.deploy();

    const UniswapHelperFactory = await ethers.getContractFactory("UniswapHelper");
    this.uniswapHelper = await UniswapHelperFactory.deploy(this.limbo.address, this.limboDAO.address);
    await this.flan.whiteListMinting(this.uniswapHelper.address, true);

    const migrationTokenPairFactory = await ethers.getContractFactory("MockMigrationUniPair");
    this.migrationTokenPair = await migrationTokenPairFactory.deploy("uni", "uni");
    await this.migrationTokenPair.setReserves(1000, 3000);

    await this.uniswapHelper.configure(
      this.limbo.address,
      this.migrationTokenPair.address,
      this.mockBehodler.address,
      this.flan.address,
      110,
      32,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    await this.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000,
      100
    );

    toggleWhiteList = toggleWhiteListFactory(this.eye, this.limboDAO, this.whiteListingProposal, this.proposalFactory);

    const TokenProxyRegistry = await ethers.getContractFactory("TokenProxyRegistry");
    this.registry = await TokenProxyRegistry.deploy(this.limboDAO.address);
  });

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };

  const advanceBlocks = async (blocks) => {
    for (let i = 0; i < blocks; i++) {
      await network.provider.send("evm_mine");
    }
  };

  const stringifyBigNumber = (b) => b.map((i) => i.toString());

  var toggleWhiteListFactory = (eye, dao, whiteListingProposal, proposalFactory) => {
    return async function (contractToToggle) {
      await whiteListingProposal.parameterize(proposalFactory.address, contractToToggle);
      const requiredFateToLodge = (await dao.proposalConfig())[1];

      await eye.mint(requiredFateToLodge);
      await eye.approve(dao.address, requiredFateToLodge.mul(2));
      await dao.burnAsset(eye.address, requiredFateToLodge.div(5).add(10));

      await proposalFactory.lodgeProposal(whiteListingProposal.address);
      await dao.vote(whiteListingProposal.address, "100");
      await advanceTime(100000000);
      await dao.executeCurrentProposal();
    };
  };

  it("governance actions free to be invoked until configured set to true", async function () {
    //first invoke all of these successfully, then set config true and try again

    //onlySuccessfulProposal:
    //configureSoul
    await this.limbo.configureSoul(this.aave.address, 10000000, 0, 0, 0, 10000000);
    await this.aave.transfer(this.limbo.address, 1000);
    //enableProtocol
    await this.limbo.enableProtocol();

    //governanceShutdown
    await this.limbo.adjustSoul(this.aave.address, 1, 0, 10);
    //withdrawERC20
    console.log(`secondPerson: ${secondPerson.address}`);

    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000,
      0
    );

    //governanceApproved:
    //disableProtocol
    await this.limbo.disableProtocol();
    await this.limbo.enableProtocol();
    //adjustSoul
    await this.limbo.adjustSoul(this.aave.address, 1, 0, 10);
    //configureCrossingParameters

    await this.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await this.limbo.endConfiguration();

    await expect(this.limbo.configureSoul(this.aave.address, 10000000, 0, 0, 0, 10000000)).to.be.revertedWith("EJ");
    // await this.aave.transfer(this.limbo.address, 1000);
    // enableProtocol
    await expect(this.limbo.enableProtocol()).to.be.revertedWith("EJ");
    //governanceShutdown
    //configureCrossingConfig
    await expect(
      this.limbo.configureCrossingConfig(
        this.mockBehodler.address,
        this.mockAngband.address,
        this.uniswapHelper.address,
        this.addTokenPower.address,
        10000000,
        10000,
        0
      )
    ).to.be.revertedWith("EJ");

    //governanceApproved:
    //disableProtocol
    await expect(this.limbo.disableProtocol()).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    await expect(this.limbo.enableProtocol()).to.be.revertedWith("EJ");
    //adjustSoul
    await expect(this.limbo.adjustSoul(this.aave.address, 1, 0, 10)).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
    //configureCrossingParameters

    await expect(this.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010)).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
  });

  it("old souls can be claimed from", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);
    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    const flanImmediatelyAfterSecondStake = await this.flan.balanceOf(owner.address);

    expect(flanImmediatelyAfterSecondStake.gt("900000000000") && flanImmediatelyAfterSecondStake.lt("900050000000")).to
      .be.true;

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, this.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");
    //claim

    await this.limbo.claimReward(this.aave.address, 0);
    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    expect(flanBalanceAfter.sub(flanImmediatelyAfterSecondStake).toString()).to.equal("0");
  });

  it("old souls can be bonus claimed from (DELTA = 0)", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await this.limbo.configureCrossingParameters(this.aave.address, 21000000, 0, true, 10000000);

    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");

    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, this.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");
    //claim

    await this.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    const lowerLimit = BigInt("900000000210");
    const upperLimit = BigInt("900020000210");
    const difference = BigInt(flanBalanceAfter.sub(flanBalanceBefore).toString());
    assert.isTrue(difference >= lowerLimit && difference <= upperLimit);
  });

  it("old souls can be bonus claimed from (DELTA > 0)", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await this.limbo.configureCrossingParameters(this.aave.address, 21000000, 10000000, true, 10000000);

    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, this.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");

    await this.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    expect(flanBalanceAfter.sub(flanBalanceBefore).toString()).to.equal(
      "900019000710" //crossing bonus * staked tokens.
    );
  });

  it("old souls can be bonus claimed from (DELTA < 0)", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await this.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(44000); //half a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, this.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");

    await this.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    const lowerBound = "440010199559";
    const upperBound = "440030199559";
    const change = flanBalanceAfter.sub(flanBalanceBefore);
    const gtLB = change.gte(lowerBound);
    const ltUP = change.lte(upperBound);
    expect(gtLB && ltUP).to.be.true;
  });

  it("perpetual pools have no upper limit", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(this.aave.address, 10000000, 2, 1, 0, 10000000);

    await this.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    await this.limbo.endConfiguration();

    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000001");

    const stats = await this.soulReader.SoulStats(this.aave.address, this.limbo.address);
    expect(stats[0].toNumber()).to.equal(1);
  });

  it("use flashGovernance to adjustSoul", async function () {
    //configure soul
    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await this.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration();
    //end configuration
    await this.limbo.endConfiguration();

    //try to adjust soul and fail
    await expect(this.limbo.adjustSoul(this.aave.address, 1, 10, 200)).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );

    //stake requisite tokens, try again and succeed.
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await this.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001);

    const newStates = await this.soulReader.CrossingParameters(this.aave.address, this.limbo.address);

    //assert newStates
    const stringNewStates = stringifyBigNumber(newStates);
    expect(stringNewStates[0]).to.equal("20000000001");
    expect(stringNewStates[1]).to.equal("-1001");
  });

  it("flashGovernance adjust configureCrossingParameters", async function () {
    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration();
    //end configuration
    await this.limbo.endConfiguration();
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await this.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await expect(this.flashGovernance.withdrawGovernanceAsset(this.limbo.address, this.eye.address)).to.be.revertedWith(
      "Limbo: Flashgovernance decision pending."
    );

    await advanceTime(604801);

    const eyeBalanceBefore = await this.eye.balanceOf(owner.address);
    await this.flashGovernance.withdrawGovernanceAsset(this.limbo.address, this.eye.address);
    const eyeBalanceAfter = await this.eye.balanceOf(owner.address);

    expect(eyeBalanceAfter.sub(eyeBalanceBefore).toString()).to.equal("21000000");
  });

  it("burn asset for flashGov decision", async function () {
    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration();
    //end configuration
    await this.limbo.endConfiguration();

    //make flashgovernance decision.
    await this.eye.approve(this.flashGovernance.address, 21000000);

    // //we need fate to lodge proposal.
    const requiredFate = (await this.limboDAO.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    console.log("EYE to burn " + eyeToBurn.toString());
    await this.eye.approve(this.limboDAO.address, eyeToBurn.mul(100));
    await this.limboDAO.burnAsset(this.eye.address, eyeToBurn);

    //configure and lodge proposal
    const burnFlashStakeProposalFactory = await ethers.getContractFactory("BurnFlashStakeDeposit");
    const burnFlashStakeProposal = await burnFlashStakeProposalFactory.deploy(this.limboDAO.address, "burnFlash");
    await burnFlashStakeProposal.parameterize(
      owner.address,
      this.eye.address,
      "21000000",
      this.flashGovernance.address,
      this.limbo.address
    );

    await toggleWhiteList(burnFlashStakeProposal.address);

    await this.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);
    await this.proposalFactory.lodgeProposal(burnFlashStakeProposal.address);
    let currentProposal = (await this.limboDAO.currentProposalState())[4];
    console.log("proposal: " + currentProposal);
    expect(currentProposal.toString() !== "0x0000000000000000000000000000000000000000").to.be.true;

    //get more fate to vote
    await this.limboDAO.burnAsset(this.eye.address, "10000");

    //vote on proposal
    await this.limboDAO.vote(burnFlashStakeProposal.address, "10000");

    const flashGovConfig = await this.flashGovernance.flashGovernanceConfig();
    const advancement = flashGovConfig[2].sub(1000);
    console.log("advancement: " + advancement.toString());
    //fast forward time to after voting round finishes but before flash asset unlocked
    await advanceTime(advancement.toNumber()); //more time

    //assert eye locked for user
    const pendingBeforeAttempt = await this.flashGovernance.pendingFlashDecision(this.limbo.address, owner.address);
    expect(pendingBeforeAttempt[1].toString()).to.equal("21000000");

    //try to withdraw flash gov asset and fail. Assert money still there
    await expect(this.flashGovernance.withdrawGovernanceAsset(this.limbo.address, this.eye.address)).to.be.revertedWith(
      "Limbo: Flashgovernance decision pending."
    );

    //execute burn proposal

    const eyeTotalsupplyBefore = await this.eye.totalSupply();
    const eyeInFlashGovBefore = await this.eye.balanceOf(this.flashGovernance.address);

    await this.limboDAO.executeCurrentProposal();

    const eyeInFlashGovAfter = await this.eye.balanceOf(this.flashGovernance.address);
    const eyeTotalsupplyAfter = await this.eye.totalSupply();
    const pendingAfterAttempt = await this.flashGovernance.pendingFlashDecision(this.limbo.address, owner.address);

    expect(pendingAfterAttempt[1].toString()).to.equal("21000000");
    //assert eye has declined by 21000000
    expect(eyeInFlashGovBefore.sub(eyeInFlashGovAfter).toString()).to.equal("21000000");
    expect(eyeTotalsupplyBefore.sub(eyeTotalsupplyAfter).toString()).to.equal("21000000");
  });

  it("unstaking rewards user correctly and sets unclaimed to zero", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await this.limbo.userInfo(this.aave.address, owner.address, 0);
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const expectedFlanLowerbound = Number((10000000n * 400001n) / 1000000n);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);
    const expectedFlanUpperbound = Number((10000000n * 400006n) / 1000000n);

    await this.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await this.limbo.userInfo(this.aave.address, owner.address, 0);

    const actualFlanDiff = userFlanBalanceAfter.sub(userFlanBalanceBefore).div(1000000).toNumber();

    expect(actualFlanDiff).to.be.greaterThanOrEqual(expectedFlanLowerbound);
    expect(actualFlanDiff).to.be.lessThanOrEqual(expectedFlanUpperbound);

    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("staking and claim for multiple stakers divides reward correctly", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    await this.aave.transfer(secondPerson.address, 2000);
    await this.aave.connect(secondPerson).approve(this.limbo.address, "10000001");
    await this.limbo.connect(secondPerson).stake(this.aave.address, 2000);

    await advanceTime(400000);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);

    await this.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await this.limbo.userInfo(this.aave.address, owner.address, 0);

    const changeInFlan = userFlanBalanceAfter.sub(userFlanBalanceBefore).div("10000000").toNumber();
    console.log("change in flan " + changeInFlan);
    const lowerBound = 333335;
    const upperBound = 333339;
    assert.isAbove(changeInFlan, lowerBound);
    assert.isBelow(changeInFlan, upperBound);

    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("manually setting fps changes reward", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      2500000
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await this.limbo.userInfo(this.aave.address, owner.address, 0);
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const flanPerSecond = 10000000n;
    const expectedFlanLowerRange = Number((flanPerSecond * 400001n) / (4n * 1000000n)); // quarter rewards because sharing with other token

    const expectedFlanUpperRange = Number((flanPerSecond * 400003n) / (4n * 1000000n)); // quarter rewards because sharing with other token

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);

    await this.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await this.limbo.userInfo(this.aave.address, owner.address, 0);

    const actualFlanDiff = userFlanBalanceAfter.sub(userFlanBalanceBefore).div(1000000).toNumber();

    expect(actualFlanDiff).to.be.greaterThanOrEqual(expectedFlanLowerRange);
    expect(actualFlanDiff).to.be.lessThanOrEqual(expectedFlanUpperRange);
    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("staking only possible in staking state, unstaking possible in staking and config", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      1000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    const updateSoulConfigProposalFactory = await ethers.getContractFactory("UpdateSoulConfigProposal");
    const updateSoulConfigProposal = await updateSoulConfigProposalFactory.deploy(
      this.limboDAO.address,
      "change state",
      this.limbo.address,
      this.morgothTokenApprover.address
    );

    await this.morgothTokenApprover.addToken(this.aave.address);
    await updateSoulConfigProposal.parameterize(
      this.aave.address, //token
      10000000, //threshold
      1, //type
      2, //state = waitingToCross
      0, //index
      10 //fps
    );

    const proposalConfig = await this.limboDAO.proposalConfig();
    const requiredFate = proposalConfig[1].mul(2);
    await this.eye.approve(this.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await this.limboDAO.burnAsset(this.eye.address, requiredFate);

    await toggleWhiteList(updateSoulConfigProposal.address);
    await this.proposalFactory.lodgeProposal(updateSoulConfigProposal.address);

    await this.limboDAO.vote(updateSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await this.limboDAO.executeCurrentProposal();

    console.log("aave: " + this.aave.address);

    const SoulReaderFactory = await ethers.getContractFactory("SoulReader");
    const soulReader = await SoulReaderFactory.deploy();
    const soulStats = await soulReader.SoulStats(this.aave.address, this.limbo.address);
    expect(soulStats[0].toNumber()).to.equal(2);

    await expect(this.limbo.stake(this.aave.address, "10000")).to.be.revertedWith("E2");
    await expect(this.limbo.unstake(this.aave.address, "10000")).to.be.revertedWith("E2");

    await updateSoulConfigProposal.parameterize(
      this.aave.address, //token
      10000000, //threshold
      1, //type
      1, //state = staking
      0, //index
      10 //fps
    );

    await this.eye.approve(this.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await this.limboDAO.burnAsset(this.eye.address, requiredFate);
    await this.proposalFactory.lodgeProposal(updateSoulConfigProposal.address);

    await this.limboDAO.vote(updateSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await this.limboDAO.executeCurrentProposal();

    const balanceCheck = async () => {
      const aaveBalanceOnLimbo = await this.aave.balanceOf(this.limbo.address);
      const userStakedAaveOnLimbo = await this.limbo.userInfo(this.aave.address, owner.address, 0);

      console.log(
        `aave on Limbo: ${aaveBalanceOnLimbo}\t user staked aave on Limbo: ${userStakedAaveOnLimbo[0].toString()}`
      );
    };

    await this.aave.approve(this.limbo.address, "1000000");
    this.limbo.stake(this.aave.address, "10000");
    await balanceCheck();
    await this.limbo.unstake(this.aave.address, "500");
    await balanceCheck();
    await updateSoulConfigProposal.parameterize(
      this.aave.address, //token
      10000000, //threshold
      1, //type
      0, //state = calibration
      0, //index
      10 //fps
    );

    await this.eye.approve(this.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await this.limboDAO.burnAsset(this.eye.address, requiredFate);
    await this.proposalFactory.lodgeProposal(updateSoulConfigProposal.address);

    await this.limboDAO.vote(updateSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await this.limboDAO.executeCurrentProposal();

    await expect(this.limbo.stake(this.aave.address, "10000")).to.be.revertedWith("E2");
    const aaveBalance = await this.aave.balanceOf(this.limbo.address);
    console.log("remaining aave " + aaveBalance.toString());

    await balanceCheck();
    await this.limbo.unstake(this.aave.address, "500");
  });

  it("staking an invalid token fails", async function () {
    this.titan = await this.TokenFactory.deploy("iron", "finance", [], []);

    //stake tokens
    await this.titan.approve(this.limbo.address, "10000001");
    await this.limbo.configureSoul(
      this.titan.address,
      10000000, //crossingThreshold
      0, //soulType
      1, //state
      0,
      10000000
    );
    await expect(this.limbo.stake(this.titan.address, "10000")).to.be.revertedWith("E1");
  });

  it("unstaking amount larger than balance reverts with E4", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await expect(this.limbo.unstake(this.aave.address, "10001")).to.be.revertedWith("E4");
  });

  it("unstaking amount larger than balance reverts with E4", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await expect(this.limbo.unstake(this.aave.address, "10001")).to.be.revertedWith("E4");
  });

  it("claiming staked reward resets unclaimed to zero", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);

    const flanBeforeFirstClaim = await this.flan.balanceOf(owner.address);
    await this.limbo.claimReward(this.aave.address, 0);
    const flanAfterFirstClaim = await this.flan.balanceOf(owner.address);
    await this.limbo.claimReward(this.aave.address, 0);
    const flanAfterSecondClaim = await this.flan.balanceOf(owner.address);

    expect(flanAfterFirstClaim.gt(flanBeforeFirstClaim));
    expect(flanAfterSecondClaim).to.equal(flanAfterFirstClaim.add("10000000"));
  });

  it("claim bonus disabled during staking", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);
    await expect(this.limbo.claimBonus(this.aave.address, 0)).to.be.revertedWith("E2");
  });

  it("claiming negative bonus fails", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );

    await this.limbo.configureCrossingParameters(this.aave.address, 10, -10, true, 10000);

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "9999");

    await advanceTime(1000);
    await this.limbo.stake(this.aave.address, "2");

    await expect(this.limbo.claimBonus(this.aave.address, 0)).to.be.revertedWith("ED");
  });

  it("migration fails on not waitingToCross", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith("E2");
  });

  it("too much reserve drift between stamping and execution fails (divergenceTolerance)", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      0
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      this.migrationTokenPair.address,
      this.mockBehodler.address,
      this.flan.address,
      120,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    await this.limbo.configureSoul(
      this.aave.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = 105;

    //3×10¹⁸
    //
    await this.dai.transfer(this.mockBehodler.address, "3000000000000000000");
    await advanceTime(minQuoteWaitDuration + 1);
    await this.uniswapHelper.generateFLNQuote();

    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith("EG");
  });

  it("stamping reserves requires wait to pass before migration", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      // 20,
      // 105,
      0
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      this.migrationTokenPair.address,
      this.mockBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    await this.limbo.configureSoul(
      this.aave.address,
      2, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();
    await this.uniswapHelper.generateFLNQuote();
    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith("EH");
  });

  it("only threshold souls can migrate", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      // 20,
      // 105,
      0
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      this.migrationTokenPair.address,
      this.mockBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    await this.limbo.configureSoul(
      this.aave.address,
      100, //crossingThreshold
      2, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    const latestIndex = await this.limbo.latestIndex(this.aave.address);
    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, latestIndex);
    expect(currentSoul[4]).to.equal(1);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = 105;

    await advanceTime(minQuoteWaitDuration + 1);
    await this.uniswapHelper.generateFLNQuote();
    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith("EB");
  });

  it("multiple migrations (STABILIZE) to real uniswap tilts price", async function () {
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    const RealAngband = await ethers.getContractFactory("AngbandLite");
    const realAngband = await RealAngband.deploy();

    const RealPower = await ethers.getContractFactory("LimboAddTokenToBehodler");
    const realPower = await RealPower.deploy(
      realAngband.address,
      this.limbo.address,
      realBehodler.address,
      this.registry.address
    );

    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");

    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    await realBehodler.transfer(scxFlanPair.address, scxBalanceGenerated);
    await this.flan.mint(pairAddress, "300000000000000000000000");

    await scxFlanPair.mint(owner.address);

    await this.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      this.uniswapHelper.address,
      realPower.address,
      6756,
      1000,
      // 20,
      // 105,
      111
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);
    await this.limbo.configureSoul(
      this.aave.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "100000000000000000000001");
    await this.limbo.stake(this.aave.address, "100000000000000000000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = 105;

    await advanceBlocks(minQuoteWaitDuration + 1);

    await this.uniswapHelper.generateFLNQuote();

    const scxBalanceOfPairBefore = await realBehodler.balanceOf(pairAddress);

    const blackHoleAddress = await this.uniswapHelper.blackHole();

    const blackHoleBalanceBefore = await scxFlanPair.balanceOf(blackHoleAddress);

    const flanPairBalanceBefore = await this.flan.balanceOf(pairAddress);

    expect(scxBalanceOfPairBefore).to.equal("609176545126652594565");
    expect(flanPairBalanceBefore).to.equal("300000000000000000000000");

    await this.limbo.migrate(this.aave.address);
    const blackHoleBalanceAfter = await scxFlanPair.balanceOf(blackHoleAddress);

    expect(blackHoleBalanceAfter.gt(blackHoleBalanceBefore)).to.be.true;

    const flanPairBalanceAfter = await this.flan.balanceOf(pairAddress);
    const scxBalanceOfPairAfter = await realBehodler.balanceOf(pairAddress);

    expect(flanPairBalanceAfter.mul(1000).div(scxBalanceOfPairAfter)).to.equal(514228);

    //SECOND MIGRATION

    const mock1 = await this.TokenFactory.deploy("mock1", "mock1", [], []);

    //require DAI price of SCX to rise so that we can mint more FLN

    //change DAI price
    await this.aave.mint("100000000000000000000000");
    await this.aave.approve(realBehodler.address, "10000000000000000000000000");
    await realBehodler.addLiquidity(this.aave.address, "100000000000000000000000");

    const scxBalance = await realBehodler.balanceOf(owner.address);
    console.log("my balance: " + scxBalance);
    await realBehodler.withdrawLiquidity(this.dai.address, "140000000000000010100");

    await this.limbo.configureSoul(
      mock1.address,
      "100000000", //crossingThreshold
      1, //soulType
      1, //state
      1,
      10000000
    );
    //stake tokens
    await mock1.approve(this.limbo.address, "100000000000000000000001");
    await this.limbo.stake(mock1.address, "100000000000000000000");

    await this.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      this.uniswapHelper.address,
      realPower.address,
      6756,
      1000,
      // 20,
      // 105,
      100
    );

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    await advanceBlocks(minQuoteWaitDuration + 1);

    await this.uniswapHelper.generateFLNQuote();
    await this.limbo.migrate(mock1.address);

    const flanBalanceAfterSecondMigrate = await this.flan.balanceOf(pairAddress);
    const scxBalanceOfPairAfterSecondMigrate = await realBehodler.balanceOf(pairAddress);

    const latestPrice = await this.uniswapHelper.latestFlanQuotes(0);
    console.log("dai-scx spot: " + latestPrice[1].toString());

    const ratio = flanBalanceAfterSecondMigrate.mul(1000).div(scxBalanceOfPairAfterSecondMigrate);

    //flan strengthens
    expect(ratio).to.equal(508988);

    //  THIRD MIGRATION
    const mock2 = await this.TokenFactory.deploy("mock1", "mock1", [], []);

    await this.limbo.configureSoul(
      mock2.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      1,
      10000000
    );

    await this.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      this.uniswapHelper.address,
      realPower.address,
      6756,
      1000,
      // 20,
      // 105,
      100
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      10 //10% price overshoot on flan means 10% less flan minted
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    await mock2.mint("3000000000000000000000");
    await mock2.approve(this.limbo.address, "3000000000000000000000");
    await this.limbo.stake(mock2.address, "3000000000000000000000");

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    await advanceBlocks(minQuoteWaitDuration + 1);

    await this.uniswapHelper.generateFLNQuote();
    await this.limbo.migrate(mock2.address);

    const flanBalanceAfterThirdMigrate = await this.flan.balanceOf(pairAddress);
    const scxBalanceOfPairAfteThirdMigrate = await realBehodler.balanceOf(pairAddress);

    const ratio2 = flanBalanceAfterThirdMigrate.mul(10000).div(scxBalanceOfPairAfteThirdMigrate);

    expect(ratio2).to.equal(5068736);
  });

  it("any whitelisted contract can mint flan", async function () {
    //assert secondPerson can't mint flan
    await expect(this.flan.connect(secondPerson).mint(owner.address, 1000)).to.be.revertedWith(
      "Flan: Mint allowance exceeded"
    );

    //whitelist secondPerson
    await this.flan.whiteListMinting(secondPerson.address, true);

    const flanBefore = await this.flan.balanceOf(owner.address);
    await this.flan.connect(secondPerson).mint(owner.address, 1000);
    const flanAfter = await this.flan.balanceOf(owner.address);
    expect(flanAfter.sub(flanBefore).toString()).to.equal("1000");

    //unwhitelist secondPerson
    await this.flan.whiteListMinting(secondPerson.address, false);

    //assert secondPerson can't mint flan
    await expect(this.flan.connect(secondPerson).mint(owner.address, 1000)).to.be.revertedWith(
      "Flan: Mint allowance exceeded"
    );
  });

  it("flan burn fee on transfer proposal", async function () {
    const feechangeProposalFactory = await ethers.getContractFactory("AdjustFlanFeeOnTransferProposal");
    const feechangeProposal = await feechangeProposalFactory.deploy(this.limboDAO.address, "changer");

    await feechangeProposal.parameterize(this.flan.address, 3);

    await this.flan.mint(owner.address, 100);

    //transfer flan to second and assert 100 arrives
    await this.flan.transfer(secondPerson.address, 100);
    expect(await this.flan.balanceOf(secondPerson.address)).to.equal(100);

    //execute proposal
    await this.eye.mint("100000000000000000000");
    await this.eye.approve(this.limboDAO.address, "100000000000000000000");
    await this.limboDAO.burnAsset(this.eye.address, "100000000000000000000");
    await toggleWhiteList(feechangeProposal.address);

    await this.proposalFactory.lodgeProposal(feechangeProposal.address);
    await this.limboDAO.vote(feechangeProposal.address, 1000);

    await advanceTime(1000000000);

    await this.limboDAO.executeCurrentProposal();
    //transfer flan back to owner and assert only 97 arrive
    const totalSupplyBefore = await this.flan.totalSupply();
    await this.flan.connect(secondPerson).transfer(owner.address, 100);
    expect(await this.flan.balanceOf(owner.address)).to.equal(97);

    //assert flan supply fallen by 3
    const totalSupplyAfter = await this.flan.totalSupply();
    expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(3);
  });

  it("attemptToTargetAPY for non threshold soul fails", async function () {
    await this.limbo.configureSoul(this.aave.address, 10000000, 2, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");
    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    //configure uniswapHelper
    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      10,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    //send Flan and SCX to pair and mint
    await this.flan.mint(pairAddress, "1000000000000000000000000");
    130000000000000000000000;
    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(pairAddress, scxBalance);

    await scxFlanPair.mint(owner.address);

    //run price quote, wait required time and run quote again.
    await this.uniswapHelper.generateFLNQuote();

    await advanceBlocks(11);

    await this.uniswapHelper.generateFLNQuote();

    //flash govern set APY
    await expect(
      this.limbo.attemptToTargetAPY(
        this.aave.address,
        1300, // 13%
        0 //let helper figure this out
      )
    ).to.be.revertedWith("EI");
  });

  it("attemptToTargetAPY sets fps correctly, use to test multiple token migrations", async function () {
    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");
    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    //configure uniswapHelper
    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      10,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    //send Flan and SCX to pair and mint
    await this.flan.mint(pairAddress, "1000000000000000000000000");
    130000000000000000000000;
    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(pairAddress, scxBalance);

    await scxFlanPair.mint(owner.address);

    //run price quote, wait required time and run quote again.
    await this.uniswapHelper.generateFLNQuote();

    await advanceBlocks(11);

    await this.uniswapHelper.generateFLNQuote();

    //flash govern set APY
    await this.limbo.attemptToTargetAPY(
      this.aave.address,
      1300, // 13%
      0 //let helper figure this out
    );

    //get soul info and assert fps is correct.
    //Dai per scx = 6425.272584524
    //Flan per scx = 1285.054516905
    // Dai per flan =143.486644559

    const soulInfo = await this.limbo.souls(this.aave.address, 0);
    expect(soulInfo.flanPerSecond).to.equal("20508307965499746");

    const sushi = await this.TokenFactory.deploy("Sushi", "Sushi", [], []);
    const pool = await this.TokenFactory.deploy("pool", "pool", [], []);
    //initiatialize proposal
    const updateMultipleSoulConfigProposalFactory = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal");
    await this.morgothTokenApprover.toggleManyTokens([this.aave.address, sushi.address, pool.address], true);
    const updateMultiSoulConfigProposal = await updateMultipleSoulConfigProposalFactory.deploy(
      this.limboDAO.address,
      "List many tokens",
      this.limbo.address,
      this.uniswapHelper.address,
      this.morgothTokenApprover.address
    );
    //parameterize
    await updateMultiSoulConfigProposal.parameterize(
      this.aave.address,
      10000000,
      1,
      0,
      0,
      1300,
      "5000000000000000000000000"
    );
    await updateMultiSoulConfigProposal.parameterize(sushi.address, 0, 2, 0, 0, 2600, "5000000000000000000000000");
    await updateMultiSoulConfigProposal.parameterize(pool.address, 123456, 1, 0, 0, 1300, "10000000000000000000000000");
    //lodge

    const proposalConfig = await this.limboDAO.proposalConfig();
    const requiredFate = proposalConfig[1].mul(2);
    await this.eye.approve(this.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await this.limboDAO.burnAsset(this.eye.address, requiredFate);

    await toggleWhiteList(updateMultiSoulConfigProposal.address);
    await this.proposalFactory.lodgeProposal(updateMultiSoulConfigProposal.address);

    //vote and execute
    await this.limboDAO.vote(updateMultiSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await this.limboDAO.executeCurrentProposal();

    //assert
    const aaveDetails = await this.limbo.souls(this.aave.address, 0);
    expect(aaveDetails[2]).to.equal("10000000"); //crossing threshold
    expect(aaveDetails[3]).to.equal(1); //soul type = migration
    expect(aaveDetails[5]).to.equal("20611364789446981"); //fps

    const sushiDetails = await this.limbo.souls(sushi.address, 0);
    expect(sushiDetails[2]).to.equal("0"); //crossing threshold
    expect(sushiDetails[3]).to.equal(2); //soul type = migration
    expect(sushiDetails[5]).to.equal("41222729578893962"); //fps
    41222729578893962;
    const poolDetails = await this.limbo.souls(pool.address, 0);
    expect(poolDetails[2]).to.equal("123456"); //crossing threshold
    expect(poolDetails[3]).to.equal(1); //soul type = migration
    expect(poolDetails[5]).to.equal("41222729578893962"); //fps
  });

  it("protocol token buy buck works", async function () {
    const sushi = await this.TokenFactory.deploy("Sushi", "Sushi", [], []);
    await sushi.mint("10000");
    await sushi.transfer(this.limbo.address, "10000");
    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");

    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(sushi.address, this.flan.address);
    await this.uniswapHelper.setFactory(realUniswapFactory.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, sushi.address);
    await sushi.mint("1000000000");
    await sushi.transfer(pairAddress, "1000000000");
    await this.flan.mint(pairAddress, "80000000000");

    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);
    await scxFlanPair.mint(owner.address);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);
    await sushi.approve(this.limbo.address, "10000000000");
    await this.limbo.claimSecondaryRewards(sushi.address);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    const sushibalanceOnLimboAfter = await sushi.balanceOf(this.limbo.address);

    expect(flanBalanceAfter.gt(flanBalanceBefore)).to.be.true;
    expect(sushibalanceOnLimboAfter).to.equal(0);

    await this.limbo.configureSoul(sushi.address, 10000000, 1, 1, 0, 10000000);

    await sushi.mint("10000");
    await sushi.transfer(this.limbo.address, "10000");

    await expect(this.limbo.claimSecondaryRewards(sushi.address)).to.be.revertedWith("E7");
  });

  it("flash governance tolerance enforeced for flash loan but not successful proposals or unconfigured", async function () {
    await this.flashGovernance.configureSecurityParameters(10, 100, 3);

    await this.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");
    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    //configure uniswapHelper
    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      10,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    //send Flan and SCX to pair and mint
    await this.flan.mint(pairAddress, "1000000000000000000000000");
    130000000000000000000000;
    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(pairAddress, scxBalance);

    await scxFlanPair.mint(owner.address);

    //run price quote, wait required time and run quote again.
    await this.uniswapHelper.generateFLNQuote();

    await advanceBlocks(11);

    await this.uniswapHelper.generateFLNQuote();

    //flash govern set APY
    await this.limbo.attemptToTargetAPY(
      this.aave.address,
      1300, // 13%
      0 //let helper figure this out
    );

    await this.limbo.attemptToTargetAPY(
      this.aave.address,
      2600, //more than 3% is fine when not configured
      0 //let helper figure this out
    );
  });

  it("FOT token accounting handled correctly", async function () {
    const feeOnTransferTokenFactory = await ethers.getContractFactory("MockFOTToken");
    const feeOnTransferToken = await feeOnTransferTokenFactory.deploy("FOT", "FOT", 50);
    await this.limbo.configureSoul(feeOnTransferToken.address, "10000000000", 1, 1, 0, 10000000);

    await this.limbo.configureCrossingParameters(feeOnTransferToken.address, 21000000, 0, true, "10000000000");

    await feeOnTransferToken.approve(this.limbo.address, "100000000");

    await this.limbo.stake(feeOnTransferToken.address, "100000000");

    const balanceOnLimbo = (await feeOnTransferToken.balanceOf(this.limbo.address)).toString();
    expect(balanceOnLimbo).to.equal("95000000");
    const stakedBalance = (await this.limbo.userInfo(feeOnTransferToken.address, owner.address, 0))[0].toString();
    expect(stakedBalance).to.equal("95000000");

    const bigBalanceBefore = BigInt((await feeOnTransferToken.balanceOf(owner.address)).toString());
    await this.limbo.unstake(feeOnTransferToken.address, "95000000");
    const bigBalanceAfter = BigInt((await feeOnTransferToken.balanceOf(owner.address)).toString());
    expect((bigBalanceAfter - bigBalanceBefore).toString()).to.equal("90250000");
  });

  it("test unstaking from another user more than allowance fails", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await this.limbo.userInfo(this.aave.address, owner.address, 0);
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const expectedFlanLowerbound = Number((10000000n * 400001n) / 1000000n);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);
    const expectedFlanUpperbound = Number((10000000n * 400006n) / 1000000n);
    await this.limbo.approveUnstake(this.aave.address, secondPerson.address, "2000");

    await this.limbo.connect(secondPerson).unstakeFor(this.aave.address, 2000, owner.address);

    await expect(this.limbo.connect(secondPerson).unstakeFor(this.aave.address, 1, owner.address)).to.be.revertedWith(
      "Arithmetic operation underflowed or overflowed outside of an unchecked block"
    );
  });

  it("token with proxy but baseToken zero simply migrates proxy", async function () {
    const proxyFactory = await ethers.getContractFactory("TokenProxy");
    const proxy = await proxyFactory.deploy("Hello", "there", this.aave.address);
    await this.registry.setProxy("0x0000000000000000000000000000000000000000", proxy.address, false);
    const aaveBalance = await this.aave.balanceOf(owner.address);
    console.log("aave balance" + aaveBalance);
    await this.aave.approve(proxy.address, "100000000000000000000");
    await proxy.mint(owner.address, "100000000000000000000");

    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);
    const RealAngband = await ethers.getContractFactory("AngbandLite");
    const realAngband = await RealAngband.deploy();

    const RealPower = await ethers.getContractFactory("LimboAddTokenToBehodler");
    const realPower = await RealPower.deploy(
      realAngband.address,
      this.limbo.address,
      realBehodler.address,
      this.registry.address
    );

    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");

    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    await realBehodler.transfer(scxFlanPair.address, scxBalanceGenerated);
    await this.flan.mint(pairAddress, "300000000000000000000000");

    await scxFlanPair.mint(owner.address);

    await this.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      this.uniswapHelper.address,
      realPower.address,
      6756,
      1000,
      // 20,
      // 105,
      111
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);
    await this.limbo.configureSoul(
      proxy.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await proxy.approve(this.limbo.address, "100000000000000000000001");
    await this.limbo.stake(proxy.address, "100000000000000000000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(proxy.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = 105;

    await advanceBlocks(minQuoteWaitDuration + 1);

    await this.uniswapHelper.generateFLNQuote();

    const scxBalanceOfPairBefore = await realBehodler.balanceOf(pairAddress);

    const blackHoleAddress = await this.uniswapHelper.blackHole();

    const blackHoleBalanceBefore = await scxFlanPair.balanceOf(blackHoleAddress);

    const flanPairBalanceBefore = await this.flan.balanceOf(pairAddress);

    expect(scxBalanceOfPairBefore).to.equal("609176545126652594565");
    expect(flanPairBalanceBefore).to.equal("300000000000000000000000");

    await this.limbo.migrate(proxy.address);

    const balanceOfProxyOnBehodler = (await proxy.balanceOf(realBehodler.address)).toString();
    expect(balanceOfProxyOnBehodler).to.not.equal("0");

    const aaveBalanceOnBehodler = await this.aave.balanceOf(realBehodler.address);
    expect(aaveBalanceOnBehodler).to.equal("0");
  });
  it("token with proxy and baseToken with migrateToBehodler true migrates baseToken", async function () {
    const proxyFactory = await ethers.getContractFactory("TokenProxy");
    const proxy = await proxyFactory.deploy("Hello", "there", this.aave.address);
    await this.registry.setProxy(this.aave.address, proxy.address, true);
    const aaveBalance = await this.aave.balanceOf(owner.address);
    console.log("aave balance" + aaveBalance);
    await this.aave.approve(proxy.address, "100000000000000000000");
    await proxy.mint(owner.address, "100000000000000000000");

    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);
    const RealAngband = await ethers.getContractFactory("AngbandLite");
    const realAngband = await RealAngband.deploy();

    const RealPower = await ethers.getContractFactory("LimboAddTokenToBehodler");
    const realPower = await RealPower.deploy(
      realAngband.address,
      this.limbo.address,
      realBehodler.address,
      this.registry.address
    );

    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");

    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    await realBehodler.transfer(scxFlanPair.address, scxBalanceGenerated);
    await this.flan.mint(pairAddress, "300000000000000000000000");

    await scxFlanPair.mint(owner.address);

    await this.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      this.uniswapHelper.address,
      realPower.address,
      6756,
      1000,
      // 20,
      // 105,
      111
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);
    await this.limbo.configureSoul(
      proxy.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await proxy.approve(this.limbo.address, "100000000000000000000001");
    await this.limbo.stake(proxy.address, "100000000000000000000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(proxy.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = 105;

    await advanceBlocks(minQuoteWaitDuration + 1);

    await this.uniswapHelper.generateFLNQuote();

    const scxBalanceOfPairBefore = await realBehodler.balanceOf(pairAddress);

    const blackHoleAddress = await this.uniswapHelper.blackHole();

    const blackHoleBalanceBefore = await scxFlanPair.balanceOf(blackHoleAddress);

    const flanPairBalanceBefore = await this.flan.balanceOf(pairAddress);

    expect(scxBalanceOfPairBefore).to.equal("609176545126652594565");
    expect(flanPairBalanceBefore).to.equal("300000000000000000000000");

    await this.limbo.migrate(proxy.address);

    const balanceOfProxyOnBehodler = (await proxy.balanceOf(realBehodler.address)).toString();
    expect(balanceOfProxyOnBehodler).to.equal("0");

    const aaveBalanceOnBehodler = await this.aave.balanceOf(realBehodler.address);
    expect(aaveBalanceOnBehodler).to.not.equal("0");
  });

  it("token with proxy and baseToken with migrateToBehodler false migrates proxy", async function () {
    const proxyFactory = await ethers.getContractFactory("TokenProxy");
    const proxy = await proxyFactory.deploy("Hello", "there", this.aave.address);
    await this.registry.setProxy(this.aave.address, proxy.address, false);
    const aaveBalance = await this.aave.balanceOf(owner.address);
    console.log("aave balance" + aaveBalance);
    await this.aave.approve(proxy.address, "100000000000000000000");
    await proxy.mint(owner.address, "100000000000000000000");

    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);
    const RealAngband = await ethers.getContractFactory("AngbandLite");
    const realAngband = await RealAngband.deploy();

    const RealPower = await ethers.getContractFactory("LimboAddTokenToBehodler");
    const realPower = await RealPower.deploy(
      realAngband.address,
      this.limbo.address,
      realBehodler.address,
      this.registry.address
    );

    const RealUniswapFactoryFactory = await ethers.getContractFactory("RealUniswapV2Factory");
    const RealUniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");

    const realUniswapFactory = await RealUniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const pairAddress = await realUniswapFactory.getPair(this.flan.address, realBehodler.address);
    const scxFlanPair = await RealUniswapPairFactory.attach(pairAddress);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    await realBehodler.transfer(scxFlanPair.address, scxBalanceGenerated);
    await this.flan.mint(pairAddress, "300000000000000000000000");

    await scxFlanPair.mint(owner.address);

    await this.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      this.uniswapHelper.address,
      realPower.address,
      6756,
      1000,
      // 20,
      // 105,
      111
    );

    await this.uniswapHelper.configure(
      this.limbo.address,
      pairAddress,
      realBehodler.address,
      this.flan.address,
      200,
      105,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);
    await this.limbo.configureSoul(
      proxy.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await proxy.approve(this.limbo.address, "100000000000000000000001");
    await this.limbo.stake(proxy.address, "100000000000000000000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(proxy.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await this.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = 105;

    await advanceBlocks(minQuoteWaitDuration + 1);

    await this.uniswapHelper.generateFLNQuote();

    const scxBalanceOfPairBefore = await realBehodler.balanceOf(pairAddress);

    const blackHoleAddress = await this.uniswapHelper.blackHole();

    const blackHoleBalanceBefore = await scxFlanPair.balanceOf(blackHoleAddress);

    const flanPairBalanceBefore = await this.flan.balanceOf(pairAddress);

    expect(scxBalanceOfPairBefore).to.equal("609176545126652594565");
    expect(flanPairBalanceBefore).to.equal("300000000000000000000000");

    await this.limbo.migrate(proxy.address);

    const balanceOfProxyOnBehodler = (await proxy.balanceOf(realBehodler.address)).toString();
    expect(balanceOfProxyOnBehodler).to.not.equal("0");

    const aaveBalanceOnBehodler = await this.aave.balanceOf(realBehodler.address);
    expect(aaveBalanceOnBehodler).to.equal("0");
  });
  
});
