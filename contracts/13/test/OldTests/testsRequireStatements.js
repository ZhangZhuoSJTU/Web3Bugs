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

contract('TestRequireStatements', (accounts) => {

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

  async function createMarketCustomeTimestamps(marketOpeningTime, marketLockingTime, oracleResolutionTime) {
    var artistAddress = user8;
    await rcfactory.changeArtistApproval(user8);
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var timestamps = [marketOpeningTime, marketLockingTime, oracleResolutionTime];
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

  async function createMarketCustomeTimestamps2(marketOpeningTime, marketLockingTime, oracleResolutionTime) {
    var artistAddress = user8;
    // await rcfactory.changeArtistApproval(user8);
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var timestamps = [marketOpeningTime, marketLockingTime, oracleResolutionTime];
    var slug = 'z';
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

  async function newRentalWithDepositCustomContract(contract, price, outcome, user, dai) {
    price = web3.utils.toWei(price.toString(), 'ether');
    dai = web3.utils.toWei(dai.toString(), 'ether');
    await contract.newRental(price, maxuint256.toString(), zeroAddress, outcome, { from: user, value: dai });
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


  it('check expected failures with market resolution: question not resolved but market ended', async () => {
    await depositDai(1000, user0);
    await newRental(1, 0, user0);
    await time.increase(time.duration.hours(1));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({ from: user0 });
    await time.increase(time.duration.years(1));
    await realitycards.lockMarket();
    await expectRevert(realitycards.withdraw(), "Incorrect state");
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });

  it('newRental check failures', async () => {
    /////// SETUP //////
    user = user0;
    await depositDai(1000, user0);
    // check newRental stuff
    await expectRevert(realitycards.newRental(web3.utils.toWei('0.5', 'ether'), maxuint256, zeroAddress, 0, { from: user }), "Price below min");
    await expectRevert(realitycards.newRental(web3.utils.toWei('1', 'ether'), maxuint256, zeroAddress, 23, { from: user }), "Card does not exist");
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });

  it('check lockMarket cant be called too early', async () => {
    /////// SETUP //////
    await depositDai(1000, user0);
    await newRental(1, 0, user0);
    //// TESTS ////
    //call step 1 before markets ended
    await expectRevert(realitycards.lockMarket(), "Market has not finished");
    await time.increase(time.duration.years(1));
    // // call step 1 after markets ended, should work
    await realitycards.lockMarket();
    // // call step 1 twice
    await expectRevert(realitycards.lockMarket(), "Incorrect state");
    // // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });


  it('check that cannot rent a card if less than 1 hours rent', async () => {
    await depositDai(1, user0);
    await expectRevert(realitycards.newRental(web3.utils.toWei('150', 'ether'), maxuint256, zeroAddress, 2, { from: user0 }), "Insufficient deposit");
  });



  it('check that users cannot transfer their NFTs until withdraw state', async () => {
    await rcfactory.changeMarketApproval(realitycards.address);
    user = user0;
    await depositDai(144, user);
    await newRental(1, 2, user);
    var owner = await realitycards.ownerOf(2);
    assert.equal(owner, user);
    // buidler giving me shit when I try and intercept revert message so just testing revert, in OPEN state
    await expectRevert(nftHubL2.transferFrom(user, user1, 2), "Incorrect state");
    await expectRevert(nftHubL2.safeTransferFrom(user, user1, 2), "Incorrect state");
    await expectRevert(nftHubL2.safeTransferFrom(user, user1, 2, web3.utils.asciiToHex("123456789")), "Incorrect state");
    await time.increase(time.duration.years(1));
    await realitycards.lockMarket();
    // should fail cos LOCKED
    await expectRevert(nftHubL2.transferFrom(user, user1, 2), "Incorrect state");
    await expectRevert(nftHubL2.safeTransferFrom(user, user1, 2), "Incorrect state");
    await expectRevert(nftHubL2.safeTransferFrom(user, user1, 2, web3.utils.asciiToHex("123456789")), "Incorrect state");
    await realitio.setResult(2);
    await realitycards.getWinnerFromOracle();
    // await realitycards.determineWinner();
    await realitycards.claimCard(2, { from: user });
    // these shoudl all fail cos wrong owner:
    var owner = await realitycards.ownerOf(2);
    assert.equal(owner, user);
    await expectRevert(nftHubL2.transferFrom(user, user1, 2, { from: user1 }), "Not owner");
    await expectRevert(nftHubL2.safeTransferFrom(user1, user1, 2, { from: user1 }), "Not owner");
    // these should not
    await nftHubL2.transferFrom(user, user1, 2, { from: user });
    await nftHubL2.safeTransferFrom(user1, user, 2, { from: user1 });
  });

  it('make sure functions cant be called in the wrong state', async () => {
    user = user0;
    realitycards2 = realitycards; // cos later we will add realitycards2 back
    var state = await realitycards2.state.call();
    assert.equal(1, state);
    // currently in state 'OPEN' the following should all fail 
    await expectRevert(realitycards2.withdraw(), "Incorrect state");
    await expectRevert(realitycards2.payArtist(), "Incorrect state");
    await expectRevert(realitycards2.payMarketCreator(), "Incorrect state");
    await expectRevert(realitycards2.payCardAffiliate(7), "Incorrect state");
    await expectRevert(realitycards2.claimCard(7), "Incorrect state");
    // increment state
    await time.increase(time.duration.years(1));
    await realitycards2.lockMarket();
    var state = await realitycards2.state.call();
    assert.equal(2, state);
    // currently in state 'LOCKED' the following should all fail 
    await expectRevert(realitycards2.collectRentAllCards(), "Incorrect state");
    await expectRevert(realitycards2.newRental(0, maxuint256, zeroAddress, 0), "Incorrect state");
    await expectRevert(realitycards2.exit(0), "Incorrect state");
    await expectRevert(realitycards2.sponsor(user0, 3), "Incorrect state");
    await expectRevert(realitycards2.payArtist(), "Incorrect state");
    await expectRevert(realitycards2.payMarketCreator(), "Incorrect state");
    await expectRevert(realitycards2.payCardAffiliate(8), "Incorrect state");
    // increment state
    await realitio.setResult(1);
    await realitycards2.getWinnerFromOracle();
    // await realitycards2.determineWinner();
    var state = await realitycards2.state.call();
    assert.equal(3, state);
    // currently in state 'WITHDRAW' the following should all fail 
    await expectRevert(realitycards2.lockMarket(), "Incorrect state");
    await expectRevert(realitycards2.collectRentAllCards(), "Incorrect state");
    await expectRevert(realitycards2.newRental(0, maxuint256, zeroAddress, 0), "Incorrect state");
    await expectRevert(realitycards2.exit(0), "Incorrect state");
    await erc20.approve(treasury.address, ether('3')) // we aren't testing erc20 here
    await expectRevert(realitycards2.sponsor(ether('3')), "Incorrect state");
  });

  it('check oracleResolutionTime and marketLockingTime expected failures', async () => {
    // someone else deploys question to realitio
    var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
    var arbitrator = "0xA6EAd513D05347138184324392d8ceb24C116118";
    var timeout = 86400;
    var templateId = 2;
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var slug = 'y';
    // resolution time before locking, expect failure
    var oracleResolutionTime = 69419;
    var marketLockingTime = 69420;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    await expectRevert(rcfactory.createMarket(0, '0x0', timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Oracle resolution time error");
    // resolution time > 1 weeks after locking, expect failure
    var oracleResolutionTime = 604810;
    var marketLockingTime = 0;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    await expectRevert(rcfactory.createMarket(0, '0x0', timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Oracle resolution time error");
    // resolution time < 1 week  after locking, no failure
    var oracleResolutionTime = 604790;
    var marketLockingTime = 0;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var slug = 'z';
    await rcfactory.createMarket(0, '0x0', timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0);
    // same time, no failure
    var oracleResolutionTime = 0;
    var marketLockingTime = 0;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var slug = 'a';
    await rcfactory.createMarket(0, '0x0', timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0);
  });


  it('test marketOpeningTime stuff', async () => {
    await depositDai(144, user0);
    // // check that state is 1 if marketopening time in the past
    var realitycards2 = await createMarketCustomeTimestamps(100, 100, 100);
    var state = await realitycards2.state();
    assert.equal(state, 1);
    var latestTime = await time.latest();
    var oneMonth = new BN('2592000');
    var oneYear = new BN('31104000');
    var oneMonthInTheFuture = oneMonth.add(latestTime);
    var oneYearInTheFuture = oneYear.add(latestTime);
    var realitycards3 = await createMarketCustomeTimestamps2(oneMonthInTheFuture, oneYearInTheFuture, oneYearInTheFuture);
    // check that if in the future, state 0 originally
    // just use the default realitycards
    var state = await realitycards3.state();
    assert.equal(state, 0);
    // advance time so its in the past, should work
    await time.increase(time.duration.weeks(8));
    await realitycards3.newRental(web3.utils.toWei('150', 'ether'), maxuint256, zeroAddress, 2, { from: user0 })
    // check that it won't increment state twice
    await realitycards3.newRental(web3.utils.toWei('200', 'ether'), maxuint256, zeroAddress, 2, { from: user0 })
    var state = await realitycards3.state();
    assert.equal(state, 1);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });

  it('test cant withdraw within minimum duration', async () => {
    await depositDai(10, user0);
    await newRental(1, 0, user0);
    await expectRevert(treasury.withdrawDeposit(678, { from: user0 }), "Too soon");
    // pass 5 mins, no difference
    await time.increase(time.duration.minutes(5));
    await expectRevert(treasury.withdrawDeposit(678, { from: user0 }), "Too soon");
    // pass 10 mins should now work
    await time.increase(time.duration.minutes(5));
    await treasury.withdrawDeposit(678, { from: user0 });
  });

});