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

contract('TestOrderbook', (accounts) => {

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
    for (let index = 0; index < 15; index++) {
      // user = eval("user" + index);
      erc20.transfer(accounts[index], ether("1000"), { from: user0 });
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


  // it('check that _revertToUnderbidder does not revert more than ten times ', async () => {
  //     user9 = accounts[9];
  //     user10 = accounts[10];
  //     user11 = accounts[11];
  //     user12 = accounts[12];
  //     user13 = accounts[13];
  //     user14 = accounts[14];
  //     //
  //     // console.log(user0); 
  //     // console.log(user1);
  //     // console.log(user2);
  //     // console.log(user3); 
  //     // console.log(user4);
  //     // console.log(user5);
  //     // console.log(user6); 
  //     // console.log(user7);
  //     // console.log(user8);
  //     // console.log(user9); 
  //     // console.log(user10);
  //     // console.log(user11);
  //     // console.log(user12); 
  //     // console.log(user13);
  //     // console.log(user14);
  //     /////// SETUP //////
  //     // console.log(realitycards.address);
  //     await depositDai(1000,user0);
  //     await depositDai(1000,user1);
  //     await depositDai(1000,user2);
  //     await depositDai(1000,user3);
  //     await depositDai(1000,user4);
  //     await depositDai(1000,user5);
  //     await depositDai(1000,user6);
  //     await depositDai(1000,user7);
  //     await depositDai(1000,user8);
  //     await depositDai(1000,user9);
  //     await depositDai(1000,user10);
  //     await depositDai(1000,user11);
  //     await depositDai(1000,user12);
  //     await depositDai(1000,user13);
  //     await depositDai(1000,user14);
  //     // everyone rents at the same price
  //     await newRental(10,0,user0); 
  //     await newRental(10,0,user1);
  //     await newRental(10,0,user2);
  //     await newRental(10,0,user3);
  //     await newRental(10,0,user4);
  //     await newRental(10,0,user5);
  //     await newRental(10,0,user6);
  //     await newRental(10,0,user7);
  //     await newRental(10,0,user8);
  //     await newRental(9,0,user9);
  //     await expectRevert(newRental(8,0,user10), "Location too high");
  //     await newRentalWithStartingPosition(7,0,user7,user10);
  //     await newRentalWithStartingPosition(6,0,user7,user11);
  //     await newRentalWithStartingPosition(5,0,user7,user12);
  //     await newRentalWithStartingPosition(4,0,user7,user13);
  //     await newRentalWithStartingPosition(3,0,user7,user14);
  //     // make sure owned for at least an hour
  //     await time.increase(time.duration.hours(1)); 
  //     // everyone withdraws deposit
  //     await time.increase(time.duration.minutes(10));
  //     await withdrawDeposit(1000,user0);
  //     await withdrawDeposit(1000,user1);
  //     await withdrawDeposit(1000,user2);
  //     await withdrawDeposit(1000,user3);
  //     await withdrawDeposit(1000,user4);
  //     await withdrawDeposit(1000,user5);
  //     await withdrawDeposit(1000,user6);
  //     await withdrawDeposit(1000,user7);
  //     await withdrawDeposit(1000,user8);
  //     await withdrawDeposit(1000,user9);
  //     await withdrawDeposit(1000,user10);
  //     await withdrawDeposit(1000,user11);
  //     await withdrawDeposit(1000,user12);
  //     await withdrawDeposit(1000,user13);
  //     await withdrawDeposit(1000,user14);
  //     // collect rent, it should revert back 10 places
  //     await realitycards.collectRentAllCards();
  //     var owner = await realitycards.ownerOf.call(0);
  //     assert.equal(owner, user10);
  //     var price = await realitycards.cardPrice.call(0);
  //     assert.equal(price, web3.utils.toWei('7', 'ether'));
  // });


  // test is invalid, assumes user0 remains owner at the end but they will have foreclosed
  it.skip('test _revertToUnderbidder will revert properly if current owner has deposit but previous owner does not', async () => {
    // setup
    console.log("user0 ", user0);
    console.log("user1 ", user1);
    console.log("user2 ", user2);
    await depositDai(144, user0);
    await depositDai(144, user1);
    await depositDai(144, user2);
    await newRental(72, 0, user0);
    await newRental(144, 0, user1);
    // 20 mins pass so card speciifc used, then withdraw the rest for user1
    await time.increase(time.duration.minutes(20));
    await newRental(288, 0, user2)
    await withdrawDeposit(1000, user1);
    // check that user 1 has zero deposit
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    // var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user1,0);
    // assert.equal(depositSpecific,0);
    var deposit = await treasury.userDeposit.call(user1);
    assert.equal(deposit, 0);
    // pass an hour and then exit so user 2 has insufficinet card deposit but there is still some, should return to zero
    await time.increase(time.duration.days(3));

    await realitycards.exit(0, { from: user2 });
    var owner = await realitycards.ownerOf.call(0);

    assert.equal(owner, user0);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });


  it('test orderbook various', async () => {
    // Tests the following:
    // add to orderbook in correct order
    // reduces the price to match that above it in the list
    // expected revert because incorrect starting location: too high and too low
    // update bid: test all cases
    user10 = accounts[10];
    user11 = accounts[11];
    user12 = accounts[12];
    user13 = accounts[13];
    user14 = accounts[14];
    await depositDai(10, user0);
    await depositDai(10, user1);
    await depositDai(10, user2);
    await depositDai(10, user3);
    await depositDai(10, user4);
    await depositDai(10, user5);
    await depositDai(10, user6);
    await depositDai(10, user7);
    await depositDai(10, user8);
    await depositDai(10, user9);
    await depositDai(10, user10);
    await depositDai(10, user11);
    await depositDai(10, user12);
    await depositDai(10, user13);
    await depositDai(10, user14);
    // rentals: position/price
    await newRentalCustomTimeLimit(10, 1, 0, user0); // 2, 10
    await newRental(9, 0, user1); // 5, 9
    await newRental(8, 0, user2); // 6, 8
    await newRental(10, 0, user3); // 3,1 10
    // var returnedPrice = await realitycards.newRental.call(ether('10.9'), 0, zeroAddress, 0, { from: user4 });
    //assert.equal(returnedPrice.toString(), ether('10').toString());
    await newRental(10.9, 0, user4); // 4, 10
    await newRental(20, 0, user5); // 1, 20
    await newRental(5, 0, user6); // 9, 5
    await newRental(8.5, 0, user7); // 7, 8
    await newRental(6, 0, user8); // 8, 6
    await newRental(50, 0, user9); // 0, 50
    await newRentalWithStartingPosition(4.8, 0, user5, user12); // 11, 4.8
    await newRentalWithStartingPosition(5, 0, user5, user13); // 10, 5 // <- this one checks that it matches one above, it is not reduced
    await newRentalWithStartingPosition(4.8, 0, user7, user14); // 12, 4.8
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user9);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('50', 'ether'));
    // check position and price
    // position 0
    var bid = await rcorderbook.getBid.call(realitycards.address, user9, 0);
    assert.equal(bid[4], web3.utils.toWei('50', 'ether'));
    assert.equal(bid[1], user5);
    assert.equal(bid[2], realitycards.address);
    // position 1
    var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
    assert.equal(bid[4], web3.utils.toWei('20', 'ether'));
    assert.equal(bid[1], user0);
    assert.equal(bid[2], user9);
    // position 2
    var bid = await rcorderbook.getBid.call(realitycards.address, user0, 0);
    assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
    //assert.equal(bid[5], (3600 * 24)); //timeHeldLimit now reduces as time is accrued, test needs updating.
    assert.equal(bid[1], user3);
    assert.equal(bid[2], user5);
    // position 3
    var bid = await rcorderbook.getBid.call(realitycards.address, user3, 0);
    assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
    assert.equal(bid[1], user4);
    assert.equal(bid[2], user0);
    // position 4
    var bid = await rcorderbook.getBid.call(realitycards.address, user4, 0);
    assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
    assert.equal(bid[1], user1);
    assert.equal(bid[2], user3);
    // position 5
    var bid = await rcorderbook.getBid.call(realitycards.address, user1, 0);
    assert.equal(bid[4], web3.utils.toWei('9', 'ether'));
    assert.equal(bid[1], user2);
    assert.equal(bid[2], user4);
    // position 6
    var bid = await rcorderbook.getBid.call(realitycards.address, user2, 0);
    assert.equal(bid[4], web3.utils.toWei('8', 'ether'));
    assert.equal(bid[1], user7);
    assert.equal(bid[2], user1);
    // position 7
    var bid = await rcorderbook.getBid.call(realitycards.address, user7, 0);
    assert.equal(bid[4], web3.utils.toWei('8', 'ether'));
    assert.equal(bid[1], user8);
    assert.equal(bid[2], user2);
    // position 8
    var bid = await rcorderbook.getBid.call(realitycards.address, user8, 0);
    assert.equal(bid[4], web3.utils.toWei('6', 'ether'));
    assert.equal(bid[1], user6);
    assert.equal(bid[2], user7);
    // position 9
    var bid = await rcorderbook.getBid.call(realitycards.address, user6, 0);
    assert.equal(bid[4], web3.utils.toWei('5', 'ether'));
    assert.equal(bid[1], user13);
    assert.equal(bid[2], user8);
    // position 10
    var bid = await rcorderbook.getBid.call(realitycards.address, user13, 0);
    assert.equal(bid[4], web3.utils.toWei('5', 'ether'));
    assert.equal(bid[1], user12);
    assert.equal(bid[2], user6);
    // position 11
    var bid = await rcorderbook.getBid.call(realitycards.address, user12, 0);
    assert.equal(bid[4], web3.utils.toWei('4.8', 'ether'));
    assert.equal(bid[1], user14);
    assert.equal(bid[2], user13);
    // position 12
    var bid = await rcorderbook.getBid.call(realitycards.address, user14, 0);
    assert.equal(bid[4], web3.utils.toWei('4.8', 'ether'));
    assert.equal(bid[1], realitycards.address);
    assert.equal(bid[2], user12);
    // check starting position
    // starting position too high - need more user account to test this now iteration limit is 100
    //await expectRevert(newRental(1,0,user10), "Location too high"); 
    //await expectRevert(newRentalWithStartingPosition(1,0,user9,user10), "Location too high");
    await newRentalWithStartingPosition(1, 0, user6, user10);
    // starting position too low
    await expectRevert(newRentalWithStartingPosition(10, 0, user1, user11), "Location too low");
    // update bid case 1A: was winner, > 10% higher, should just update price + limit
    await newRentalCustomTimeLimit(60, 1, 0, user9);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user9);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price.toString(), web3.utils.toWei('60', 'ether'));
    // await rcorderbook.printOrderbook(realitycards.address, 0);
    // console.log("0", user0);
    // console.log("1", user1);
    // console.log("2", user2);
    // console.log("3", user3);
    // console.log("4", user4);
    // console.log("5", user5);
    // console.log("6", user6);
    // console.log("7", user7);
    // console.log("8", user8);
    // console.log("9", user9);
    // console.log("10", user10);
    // console.log("11", user11);
    // console.log("12", user12);
    // console.log("13", user13);
    // console.log("14", user14);
    var bid = await rcorderbook.getBid.call(realitycards.address, user9, 0);
    assert.equal(bid[4], web3.utils.toWei('60', 'ether'));
    assert.equal(bid[5], (3600 * 24));
    assert.equal(bid[1], user5);
    assert.equal(bid[2], realitycards.address);
    // update bid case 1B: was winner, higher but < 10%, should remove
    await expectRevert(newRental(65, 0, user9), "Invalid price");
    await realitycards.exit(0, { from: user9 });
    // update bid case 1Ca: was winner, lower than prevous, but still winner, just update detials
    await newRentalCustomTimeLimit(15, 2, 0, user5);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user5);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price.toString(), web3.utils.toWei('15', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
    assert.equal(bid[4], web3.utils.toWei('15', 'ether'));
    assert.equal(bid[5], (3600 * 48));
    assert.equal(bid[1], user0);
    assert.equal(bid[2], realitycards.address);
    // update bid case 1Cb: was winner, but no longer winner, remove and add back
    await newRentalCustomTimeLimit(10.5, 0.5, 0, user5);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('10', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
    assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
    assert.equal(bid[5], (3600 * 12));
    assert.equal(bid[1], user1);
    assert.equal(bid[2], user4);
    // update bid case 2A: not winner, but now is [includes check that been deleted from previous location]
    await newRentalCustomTimeLimit(100, 0.5, 0, user7);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user7);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('100', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user7, 0);
    assert.equal(bid[4], web3.utils.toWei('100', 'ether'));
    assert.equal(bid[5], (3600 * 12));
    assert.equal(bid[1], user0);
    assert.equal(bid[2], realitycards.address);
    var bid = await rcorderbook.getBid.call(realitycards.address, user2, 0);
    assert.equal(bid[1], user8);
    var bid = await rcorderbook.getBid.call(realitycards.address, user8, 0);
    assert.equal(bid[2], user2);
    // update bid case 2B: not winner, still isn't. Let's move user 8 up a few [and check moved from previous]
    await newRentalCustomTimeLimit(20, 2, 0, user8);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user7);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('100', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user8, 0);
    assert.equal(bid[4], web3.utils.toWei('20', 'ether'));
    assert.equal(bid[5], (3600 * 48));
    assert.equal(bid[1], user0);
    assert.equal(bid[2], user7);
    var bid = await rcorderbook.getBid.call(realitycards.address, user2, 0);
    assert.equal(bid[1], user6);
    var bid = await rcorderbook.getBid.call(realitycards.address, user6, 0);
    assert.equal(bid[2], user2);
  });

  it('test _revertToUnderbidder', async () => {
    // console.log(user0); 
    // console.log(user1);
    // console.log(user2);
    // console.log(user3); 
    // console.log(user4);
    // console.log(user5);
    // console.log(user6); 
    // console.log(user7);
    // console.log(user8);
    // console.log(user9); 
    // console.log(user10); 
    // console.log(use11); 
    // console.log(user12); 
    // console.log(user3); 
    // console.log(realitycards.address); 
    await depositDai(10, user0);
    await depositDai(10, user1);
    await depositDai(10, user2);
    await depositDai(10, user3);
    await depositDai(10, user4);
    await depositDai(10, user5);
    await depositDai(10, user6);
    await depositDai(10, user7);
    await depositDai(10, user8);
    await depositDai(10, user9);
    // rentals: position/price
    await newRentalCustomTimeLimit(10, 1, 0, user0); // 2, 10
    await newRental(9, 0, user1); // 5, 9
    await newRental(8, 0, user2); // 6, 8
    await newRental(10, 0, user3); // 3,1 10
    await newRental(10.9, 0, user4); // 4, 10
    await newRental(20, 0, user5); // 1, 20
    await newRental(5, 0, user6); // 9, 5
    await newRental(8.5, 0, user7); // 7, 8
    await newRental(6, 0, user8); // 8, 6
    await newRental(50, 0, user9); // 0, 50
    // withdraw deposit of 9, will it switch to 0
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user9);
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user5);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('20', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
    assert.equal(bid[2], realitycards.address);
    var bid = await rcorderbook.getBid.call(realitycards.address, user9, 0);
    assert.equal(bid[0], 0);
    // withraw deposit for next 4 in line, check it cyles through
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user5);
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user3);
    await withdrawDeposit(1000, user4);
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('9', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user1, 0);
    assert.equal(bid[2], realitycards.address);
    var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
    assert.equal(bid[0], 0);
    var bid = await rcorderbook.getBid.call(realitycards.address, user0, 0);
    assert.equal(bid[0], 0);
    var bid = await rcorderbook.getBid.call(realitycards.address, user3, 0);
    assert.equal(bid[0], 0);
    var bid = await rcorderbook.getBid.call(realitycards.address, user4, 0);
    assert.equal(bid[0], 0);
  });

  it('test remove old bids', async () => {
    await time.increase(time.duration.weeks(50));
    await depositDai(100, user0);
    await depositDai(1000, user1);
    for (i = 0; i < 20; i++) {
      await newRental(1, i, user0);
      await newRental(2, i, user1);
    }
    await time.increase(time.duration.weeks(3));
    await realitycards.lockMarket();

    // check bids exist
    for (i = 0; i < 20; i++) {
      var exists = await rcorderbook.bidExists(user0, realitycards.address, i);
      assert.equal(exists, true);
    }

    // depositing should remove old bids
    await depositDai(100, user0);

    // check bids were deleted
    for (i = 0; i < 20; i++) {
      var exists = await rcorderbook.bidExists(user0, realitycards.address, i);
      assert.equal(exists, false);
    }
  });

});