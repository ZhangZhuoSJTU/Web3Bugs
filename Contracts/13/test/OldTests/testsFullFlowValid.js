const { assert } = require("hardhat");
const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { initial } = require("underscore");
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

// main contracts
var RCFactory = artifacts.require("./RCFactory.sol");
var RCTreasury = artifacts.require("./RCTreasury.sol");
var RCMarket = artifacts.require("./RCMarket.sol");
var NftHubL2 = artifacts.require("./nfthubs/RCNftHubL2.sol");
var NftHubL1 = artifacts.require("./nfthubs/RCNftHubL1.sol");
var RCOrderbook = artifacts.require("./RCOrderbook.sol");
// mockups
var RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");
var SelfDestructMockup = artifacts.require("./mockups/SelfDestructMockup.sol");
var DaiMockup = artifacts.require("./mockups/DaiMockup.sol");
const tokenMockup = artifacts.require("./mockups/tokenMockup.sol");

// arbitrator
var kleros = "0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D";

const delay = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration));

contract("TestFullFlowValid", (accounts) => {
  var realitycards;
  var tokenURIs = [
    "x",
    "x",
    "x",
    "uri",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
    "x",
  ]; // 20 tokens
  var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
  var maxuint256 = 4294967295;

  user0 = accounts[0]; //0xc783df8a850f42e7F7e57013759C285caa701eB6
  user1 = accounts[1]; //0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4
  user2 = accounts[2]; //0xE5904695748fe4A84b40b3fc79De2277660BD1D3
  user3 = accounts[3]; //0x92561F28Ec438Ee9831D00D1D59fbDC981b762b2
  user4 = accounts[4];
  user5 = accounts[5];
  user6 = accounts[6];
  user7 = accounts[7];
  user8 = accounts[8];
  user9 = accounts[9];
  andrewsAddress = accounts[9];
  // throws a tantrum if cardRecipients is not outside beforeEach for some reason
  var zeroAddress = "0x0000000000000000000000000000000000000000";
  var cardRecipients = ["0x0000000000000000000000000000000000000000"];

  beforeEach(async () => {
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = "0x0000000000000000000000000000000000000000";
    var affiliateAddress = "0x0000000000000000000000000000000000000000";
    erc20 = await tokenMockup.new("Dai", "Dai", ether("10000000"), user0);
    for (let index = 0; index < 10; index++) {
      user = eval("user" + index);
      erc20.transfer(user, ether("1000"), { from: user0 });
    }
    // mockups 
    realitio = await RealitioMockup.new();
    dai = await DaiMockup.new();
    // main contracts
    treasury = await RCTreasury.new(erc20.address);
    rcfactory = await RCFactory.new(treasury.address, realitio.address, kleros);
    rcreference = await RCMarket.new();
    rcorderbook = await RCOrderbook.new(rcfactory.address, treasury.address);
    // nft hubs
    nftHubL2 = await NftHubL2.new(rcfactory.address, ZERO_ADDRESS);
    nftHubL1 = await NftHubL1.new();
    // tell treasury about factory, tell factory about nft hub and reference
    await treasury.setFactoryAddress(rcfactory.address);
    await rcfactory.setReferenceContractAddress(rcreference.address);
    await rcfactory.setNftHubAddress(nftHubL2.address, 0);
    await treasury.setNftHubAddress(nftHubL2.address);
    await rcfactory.setOrderbookAddress(rcorderbook.address);
    await treasury.setOrderbookAddress(rcorderbook.address);
    await treasury.toggleWhitelist();
    // market creation
    await rcfactory.createMarket(
      0,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      0,
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards = await RCMarket.at(marketAddress);
  });

  async function createMarketWithArtistSet() {
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    await rcfactory.changeArtistApproval(user8);
    var affiliateAddress = user7;
    await rcfactory.changeAffiliateApproval(user7);
    var slug = "y";
    await rcfactory.createMarket(
      0,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      0,
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketCustomMode(mode) {
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = "0x0000000000000000000000000000000000000000";
    var affiliateAddress = "0x0000000000000000000000000000000000000000";
    var slug = "y";
    await rcfactory.createMarket(
      mode,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      0,
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(mode);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketWithCardAffiliates() {
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var cardRecipients = [
      user5,
      user6,
      user7,
      user8,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
    ];
    await rcfactory.changeCardAffiliateApproval(user5);
    await rcfactory.changeCardAffiliateApproval(user6);
    await rcfactory.changeCardAffiliateApproval(user7);
    await rcfactory.changeCardAffiliateApproval(user8);
    await rcfactory.changeCardAffiliateApproval(user0);
    var artistAddress = "0x0000000000000000000000000000000000000000";
    var affiliateAddress = "0x0000000000000000000000000000000000000000";
    var slug = "y";
    await rcfactory.createMarket(
      0,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      0,
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketCustomModeWithArtist(mode) {
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    var affiliateAddress = user7;
    await rcfactory.changeAffiliateApproval(user7);
    await rcfactory.changeArtistApproval(user8);
    var slug = "y";
    await rcfactory.createMarket(
      mode,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      0,
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(mode);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketWithArtistAndCardAffiliates() {
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    var affiliateAddress = user7;
    var cardRecipients = [
      user5,
      user6,
      user7,
      user8,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
    ];
    await rcfactory.changeCardAffiliateApproval(user5);
    await rcfactory.changeCardAffiliateApproval(user6);
    await rcfactory.changeCardAffiliateApproval(user7);
    await rcfactory.changeCardAffiliateApproval(user8);
    await rcfactory.changeCardAffiliateApproval(user0);
    await rcfactory.changeAffiliateApproval(user7);
    await rcfactory.changeArtistApproval(user8);
    var slug = "y";
    await rcfactory.createMarket(
      0,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      0,
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketWithArtistAndCardAffiliatesAndSponsorship(
    amount,
    user
  ) {
    amount = web3.utils.toWei(amount.toString(), "ether");
    var latestTime = await time.latest();
    var oneYear = new BN("31104000");
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    var affiliateAddress = user7;
    var slug = "y";
    var cardRecipients = [
      user5,
      user6,
      user7,
      user8,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
      user0,
    ];
    await rcfactory.changeCardAffiliateApproval(user5);
    await rcfactory.changeCardAffiliateApproval(user6);
    await rcfactory.changeCardAffiliateApproval(user7);
    await rcfactory.changeCardAffiliateApproval(user8);
    await rcfactory.changeCardAffiliateApproval(user0);
    await rcfactory.changeAffiliateApproval(user7);
    await rcfactory.changeArtistApproval(user8);
    await erc20.approve(treasury.address, ether('200'), { from: user })
    await rcfactory.createMarket(
      0,
      "0x0",
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      ether("200"),
      { from: user }
    );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function depositDai(amount, user) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    erc20.approve(treasury.address, amount, { from: user })
    // console.log("depositing ", amount, user);
    await treasury.deposit(amount, user, { from: user });
  }

  async function newRental(price, outcome, user) {
    price = web3.utils.toWei(price.toString(), "ether");
    return await realitycards.newRental(price, 0, zeroAddress, outcome, {
      from: user,
    });
  }

  async function newRentalWithStartingPosition(price, outcome, position, user) {
    price = web3.utils.toWei(price.toString(), "ether");
    await realitycards.newRental(price, 0, position, outcome, { from: user });
  }

  async function newRentalWithDeposit(price, outcome, user, dai) {
    await depositDai(dai, user);
    price = web3.utils.toWei(price.toString(), "ether");
    await realitycards.newRental(price, 0, zeroAddress, outcome, {
      from: user
    });
  }

  async function newRentalCustomContract(contract, price, outcome, user) {
    price = web3.utils.toWei(price.toString(), "ether");
    await contract.newRental(
      price,
      maxuint256.toString(),
      zeroAddress,
      outcome,
      { from: user }
    );
  }

  async function newRentalWithDepositCustomContract(
    contract,
    price,
    outcome,
    user,
    dai
  ) {
    price = web3.utils.toWei(price.toString(), "ether");
    await depositDai(dai, user)
    await contract.newRental(
      price,
      maxuint256.toString(),
      zeroAddress,
      outcome,
      { from: user }
    );
  }

  async function newRentalCustomTimeLimit(price, timelimit, outcome, user) {
    price = web3.utils.toWei(price.toString(), "ether");
    return await realitycards.newRental(
      price,
      (timelimit * 3600 * 24).toString(),
      zeroAddress,
      outcome,
      { from: user }
    );
  }

  async function userRemainingDeposit(outcome, userx) {
    await realitycards.userRemainingDeposit.call(outcome, { from: userx });
  }

  async function withdraw(userx) {
    await realitycards.withdraw({ from: userx });
  }

  async function withdrawDeposit(amount, userx) {
    amount = web3.utils.toWei(amount.toString(), "ether");
    await treasury.withdrawDeposit(amount, true, { from: userx });
  }

  it("test winner/withdraw mode 0- zero artist/creator cut", async () => {
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRental(1, 0, user0); // collected 28
    await newRental(2, 1, user1); // collected 52
    // rent winning team
    await newRental(1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await newRental(1, 2, user0); // auto locks
    // // set winner 1
    await realitio.setResult(2);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    ////////////////////////
    var totalRentCollected = await realitycards.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await withdraw(user0);
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await withdraw(user1);
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await withdraw(user2);
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("14")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards.withdraw({ from: user6 }), "Not a winner");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test winner/withdraw mode 0- with artist/creator cut", async () => {
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(60, 0, 40, 0, 100);
    var realitycards2 = await createMarketWithArtistSet();
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDepositCustomContract(realitycards2, 1, 0, user0, 144); // collected 28
    await newRentalWithDepositCustomContract(realitycards2, 2, 1, user1, 144); // collected 52
    // rent winning
    await newRentalWithDepositCustomContract(realitycards2, 1, 2, user0, 144); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 2, 2, user1, 144); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 3, 2, user2, 144); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await realitycards2.payMarketCreator();
    // artist and market creator cant withdraw twice
    await expectRevert(
      realitycards2.payMarketCreator(),
      "Creator already paid"
    );
    await expectRevert(realitycards2.payArtist(), "Artist already paid");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei("8.82", "ether");
    var difference = Math.abs(
      depositArtist.toString() - depositArtistShouldBe.toString()
    );
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that creator fees are correct shold be 147 * .04 = 8.82
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    var depositCreatorShouldBe = web3.utils.toWei("5.88", "ether");
    var difference = Math.abs(
      depositCreator.toString() - depositCreatorShouldBe.toString()
    );
    assert.isBelow(difference / depositCreator, 0.00001);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // rremaining pot is 132.3 which is 10% less as this is what is given to artists and creators
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("132.3").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(
      realitycards2.withdraw({ from: user0 }),
      "Already withdrawn"
    );
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("132.3").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("132.3").mul(new BN("14")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Not a winner");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user8);
  });

  it("test winner/withdraw mode 0- with artist/winner/creator cut", async () => {
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(60, 100, 40, 0, 100);
    var realitycards2 = await createMarketWithArtistSet();
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDepositCustomContract(realitycards2, 1, 0, user0, 144); // collected 28
    await newRentalWithDepositCustomContract(realitycards2, 2, 1, user1, 144); // collected 52
    // rent winning
    await newRentalWithDepositCustomContract(realitycards2, 1, 2, user0, 144); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 2, 2, user1, 144); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 3, 2, user2, 144); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await realitycards2.payMarketCreator();
    // artist and market creator cant withdraw twice
    await expectRevert(
      realitycards2.payMarketCreator(),
      "Creator already paid"
    );
    await expectRevert(realitycards2.payArtist(), "Artist already paid");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei("8.82", "ether");
    var difference = Math.abs(
      depositArtist.toString() - depositArtistShouldBe.toString()
    );
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that creator fees are correct shold be 147 * .04 = 8.82
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    var depositCreatorShouldBe = web3.utils.toWei("5.88", "ether");
    var difference = Math.abs(
      depositCreator.toString() - depositCreatorShouldBe.toString()
    );
    assert.isBelow(difference / depositCreator, 0.00001);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // 147 total, less 8.82 for artist, less 5.88 for creator, less 14.7 for winner = 117.6
    // remaining pot = 80% of total collected
    var remainingPot = ether("147").mul(new BN("8")).div(new BN("10"));
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(
      realitycards2.withdraw({ from: user0 }),
      "Already withdrawn"
    );
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("7")).div(new BN("28"));
    remainingPot;
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("14")).div(new BN("28"));
    winningsShouldBe = winningsShouldBe.add(ether("14.7"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Not a winner");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user8);
  });

  it("test winner/withdraw mode 0- with artist/affiliate/winner/creator cut", async () => {
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(60, 100, 40, 100, 100);
    var realitycards2 = await createMarketWithArtistSet();
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDepositCustomContract(realitycards2, 1, 0, user0, 144); // collected 28
    await newRentalWithDepositCustomContract(realitycards2, 2, 1, user1, 144); // collected 52
    // rent winning
    await newRentalWithDepositCustomContract(realitycards2, 1, 2, user0, 144); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 2, 2, user1, 144); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 3, 2, user2, 144); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await realitycards2.payAffiliate();
    await realitycards2.payMarketCreator();
    // artist and market creator cant withdraw twice
    await expectRevert(
      realitycards2.payMarketCreator(),
      "Creator already paid"
    );
    await expectRevert(realitycards2.payArtist(), "Artist already paid");
    await expectRevert(realitycards2.payAffiliate(), "Affiliate already paid");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei("8.82", "ether");
    var difference = Math.abs(
      depositArtist.toString() - depositArtistShouldBe.toString()
    );
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that affiliate fees are correct shold be 147 * .6 = 14.7
    var depositAffiliate = await treasury.userDeposit.call(user7);
    var depositAffiliateShouldBe = web3.utils.toWei("14.7", "ether");
    var difference = Math.abs(
      depositAffiliate.toString() - depositAffiliateShouldBe.toString()
    );
    assert.isBelow(difference / depositAffiliate, 0.00001);
    // check that creator fees are correct shold be 147 * .04 = 8.82
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    var depositCreatorShouldBe = web3.utils.toWei("5.88", "ether");
    var difference = Math.abs(
      depositCreator.toString() - depositCreatorShouldBe.toString()
    );
    assert.isBelow(difference / depositCreator, 0.00001);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // 147 total, less 8.82 for artist, less 5.88 for creator, less 14.7 for winner = 117.6
    // remaining pot = 70% of total collected
    var remainingPot = ether("147").mul(new BN("7")).div(new BN("10"));
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(
      realitycards2.withdraw({ from: user0 }),
      "Already withdrawn"
    );
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("7")).div(new BN("28"));
    remainingPot;
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("14")).div(new BN("28"));
    winningsShouldBe = winningsShouldBe.add(ether("14.7"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Not a winner");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user7);
    await withdrawDeposit(1000, user8);
  });

  it("test winner/withdraw mode 1- zero artist/creator cut", async () => {
    var realitycards2 = await createMarketCustomMode(1);
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRentalCustomContract(realitycards2, 1, 0, user0); // collected 28
    await newRentalCustomContract(realitycards2, 2, 1, user1); // collected 52
    // rent winning team
    await newRentalCustomContract(realitycards2, 1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // check user0 and 1 winnings should fail cos user 2 winner
    await expectRevert(realitycards2.withdraw({ from: user0 }), "Not a winner");
    await expectRevert(realitycards2.withdraw({ from: user1 }), "Not a winner");
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var difference = Math.abs(
      winningsSentToUser.toString() - totalRentCollected.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test winner/withdraw mode 1- with artist/creator cut", async () => {
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(60, 43, 40, 0, 100);
    var realitycards2 = await createMarketCustomModeWithArtist(1);
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRentalCustomContract(realitycards2, 1, 0, user0); // collected 28
    await newRentalCustomContract(realitycards2, 2, 1, user1); // collected 52
    // rent winning team
    await newRentalCustomContract(realitycards2, 1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await realitycards2.payMarketCreator();
    // artist and market creator cant withdraw twice
    await expectRevert(
      realitycards2.payMarketCreator(),
      "Creator already paid"
    );
    await expectRevert(realitycards2.payArtist(), "Artist already paid");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei("8.82", "ether");
    var difference = Math.abs(
      depositArtist.toString() - depositArtistShouldBe.toString()
    );
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that creator fees are correct shold be 147 * .04 = 8.82
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    var depositCreatorShouldBe = web3.utils.toWei("5.88", "ether");
    var difference = Math.abs(
      depositCreator.toString() - depositCreatorShouldBe.toString()
    );
    assert.isBelow(difference / depositCreator, 0.00001);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // check user0 and 1 winnings should fail cos user 2 winner
    await expectRevert(realitycards2.withdraw({ from: user0 }), "Not a winner");
    await expectRevert(realitycards2.withdraw({ from: user1 }), "Not a winner");
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    totalRentCollected = totalRentCollected.mul(new BN("9")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - totalRentCollected.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test winner/withdraw mode 3- zero artist/creator cut", async () => {
    var realitycards2 = await createMarketCustomMode(2);
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRentalCustomContract(realitycards2, 1, 0, user0); // collected 28
    await newRentalCustomContract(realitycards2, 2, 1, user1); // collected 56
    // rent winning team
    await newRentalCustomContract(realitycards2, 1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("7").add(ether("84").mul(new BN("7")).div(new BN("28")));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(
      realitycards2.withdraw({ from: user0 }),
      "Already withdrawn"
    );
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("14").add(ether("84").mul(new BN("7")).div(new BN("28")));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("42").add(ether("84").mul(new BN("14")).div(new BN("28")));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Not a winner");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test winner/withdraw mode 0- with card affiliate but zero artist/creator cut", async () => {
    var realitycards2 = await createMarketWithCardAffiliates();
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRentalCustomContract(realitycards2, 1, 0, user0); // collected 28
    await newRentalCustomContract(realitycards2, 2, 1, user1); // collected 56
    // rent winning team
    await newRentalCustomContract(realitycards2, 1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2, 3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    // 10% to card specific so * 0.9
    winningsShouldBe = winningsShouldBe.mul(new BN("9")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    // 10% to card specific so * 0.9
    winningsShouldBe = winningsShouldBe.mul(new BN("9")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("14")).div(new BN("28"));
    // 10% to card specific so * 0.9
    winningsShouldBe = winningsShouldBe.mul(new BN("9")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // now check that card specifics got the correct payout
    // token 0, collected = 28
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether("28").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1, collected = 56
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether("56").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 2, collected = 63
    var deposit = await treasury.userDeposit.call(user7);
    var depositShouldBe = ether("63").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // check cant call payCardAffiliate() twice
    for (i = 0; i < 20; i++) {
      await expectRevert(
        realitycards2.payCardAffiliate(i),
        "Card affiliate already paid"
      );
    }
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user5);
    await withdrawDeposit(1000, user6);
    await withdrawDeposit(1000, user7);
  });

  it("test winner/withdraw mode 0 with artist/creator/card affiliate cut", async () => {
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(60, 0, 40, 0, 100);
    var realitycards2 = await createMarketWithArtistAndCardAffiliates();
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDepositCustomContract(realitycards2, 1, 0, user0, 144); // collected 28
    await newRentalWithDepositCustomContract(realitycards2, 2, 1, user1, 144); // collected 52
    // rent winning
    await newRentalWithDepositCustomContract(realitycards2, 1, 2, user0, 144); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 2, 2, user1, 144); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 3, 2, user2, 144); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await realitycards2.payMarketCreator();
    // artist and market creator cant withdraw twice
    await expectRevert(
      realitycards2.payMarketCreator(),
      "Creator already paid"
    );
    await expectRevert(realitycards2.payArtist(), "Artist already paid");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei("8.82", "ether");
    var difference = Math.abs(
      depositArtist.toString() - depositArtistShouldBe.toString()
    );
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that creator fees are correct shold be 147 * .04 = 8.82
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    var depositCreatorShouldBe = web3.utils.toWei("5.88", "ether");
    var difference = Math.abs(
      depositCreator.toString() - depositCreatorShouldBe.toString()
    );
    assert.isBelow(difference / depositCreator, 0.00001);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    winningsShouldBe = winningsShouldBe.mul(new BN("8")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(
      realitycards2.withdraw({ from: user0 }),
      "Already withdrawn"
    );
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    winningsShouldBe = winningsShouldBe.mul(new BN("8")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("14")).div(new BN("28"));
    winningsShouldBe = winningsShouldBe.mul(new BN("8")).div(new BN("10"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Not a winner");
    // now check that card specifics got the correct payout
    // token 0, collected = 28
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether("28").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1, collected = 56
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether("56").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 2, collected = 63
    var deposit = await treasury.userDeposit.call(user7);
    var depositShouldBe = ether("63").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // check cant call payCardAffiliate() twice
    for (i = 0; i < 20; i++) {
      await expectRevert(
        realitycards2.payCardAffiliate(i),
        "Card affiliate already paid"
      );
    }
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user5);
    await withdrawDeposit(1000, user6);
    await withdrawDeposit(1000, user7);
  });

  it("test winner/withdraw mode 0- with artist/winner/creator/card affiliate cut", async () => {
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(60, 100, 40, 0, 100);
    var realitycards2 = await createMarketWithArtistAndCardAffiliates();
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDepositCustomContract(realitycards2, 1, 0, user0, 144); // collected 28
    await newRentalWithDepositCustomContract(realitycards2, 2, 1, user1, 144); // collected 52
    // rent winning
    await newRentalWithDepositCustomContract(realitycards2, 1, 2, user0, 144); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 2, 2, user1, 144); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDepositCustomContract(realitycards2, 3, 2, user2, 144); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await realitycards2.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await realitycards2.payMarketCreator();
    // artist and market creator cant withdraw twice
    await expectRevert(
      realitycards2.payMarketCreator(),
      "Creator already paid"
    );
    await expectRevert(realitycards2.payArtist(), "Artist already paid");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei("8.82", "ether");
    var difference = Math.abs(
      depositArtist.toString() - depositArtistShouldBe.toString()
    );
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that creator fees are correct shold be 147 * .04 = 8.82
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    var depositCreatorShouldBe = web3.utils.toWei("5.88", "ether");
    var difference = Math.abs(
      depositCreator.toString() - depositCreatorShouldBe.toString()
    );
    assert.isBelow(difference / depositCreator, 0.00001);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // remaining pot = 80% of total collected
    var remainingPot = ether("147").mul(new BN("7")).div(new BN("10"));
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(
      realitycards2.withdraw({ from: user0 }),
      "Already withdrawn"
    );
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = remainingPot.mul(new BN("14")).div(new BN("28"));
    winningsShouldBe = winningsShouldBe.add(ether("14.7"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Not a winner");
    // now check that card specifics got the correct payout
    // token 0, collected = 28
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether("28").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1, collected = 56
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether("56").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 2, collected = 63
    var deposit = await treasury.userDeposit.call(user7);
    var depositShouldBe = ether("63").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user5);
    await withdrawDeposit(1000, user6);
    await withdrawDeposit(1000, user7);
  });

  it("test sponsor", async () => {
    await expectRevert(
      realitycards.sponsor(user3, 0, { from: user3 }),
      "Must send something"
    );
    await erc20.approve(treasury.address, ether('200'), { from: user3 })
    await realitycards.sponsor(user3, ether('152'), {
      from: user3
    });
    ///// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRental(1, 0, user0); // collected 28
    await newRental(2, 1, user1); // collected 52
    // rent winning team
    await newRental(1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147, // now 300
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket();
    // set winner
    await realitio.setResult(2);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("300", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.004);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await withdraw(user0);
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("300").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.004);
    //check user0 cant withdraw again
    await expectRevert(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await withdraw(user1);
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("300").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.004);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await withdraw(user2);
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("300").mul(new BN("14")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.004);
    // check random user can't withdraw
    await expectRevert(realitycards.withdraw({ from: user6 }), "Not a winner");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test sponsor with card affiliate cut", async () => {
    // 10% card specific affiliates
    await rcfactory.setPotDistribution(0, 0, 0, 0, 100);
    var realitycards2 = await createMarketWithArtistAndCardAffiliates();
    await erc20.approve(treasury.address, ether('200'), { from: user3 })
    await realitycards2.sponsor(user3, web3.utils.toWei("200", "ether"), {
      from: user3,
    });
    await newRentalWithDepositCustomContract(realitycards2, 5, 0, user0, 1000); // paid 50
    await newRentalWithDepositCustomContract(realitycards2, 15, 1, user1, 1000); // paid 150
    await time.increase(time.duration.days(10));
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await time.increase(time.duration.years(1));
    await realitycards2.lockMarket();
    await realitio.setResult(0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    // token 0
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether("60").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether("160").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // winnings of user 0 should be 400 - 20 so 380
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = web3.utils.toWei("360", "ether");
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // ensure everything is withdrawn
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it("test sponsor via market creation with card affiliate cut", async () => {
    // 10% card specific affiliates
    await rcfactory.setPotDistribution(0, 0, 0, 0, 100);
    // add user3 to whitelist
    await rcfactory.changeGovernorApproval(user3);
    var realitycards2 = await createMarketWithArtistAndCardAffiliatesAndSponsorship(
      200,
      user3
    );
    // await realitycards2.sponsor({ value: web3.utils.toWei('200', 'ether'), from: user3 });
    await newRentalWithDepositCustomContract(realitycards2, 5, 0, user0, 1000); // paid 50
    await newRentalWithDepositCustomContract(realitycards2, 15, 1, user1, 1000); // paid 150
    await time.increase(time.duration.days(10));
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await time.increase(time.duration.years(1));
    await realitycards2.lockMarket();
    await realitio.setResult(0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    // token 0
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether("60").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether("160").div(new BN("10"));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // winnings of user 0 should be 400 - 20 so 380
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = web3.utils.toWei("360", "ether");
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // ensure everything is withdrawn
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it("test circuitBreaker", async () => {
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    // rent losing teams
    await newRental(1, 0, user0); // collected 28
    await newRental(2, 1, user1); // collected 56
    // rent winning team
    await newRental(1, 2, user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2, 2, user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3, 2, user2); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket();
    await time.increase(time.duration.weeks(24));
    await realitycards.circuitBreaker();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await withdraw(user0);
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("35");
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await withdraw(user1);
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("70");
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await withdraw(user2);
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("42");
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards.withdraw({ from: user6 }), "Paid no rent");
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test circuitBreaker less than 3 months", async () => {
    /////// SETUP //////
    await depositDai(1000, user0);
    await newRental(1, 0, user0); // collected 28
    await time.increase(time.duration.weeks(3));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await time.increase(time.duration.years(1));
    await realitycards.lockMarket();
    await expectRevert(realitycards.circuitBreaker(), "Too early");
    await time.increase(time.duration.weeks(13));
    await realitycards.circuitBreaker();
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });

  it("test NFT allocation after event- circuit breaker", async () => {
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    await newRental(1, 0, user0);
    await newRental(1, 1, user1);
    await newRental(1, 2, user2);
    await time.increase(time.duration.weeks(1));
    await newRental(2, 0, user1); //user 1 winner
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    ////////////////////////
    await realitycards.lockMarket();
    await time.increase(time.duration.weeks(12));
    await realitycards.circuitBreaker();
    await realitycards.claimCard(0, { from: user1 });
    await realitycards.claimCard(1, { from: user1 });
    await expectRevert(
      realitycards.claimCard(2, { from: user1 }),
      "Not longest owner"
    );
    await realitycards.claimCard(2, { from: user2 });
    await expectRevert(
      realitycards.claimCard(2, { from: user2 }),
      "Already claimed"
    );
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, user1);
    var owner = await realitycards.ownerOf(1);
    assert.equal(owner, user1);
    var owner = await realitycards.ownerOf(2);
    assert.equal(owner, user2);
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test NFT allocation after event- winner", async () => {
    await rcfactory.changeMarketApproval(realitycards.address);
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await depositDai(1000, user2);
    await newRental(1, 0, user0);
    await newRental(1, 1, user1);
    await newRental(1, 2, user2);
    await time.increase(time.duration.weeks(1));
    await newRental(2, 0, user1); //user 1 winner
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    ////////////////////////
    await realitycards.lockMarket();
    // set winner
    await realitio.setResult(0);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    await realitycards.claimCard(0, { from: user1 });
    await realitycards.claimCard(1, { from: user1 });
    await realitycards.claimCard(2, { from: user2 });
    await expectRevert(
      realitycards.claimCard(2, { from: user2 }),
      "Already claimed"
    );
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, user1);
    var owner = await realitycards.ownerOf(1);
    assert.equal(owner, user1);
    var owner = await realitycards.ownerOf(2);
    assert.equal(owner, user2);
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  const getTimestamp = async (tx) => {
    return (await web3.eth.getBlock((await tx).receipt.blockNumber)).timestamp;
  };

  const rentCalculator = (rate, duration) => {
    return (rentOwed = new BN(rate)
      .mul(new BN(duration))
      .div(time.duration.days(1)));
    //return rentOwed;
  };
  const multiRentCalculator = (tokenArray) => {
    const totalPatronage = tokenArray.reduce((totalPatronage, token) => {
      const rentOwedForToken = rentCalculator(
        ether(token.price.toString()),
        token.timeHeld
      );
      return totalPatronage.add(rentOwedForToken);
    }, new BN("0"));
    return totalPatronage;
  };

  const SECONDS_IN_DAY = 86400;

  it("test winner/withdraw, recreated without exit", async () => {
    const initialDeposit = 1000;
    /////// SETUP //////
    await depositDai(initialDeposit, user0);
    await depositDai(initialDeposit, user1);
    await depositDai(initialDeposit, user2);
    const firstcardPrice = 1;
    const secondcardPrice = 2;
    const thirdcardPrice = 3;

    // rent losing teams
    const user0DepositBefore = await treasury.userDeposit.call(user0);
    assert.equal(
      ether(initialDeposit.toString()).toString(),
      user0DepositBefore.toString()
    );

    const user0FirstRentalTime = await getTimestamp(
      newRentalCustomTimeLimit(firstcardPrice, 28, 0, user0)
    ); // collected 28
    const userRecord = await treasury.user.call(user0)
    assert.equal(user0FirstRentalTime.toString(), userRecord[3].toString())
    assert.equal(user0FirstRentalTime.toString(), (await realitycards.timeLastCollected.call(0)).toString())
    const user1FirstRentalTime = await getTimestamp(
      newRentalCustomTimeLimit(secondcardPrice, 28, 1, user1)
    ); // collected 56
    const userRecord2 = await treasury.user.call(user1)
    assert.equal(user1FirstRentalTime.toString(), userRecord2[3].toString())
    assert.equal(user1FirstRentalTime.toString(), (await realitycards.timeLastCollected.call(1)).toString())
    // rent winning team
    const user0SecondRentalTime = await getTimestamp(
      newRental(firstcardPrice, 2, user0)
    ); // collected ~7
    const userRecord3 = await treasury.user.call(user0)
    assert.equal(user0SecondRentalTime.toString(), userRecord3[3].toString())
    assert.equal(user0SecondRentalTime.toString(), (await realitycards.timeLastCollected.call(2)).toString())
    await time.increase(time.duration.weeks(1).sub(new BN(1)));
    const user1SecondRentalTime = await getTimestamp(
      newRental(secondcardPrice, 2, user1)
    ); // collected ~14
    const userRecord4 = await treasury.user.call(user1)
    assert.equal(user1SecondRentalTime.toString(), userRecord4[3].toString())
    assert.equal(user1SecondRentalTime.toString(), (await realitycards.timeLastCollected.call(2)).toString())

    await time.increase(time.duration.weeks(1).sub(new BN(1)));
    const user2FirstRentalTime = await getTimestamp(
      newRentalCustomTimeLimit(thirdcardPrice, 14, 2, user2)
    ); // collected 42
    const userRecord5 = await treasury.user.call(user2)
    assert.equal(user2FirstRentalTime.toString(), userRecord5[3].toString())
    assert.equal(user2FirstRentalTime.toString(), (await realitycards.timeLastCollected.call(2)).toString())
    await time.increase(time.duration.weeks(2));
    await time.increase(time.duration.hours(1));

    const txTimestamp = await getTimestamp(realitycards.collectRentAllCards());

    // user0
    const userRecord6 = await treasury.user.call(user0)
    assert.equal(txTimestamp.toString(), userRecord6[3].toString())
    assert.equal(user1, await realitycards.ownerOf(2))
    assert.equal(txTimestamp.toString(), (await realitycards.timeLastCollected.call(2)).toString())

    // user1
    const userRecord7 = await treasury.user.call(user1)
    assert.equal(txTimestamp.toString(), userRecord7[3].toString())
    assert.equal(txTimestamp.toString(), (await realitycards.timeLastCollected.call(2)).toString())

    const currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
    const testCurTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    // user rent checks
    const rentOwedByUser0 = multiRentCalculator([
      {
        timeHeld: Math.min(
          currentTimestamp - user0FirstRentalTime,
          28 * SECONDS_IN_DAY
        ),
        price: firstcardPrice,
      },
      {
        timeHeld: user1SecondRentalTime - user0SecondRentalTime,
        price: firstcardPrice,
      },
    ]);
    const rentOwedByUser1 = multiRentCalculator([
      {
        timeHeld: Math.min(
          currentTimestamp - user1FirstRentalTime,
          28 * SECONDS_IN_DAY
        ),
        price: firstcardPrice,
      },
      {
        timeHeld: currentTimestamp - user1SecondRentalTime,
        price: secondcardPrice,
      },
    ]);
    const rentOwedByUser2 = multiRentCalculator([
      {
        timeHeld: Math.min(
          currentTimestamp - user2FirstRentalTime,
          14 * SECONDS_IN_DAY
        ),
        price: thirdcardPrice,
      },
    ]);
    const user0DepositAfter = await treasury.userDeposit.call(user0);
    const user1DepositAfter = await treasury.userDeposit.call(user1);
    const user2DepositAfter = await treasury.userDeposit.call(user2);
    assert.equal(
      ether(initialDeposit.toString()).sub(rentOwedByUser0).toString(),
      user0DepositAfter.toString()
    );
    assert.equal(
      ether(initialDeposit.toString()).sub(rentOwedByUser1).toString(),
      user1DepositAfter.toString()
    );
    assert.equal(
      ether(initialDeposit.toString()).sub(rentOwedByUser2).toString(),
      user2DepositAfter.toString()
    );

    // treasury balance check
    const treasuryBalance = await treasury.totalDeposits.call();
    const totalUserDepsoits =
      user0DepositAfter + user1DepositAfter + user2DepositAfter;
    assert.equal(
      treasuryBalance.toString(),
      user0DepositAfter.add(user1DepositAfter).add(user2DepositAfter).toString()
    );

    // market balance check - after collect rent all cards this should be zero
    assert.equal((await treasury.marketBalance.call()).toString(), "0");

    // card balance check
    const rentCollectedByToken2 = multiRentCalculator([
      {
        timeHeld: user1SecondRentalTime - user0SecondRentalTime,
        price: firstcardPrice,
      },
      {
        timeHeld: user2FirstRentalTime - user1SecondRentalTime,
        price: secondcardPrice,
      },
      {
        timeHeld: Math.min(
          currentTimestamp - user2FirstRentalTime,
          14 * SECONDS_IN_DAY
        ),
        price: thirdcardPrice,
      },
      {
        timeHeld: currentTimestamp - user2FirstRentalTime - 14 * SECONDS_IN_DAY,
        price: secondcardPrice,
      },
    ]);
    assert.equal(
      (await realitycards.rentCollectedPerCard(0)).toString(),
      28 * 10 ** 18
    );
    assert.equal(
      (await realitycards.rentCollectedPerCard(1)).toString(),
      56 * 10 ** 18
    );
    assert.equal(
      (await realitycards.rentCollectedPerCard(2)).toString(),
      rentCollectedByToken2.toString()
    );

    // --------------------------------

    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user0 });
    // exit all, progress time so marketLockingTime in the past
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    //////////////////////
    await realitycards.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    ////////////////////////
    var totalRentCollected = await realitycards.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.001);
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await withdraw(user0);
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.001);
    //check user0 cant withdraw again
    await expectRevert(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await withdraw(user1);
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.01);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await withdraw(user2);
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('14')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.001);
    // check random user can't withdraw
    await expectRevert(realitycards.withdraw({ from: user6 }), "Not a winner");
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it("test winner/withdraw recreated using newRentalWithDeposit", async () => {
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDeposit(1, 0, user0, 144); // collected 28
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('1', 'ether'),maxuint256,0,{from: user0, value: web3.utils.toWei('144', 'ether')}); // collected 28
    await newRentalWithDeposit(2, 1, user1, 144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('2', 'ether'),maxuint256,1,{from: user1, value: web3.utils.toWei('144', 'ether')}); // collected 52
    // rent winning
    await newRentalWithDeposit(1, 2, user0, 144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('1', 'ether'),maxuint256,2,{from: user0, value: web3.utils.toWei('144', 'ether')}); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDeposit(2, 2, user1, 144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('2', 'ether'),maxuint256,2,{from: user1, value: web3.utils.toWei('144', 'ether')}); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDeposit(3, 2, user2, 144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('3', 'ether'),maxuint256,2,{from: user2, value: web3.utils.toWei('144', 'ether')}); // collected 42
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await realitycards.exitAll({ from: user1 });
    await realitycards.exitAll({ from: user2 });
    await time.increase(time.duration.years(1));
    // winner 1:
    // totalRentCollected = 147,
    // total days = 28
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket();
    // // set winner 1
    await realitio.setResult(2);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    ////////////////////////
    var totalRentCollected = await realitycards.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei("147", "ether");
    var difference = Math.abs(
      totalRentCollected.toString() - totalRentCollectedShouldBe.toString()
    );
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await withdraw(user0);
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await withdraw(user1);
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("7")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await withdraw(user2);
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether("147").mul(new BN("14")).div(new BN("28"));
    var difference = Math.abs(
      winningsSentToUser.toString() - winningsShouldBe.toString()
    );
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards.withdraw({ from: user6 }), "Not a winner");
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });
});
