const { assert } = require('hardhat');
const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

// main contracts
var RCFactory = artifacts.require('./RCFactory.sol');
var RCTreasury = artifacts.require('./RCTreasury.sol');
var RCMarket = artifacts.require('./RCMarket.sol');
var NftHubL2 = artifacts.require('./nfthubs/RCNftHubL2.sol');
var NftHubL1 = artifacts.require('./nfthubs/RCNftHubL1.sol');
var RCOrderbook = artifacts.require('./RCOrderbook.sol');
// mockups
var RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");

var SelfDestructMockup = artifacts.require("./mockups/SelfDestructMockup.sol");
var DaiMockup = artifacts.require("./mockups/DaiMockup.sol");
const tokenMockup = artifacts.require("./mockups/tokenMockup.sol");

// arbitrator
var kleros = '0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D';

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

contract('TestFullFlowInvalid', (accounts) => {

  var realitycards;
  var tokenURIs = ['x', 'x', 'x', 'uri', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']; // 20 tokens
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
  var zeroAddress = '0x0000000000000000000000000000000000000000';
  var cardRecipients = ['0x0000000000000000000000000000000000000000'];

  beforeEach(async () => {
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
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
      '0x0',
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
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    await rcfactory.changeArtistApproval(user8);
    var affiliateAddress = user7;
    await rcfactory.changeAffiliateApproval(user7);
    var slug = 'y';
    await rcfactory.createMarket(
      0,
      '0x0',
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
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var slug = 'y';
    await rcfactory.createMarket(
      mode,
      '0x0',
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
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var cardRecipients = [user5, user6, user7, user8, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0];
    await rcfactory.changeCardAffiliateApproval(user5);
    await rcfactory.changeCardAffiliateApproval(user6);
    await rcfactory.changeCardAffiliateApproval(user7);
    await rcfactory.changeCardAffiliateApproval(user8);
    await rcfactory.changeCardAffiliateApproval(user0);
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var slug = 'y';
    await rcfactory.createMarket(
      0,
      '0x0',
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
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    var affiliateAddress = user7;
    await rcfactory.changeAffiliateApproval(user7);
    await rcfactory.changeArtistApproval(user8);
    var slug = 'y';
    await rcfactory.createMarket(
      mode,
      '0x0',
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
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    var affiliateAddress = user7;
    var cardRecipients = [user5, user6, user7, user8, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0];
    await rcfactory.changeCardAffiliateApproval(user5);
    await rcfactory.changeCardAffiliateApproval(user6);
    await rcfactory.changeCardAffiliateApproval(user7);
    await rcfactory.changeCardAffiliateApproval(user8);
    await rcfactory.changeCardAffiliateApproval(user0);
    await rcfactory.changeAffiliateApproval(user7);
    await rcfactory.changeArtistApproval(user8);
    var slug = 'y';
    await rcfactory.createMarket(
      0,
      '0x0',
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

  async function depositDai(amount, user) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await erc20.approve(treasury.address, amount, { from: user })
    await treasury.deposit(amount, user, { from: user });
  }
  async function newRental(price, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price, 0, zeroAddress, outcome, { from: user });
  }

  async function newRentalWithStartingPosition(price, outcome, position, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price, 0, position, outcome, { from: user });
  }

  async function newRentalWithDeposit(price, outcome, user, dai) {
    price = web3.utils.toWei(price.toString(), 'ether');
    dai = web3.utils.toWei(dai.toString(), 'ether');
    await realitycards.newRental(price, 0, zeroAddress, outcome, { from: user, value: dai });
  }

  async function newRentalCustomContract(contract, price, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await contract.newRental(price, maxuint256.toString(), zeroAddress, outcome, { from: user });
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
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price, (timelimit * 3600 * 24).toString(), zeroAddress, outcome, { from: user });
  }

  async function userRemainingDeposit(outcome, userx) {
    await realitycards.userRemainingDeposit.call(outcome, { from: userx });
  }

  async function withdraw(userx) {
    await realitycards.withdraw({ from: userx });
  }

  async function withdrawDeposit(amount, userx) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await treasury.withdrawDeposit(amount, true, { from: userx });
  }

  it('test sponsor- invalid', async () => {
    await expectRevert(realitycards.sponsor(user3, 0, { from: user3 }), "Must send something");
    await erc20.approve(treasury.address, web3.utils.toWei('153', 'ether'), { from: user3 });
    await realitycards.sponsor(user3, web3.utils.toWei('153', 'ether'), { from: user3 });
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
    await realitio.setResult(20);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    ////////////////////////
    //check sponsor winnings
    var depositBefore = await treasury.userDeposit.call(user3);
    await withdraw(user3);
    var depositAfter = await treasury.userDeposit.call(user3);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('153');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // withdraw other stuff
    await withdraw(user0);
    await withdraw(user1);
    await withdraw(user2);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user3);
  });


  it('test sponsor- invalid with card affiliate cut', async () => {
    // 10% card specific affiliates
    await rcfactory.setPotDistribution(0, 0, 0, 0, 100);
    var realitycards2 = await createMarketWithArtistAndCardAffiliates();
    await erc20.approve(treasury.address, web3.utils.toWei('200', 'ether'), { from: user3 });
    await realitycards2.sponsor(user3, web3.utils.toWei('200', 'ether'), { from: user3 });
    await newRentalWithDepositCustomContract(realitycards2, 5, 0, user0, 1000); // paid 50
    await newRentalWithDepositCustomContract(realitycards2, 15, 1, user1, 1000);  // paid 150
    await time.increase(time.duration.days(10));
    await realitycards2.exitAll({ from: user0 });
    await realitycards2.exitAll({ from: user1 });
    await time.increase(time.duration.years(1));
    await realitycards2.lockMarket();
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    // token 0
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether('60').div(new BN('10'));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether('160').div(new BN('10'));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // user 0
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = web3.utils.toWei('45', 'ether');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // user 1
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = web3.utils.toWei('135', 'ether');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // user 3 (sponsor)
    var depositBefore = await treasury.userDeposit.call(user3);
    await realitycards2.withdraw({ from: user3 });
    var depositAfter = await treasury.userDeposit.call(user3);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = web3.utils.toWei('180', 'ether');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it('test withdraw- invalid mode 0- zero artist/creator cut', async () => {
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await withdraw(user0);
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await withdraw(user1);
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await withdraw(user2);
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
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

  it('test withdraw- invalid mode 0- with artist/creator cut', async () => {
    /////// SETUP //////
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(50, 62, 20, 0, 100);
    var realitycards2 = await createMarketWithArtistSet();
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    winningsShouldBe = (winningsShouldBe.mul(new BN('19'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    winningsShouldBe = (winningsShouldBe.mul(new BN('19'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    winningsShouldBe = (winningsShouldBe.mul(new BN('19'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    await realitycards2.payArtist();
    // check that artist fees are correct shold be 147 * .05 = 8.82 
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei('7.35', 'ether');
    var difference = Math.abs(depositArtist.toString() - depositArtistShouldBe.toString());
    assert.isBelow(difference / depositArtist, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it('test withdraw- invalid mode 0- with artist/affiliate/creator cut', async () => {
    /////// SETUP //////
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(50, 62, 20, 100, 100);
    var realitycards2 = await createMarketWithArtistSet();
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    winningsShouldBe = (winningsShouldBe.mul(new BN('17'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    winningsShouldBe = (winningsShouldBe.mul(new BN('17'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    winningsShouldBe = (winningsShouldBe.mul(new BN('17'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    await realitycards2.payArtist();
    await realitycards2.payAffiliate();
    // check that artist fees are correct shold be 147 * .05 = 8.82 
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei('7.35', 'ether');
    var difference = Math.abs(depositArtist.toString() - depositArtistShouldBe.toString());
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that affiliate fees are correct shold be 147 * .05 = 8.82 
    var depositAffiliate = await treasury.userDeposit.call(user7);
    var depositAffiliateShouldBe = web3.utils.toWei('14.7', 'ether');
    var difference = Math.abs(depositAffiliate.toString() - depositAffiliateShouldBe.toString());
    assert.isBelow(difference / depositAffiliate, 0.00001);
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

  it('test withdraw- invalid mode 1- zero artist/creator cut', async () => {
    var realitycards2 = await createMarketCustomMode(1);
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    // total deposits = 147, check:
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it('test withdraw- invalid mode 1- with artist/creator cut', async () => {
    /////// SETUP //////
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(50, 13, 20, 0, 100);
    var realitycards2 = await createMarketCustomModeWithArtist(1);
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    winningsShouldBe = (winningsShouldBe.mul(new BN('19'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    winningsShouldBe = (winningsShouldBe.mul(new BN('19'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    winningsShouldBe = (winningsShouldBe.mul(new BN('19'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    await realitycards2.payArtist();
    // check that artist fees are correct shold be 147 * .05 = 8.82 
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei('7.35', 'ether');
    var difference = Math.abs(depositArtist.toString() - depositArtistShouldBe.toString());
    assert.isBelow(difference / depositArtist, 0.00001);
    // check market pot is empty
    var marketPot = await treasury.marketPot.call(realitycards2.address);
    assert.isBelow(Math.abs(marketPot.toString()), 10);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it('test withdraw- invalid mode 0- zero artist/creator cut', async () => {
    // with stands 10% payout to dudes
    var realitycards2 = await createMarketWithCardAffiliates(0);
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    // total deposits = 147, check:
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    // 10% to card specific so * 0.9
    winningsShouldBe = (winningsShouldBe.mul(new BN('9'))).div(new BN('10'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    // 10% to card specific so * 0.9
    winningsShouldBe = (winningsShouldBe.mul(new BN('9'))).div(new BN('10'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    // 10% to card specific so * 0.9
    winningsShouldBe = (winningsShouldBe.mul(new BN('9'))).div(new BN('10'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // now check that card specifics got the correct payout
    // token 0, collected = 28
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether('28').div(new BN('10'));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1, collected = 56
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether('56').div(new BN('10'));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 2, collected = 63
    var collected = await realitycards2.rentCollectedPerCard.call(1);
    var deposit = await treasury.userDeposit.call(user7);
    var depositShouldBe = ether('63').div(new BN('10'));
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

  it('test withdraw- invalid mode 0- with artist/creator/card affiliate cut', async () => {
    /////// SETUP //////
    // 6% artist 4% creator
    await rcfactory.setPotDistribution(50, 13, 20, 0, 100);
    var realitycards2 = await createMarketWithArtistAndCardAffiliates(0);
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
    // set invalid winner
    await realitio.setResult(69);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    winningsShouldBe = (winningsShouldBe.mul(new BN('17'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user1 winnings
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    winningsShouldBe = (winningsShouldBe.mul(new BN('17'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user2 winnings
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    winningsShouldBe = (winningsShouldBe.mul(new BN('17'))).div(new BN('20'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    await realitycards2.payArtist();
    // check that artist fees are correct shold be 147 * .05 = 8.82 
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei('7.35', 'ether');
    var difference = Math.abs(depositArtist.toString() - depositArtistShouldBe.toString());
    assert.isBelow(difference / depositArtist, 0.00001);
    // now check that card specifics got the correct payout
    // token 0, collected = 28
    for (i = 0; i < 20; i++) {
      await realitycards2.payCardAffiliate(i);
    }
    var deposit = await treasury.userDeposit.call(user5);
    var depositShouldBe = ether('28').div(new BN('10'));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 1, collected = 56
    var deposit = await treasury.userDeposit.call(user6);
    var depositShouldBe = ether('56').div(new BN('10'));
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / deposit, 0.00001);
    // token 2, collected = 63
    var deposit = await treasury.userDeposit.call(user7);
    var depositShouldBe = ether('63').div(new BN('10'));
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


  it('test winner/withdraw with invalid market and artist and creator fees', async () => {
    // 6% artist 4% creator but invalid so 0% creator
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
    await realitio.setResult(69);
    var depositCreatorBefore = await treasury.userDeposit.call(user0);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    await realitycards2.payArtist();
    await expectRevert(realitycards2.payMarketCreator(), "No winner");
    var depositCreatorAfter = await treasury.userDeposit.call(user0);
    // check that artist fees are correct shold be 147 * .06 = 8.82 
    var depositArtist = await treasury.userDeposit.call(user8);
    var depositArtistShouldBe = web3.utils.toWei('8.82', 'ether');
    var difference = Math.abs(depositArtist.toString() - depositArtistShouldBe.toString());
    assert.isBelow(difference / depositArtist, 0.00001);
    // check that creator fees are zero
    var depositCreator = depositCreatorAfter - depositCreatorBefore;
    assert.equal(depositCreator, 0);
    ////////////////////////
    var totalRentCollected = await realitycards2.totalRentCollected.call();
    var totalRentCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
    // eremaining pot is 132.3 which is 10% less as this is what is given to artists and creators
    // //check user0 winnings
    var depositBefore = await treasury.userDeposit.call(user0);
    await realitycards2.withdraw({ from: user0 });
    var depositAfter = await treasury.userDeposit.call(user0);
    var winningsSentToUser = depositAfter - depositBefore;
    // usually 35 so should be 35 * .94 = 32.9
    var winningsShouldBe = ether('32.9');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    //check user0 cant withdraw again
    await expectRevert(realitycards2.withdraw({ from: user0 }), "Already withdrawn");
    // usually 70 so should be 70 * .94 = 65.8
    var depositBefore = await treasury.userDeposit.call(user1);
    await realitycards2.withdraw({ from: user1 });
    var depositAfter = await treasury.userDeposit.call(user1);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('65.8');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // usually 42 so should be 70 * .94 = 39.48
    var depositBefore = await treasury.userDeposit.call(user2);
    await realitycards2.withdraw({ from: user2 });
    var depositAfter = await treasury.userDeposit.call(user2);
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('39.48');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference / winningsSentToUser, 0.00001);
    // check random user can't withdraw
    await expectRevert(realitycards2.withdraw({ from: user6 }), "Paid no rent");
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
    await withdrawDeposit(1000, user8);
  });

});

