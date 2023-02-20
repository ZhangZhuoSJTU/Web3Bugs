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
var RCLeaderboard = artifacts.require('./RCLeaderboard.sol');
// mockups
var RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");

var SelfDestructMockup = artifacts.require("./mockups/SelfDestructMockup.sol");
var DaiMockup = artifacts.require("./mockups/DaiMockup.sol");
const tokenMockup = artifacts.require("./mockups/tokenMockup.sol");
// used where the address isn't important but can't be zero
const dummyAddress = '0x0000000000000000000000000000000000000001';

// arbitrator
var kleros = '0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D';

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

contract('TestFactory', (accounts) => {

  var realitycards;
  var tokenURIs = ['x', 'x', 'x', 'uri', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']; // 20 tokens
  tokenURIs = tokenURIs.concat(tokenURIs) // double the length of the array for the copies of the NFTs to mint
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
  var cardRecipients = [];

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
    rcorderbook = await RCOrderbook.new(treasury.address);
    rcleaderboard = await RCLeaderboard.new(treasury.address);
    // nft hubs
    nftHubL2 = await NftHubL2.new(rcfactory.address, dummyAddress);
    nftHubL1 = await NftHubL1.new(dummyAddress);
    // tell treasury about factory, tell factory about nft hub and reference
    await treasury.setFactoryAddress(rcfactory.address);
    await rcfactory.setReferenceContractAddress(rcreference.address);
    await rcfactory.setNftHubAddress(nftHubL2.address);
    await treasury.setOrderbookAddress(rcorderbook.address);
    await treasury.setLeaderboardAddress(rcleaderboard.address);
    await treasury.toggleWhitelist();

    // market creation
    let slug = "slug"
    await rcfactory.createMarket(
      0,
      '0x0',
      slug,
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
    await rcfactory.changeMarketApproval(marketAddress);
  });

  async function createMarketWithArtistSet() {
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    await rcfactory.addArtist(user8);
    var affiliateAddress = user7;
    await rcfactory.addAffiliate(user7);
    let slug = "slug"
    await rcfactory.createMarket(
      0,
      '0x0',
      slug,
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

    let slug = "slug"
    await rcfactory.createMarket(
      mode,
      '0x0',
      slug,
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
    await rcfactory.changeMarketApproval(marketAddress);
    return realitycards2;
  }

  async function createMarketCustomMode2(mode) {
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';

    let slug = "slug"
    await rcfactory.createMarket(
      mode,
      '0x0',
      slug,
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
    await rcfactory.changeMarketApproval(marketAddress);
    return realitycards2;
  }

  async function createMarketWithArtistAndCardAffiliatesAndSponsorship(amount, user) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = user8;
    var affiliateAddress = user7;
    var cardRecipients = [user5, user6, user7, user8, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0];
    await treasury.grantRole("ARTIST", user8);
    await treasury.grantRole("AFFILIATE", user7);
    await treasury.grantRole("CARD_AFFILIATE", user5);
    await treasury.grantRole("CARD_AFFILIATE", user6);
    await treasury.grantRole("CARD_AFFILIATE", user7);
    await treasury.grantRole("CARD_AFFILIATE", user8);
    await treasury.grantRole("CARD_AFFILIATE", user0);
    await erc20.approve(treasury.address, amount, { from: user })
    let slug = "slug"
    await rcfactory.createMarket(
      0,
      '0x0',
      slug,
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardRecipients,
      question,
      amount, { from: user }
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

  function accessControl(user, role) {
    let roleHash = web3.utils.soliditySha3(role)
    let errorMsg = "AccessControl: account " + user.toLowerCase() + " is missing role " + roleHash
    return errorMsg
  }

  it('test changeGovernorApproval and changeMarketCreationGovernorsOnly', async () => {
    // check user1 cant create market
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    // await rcfactory.changeMarketCreationGovernorsOnly();
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0, { from: user1 }), "Not approved");
    // add user1 to whitelist 
    await treasury.grantRole("GOVERNOR", user1);
    //try again, should work
    await rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0, { from: user1 });
    // remove them, should fail again
    await treasury.revokeRole(web3.utils.soliditySha3("GOVERNOR"), user1);
    await expectRevert(treasury.revokeRole(web3.utils.soliditySha3("GOVERNOR"), user1, { from: user1 }), "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x6270edb7c868f86fda4adedba75108201087268ea345934db8bad688e1feb91b");
    // disable whitelist, should work
    await rcfactory.changeMarketCreationGovernorsOnly();
    await rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0, { from: user1 });
    // re-enable whitelist, should not work again
    await rcfactory.changeMarketCreationGovernorsOnly();
    await expectRevert(treasury.revokeRole(web3.utils.soliditySha3("GOVERNOR"), user1, { from: user1 }), "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x6270edb7c868f86fda4adedba75108201087268ea345934db8bad688e1feb91b");
  });


  it('test sponsor via market creation', async () => {
    await rcfactory.setSponsorshipRequired(ether('200'));
    await treasury.grantRole("GOVERNOR", user3);
    await expectRevert(createMarketWithArtistAndCardAffiliatesAndSponsorship(100, user3), "Insufficient sponsorship");
    // undo approvals from the above as they are done again in following function
    await treasury.revokeRole(web3.utils.soliditySha3("ARTIST"), user8);
    await treasury.revokeRole(web3.utils.soliditySha3("AFFILIATE"), user7);
    await treasury.revokeRole(web3.utils.soliditySha3("CARD_AFFILIATE"), user5);
    await treasury.revokeRole(web3.utils.soliditySha3("CARD_AFFILIATE"), user6);
    await treasury.revokeRole(web3.utils.soliditySha3("CARD_AFFILIATE"), user7);
    await treasury.revokeRole(web3.utils.soliditySha3("CARD_AFFILIATE"), user8);
    await treasury.revokeRole(web3.utils.soliditySha3("CARD_AFFILIATE"), user0);
    var realitycards2 = await createMarketWithArtistAndCardAffiliatesAndSponsorship(200, user3);
    var totalRentCollected = await realitycards2.totalRentCollected();
    var totalRentCollectedShouldBe = web3.utils.toWei('200', 'ether');
    var difference = Math.abs(totalRentCollected.toString() - totalRentCollectedShouldBe.toString());
    assert.isBelow(difference / totalRentCollected, 0.00001);
  });

  it('test setMinimumPriceIncrease', async () => {
    var realitycards2 = await createMarketCustomMode(0);
    /////// SETUP //////
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await newRentalCustomContract(realitycards2, 1, 0, user0);
    // 5% increase, should not be owner
    await realitycards2.newRental(web3.utils.toWei('1.05', 'ether'), maxuint256, zeroAddress, 0, { from: user1 });
    var owner = await realitycards2.ownerOf.call(0);
    assert.equal(user0, owner);
    // update min to 5%, try again
    await rcfactory.setMinimumPriceIncreasePercent(5);
    var realitycards3 = await createMarketCustomMode2(0);
    await newRentalCustomContract(realitycards3, 1, 0, user0);
    await realitycards3.newRental(web3.utils.toWei('1.05', 'ether'), maxuint256, zeroAddress, 0, { from: user1 });
    var owner = await realitycards3.ownerOf.call(0);
    assert.equal(user1, owner);
    // check rent all cards works
    let card = await realitycards3.card(0);
    price = card.cardPrice
    await realitycards3.rentAllCards(web3.utils.toWei('100', 'ether'), { from: user0 });
    card = await realitycards3.card(0);
    price = card.cardPrice
    var priceShouldBe = ether('1.1025');
    assert.equal(price.toString(), priceShouldBe.toString());
  });


  it('test changeMarketApproval', async () => {
    await rcfactory.changeMarketApproval(realitycards.address);
    // first, check that recent market is hidden
    var hidden = await rcfactory.isMarketApproved.call(realitycards.address);
    assert.equal(hidden, false);
    // atttempt to unhide it with someone not on the whitelist
    await expectRevert(rcfactory.changeMarketApproval(realitycards.address, { from: user1 }), "Not approved");
    // add user 1 and try again, check that its not hidden
    await treasury.grantRole("GOVERNOR", user1);
    await rcfactory.changeMarketApproval(realitycards.address, { from: user1 });
    hidden = await rcfactory.isMarketApproved.call(realitycards.address);
    assert.equal(hidden, true);
    // hide it again, then check that cards cant be upgraded
    await rcfactory.changeMarketApproval(realitycards.address, { from: user1 });
    hidden = await rcfactory.isMarketApproved.call(realitycards.address);
    assert.equal(hidden, false);
  });



  it('test advancedWarning', async () => {
    await rcfactory.setMarketTimeRestrictions(86400, 0, 0);
    var latestTime = await time.latest();
    var oneHour = new BN('3600');
    var oneYear = new BN('31104000');
    var oneHourInTheFuture = oneHour.add(latestTime);
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    // opening time zero, should fail
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Market opening time not set");
    // opening time not 1 day in the future, should fail
    var timestamps = [oneHourInTheFuture, marketLockingTime, oracleResolutionTime];
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Market opens too soon");
    var twoDays = new BN('172800');
    var twoDaysInTheFuture = twoDays.add(latestTime);
    // opening time 2 days in the future, should not fail
    var timestamps = [twoDaysInTheFuture, marketLockingTime, oracleResolutionTime];
    rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0);
  });

  it('test setMaximumDuration', async () => {
    await rcfactory.setMarketTimeRestrictions(0, 0, 604800); // one week
    var latestTime = await time.latest();
    var twoWeeks = new BN('1210000');
    var twoWeeksInTheFuture = twoWeeks.add(latestTime);
    var marketLockingTime = twoWeeksInTheFuture;
    var oracleResolutionTime = twoWeeksInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var slug = 'r';
    // locking time two weeks should fail
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Market locks too late");
    // locking time now two weeks in future should pass
    var twoDays = new BN('172800');
    var twoDaysInTheFuture = twoDays.add(latestTime);
    var marketLockingTime = twoDaysInTheFuture.add(twoDays);
    var oracleResolutionTime = twoDaysInTheFuture.add(twoDays);
    var timestamps = [twoDaysInTheFuture, marketLockingTime, oracleResolutionTime];
    rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0);
  });


  it('test addArtist, addAffiliate, addCardAffiliate', async () => {
    let now = await time.latest();
    let oneDay = new BN('86400');
    var timestamps = [now, now.add(oneDay), now.add(oneDay)];
    var artistAddress = user2;
    var affiliateAddress = user2;
    var cardRecipients = ['0x0000000000000000000000000000000000000000', user6, user7, user8, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user0, user2];
    // locking time two weeks should fail
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Artist not approved");
    await treasury.grantRole("ARTIST", user2);
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Affiliate not approved");
    await treasury.grantRole("AFFILIATE", user2);
    await expectRevert(rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Card affiliate not approved");
    await treasury.grantRole("CARD_AFFILIATE", user0);
    await treasury.grantRole("CARD_AFFILIATE", user6);
    await treasury.grantRole("CARD_AFFILIATE", user7);
    await treasury.grantRole("CARD_AFFILIATE", user8);
    await treasury.grantRole("CARD_AFFILIATE", user2);
    await rcfactory.createMarket(0, '0x0', "slug", timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0);
    // check that not owner cant make changes
    await expectRevert(rcfactory.addArtist(user4, { from: user2 }), "Not approved");
    await expectRevert(rcfactory.addAffiliate(user4, { from: user2 }), "Not approved");
    await treasury.grantRole("GOVERNOR", user2);
    // should be fine now
    await rcfactory.addArtist(user4, { from: user2 });
    await rcfactory.addAffiliate(user4, { from: user2 });
    // remove user 2 from whitelist and same errors 
    await treasury.revokeRole(web3.utils.soliditySha3("GOVERNOR"), user2);
    await expectRevert(rcfactory.addArtist(user4, { from: user2 }), "Not approved");
    await expectRevert(rcfactory.addAffiliate(user4, { from: user2 }), "Not approved");
  });

  it('test getAllMarkets', async () => {
    // check the value
    var marketArray = await rcfactory.getAllMarkets(0);
    assert.equal(marketArray[0], realitycards.address);
  });

});