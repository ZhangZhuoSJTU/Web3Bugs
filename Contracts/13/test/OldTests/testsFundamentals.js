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

contract('TestFundamentals', (accounts) => {

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

  async function depositDai(amount, user) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await erc20.approve(treasury.address, amount, { from: user })
    await treasury.deposit(amount, user, { from: user });
  }
  async function newRental(price, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price, 0, zeroAddress, outcome, { from: user });
  }

  async function newRentalWithDeposit(price, outcome, user, dai) {
    await depositDai(dai, user);
    price = web3.utils.toWei(price.toString(), "ether");
    await realitycards.newRental(price, 0, zeroAddress, outcome, {
      from: user
    });
  }

  async function newRentalCustomContract(contract, price, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await contract.newRental(price, maxuint256.toString(), zeroAddress, outcome, { from: user });
  }

  async function newRentalCustomTimeLimit(price, timelimit, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price, (timelimit * 3600 * 24).toString(), zeroAddress, outcome, { from: user });
  }

  async function withdraw(userx) {
    await realitycards.withdraw({ from: userx });
  }

  async function withdrawDeposit(amount, userx) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await treasury.withdrawDeposit(amount, true, { from: userx });
  }

  //     // check that the contract initially owns the token
  //     it('getOwner', async () => {
  //     var i;
  //     for (i = 0; i < 20; i++) {
  //         var owner = await realitycards.ownerOf.call(i);
  //         assert.equal(owner, realitycards.address);
  //     }
  //     });

  //   // check name
  //   it('getName', async () => {
  //     var name = await nftHubL2.name.call();
  //     assert.equal(name, 'RealityCards');
  //   });

  //     // check fundamentals first
  //   it('user 0 rent Token first time and check: price, deposits, owner etc', async () => {
  //     user = user0;
  //     // setup
  //     await depositDai(144,user);
  //     await newRental(144,4,user);
  //     // tests
  //     var price = await realitycards.cardPrice.call(4);
  //     assert.equal(price, web3.utils.toWei('144', 'ether'));
  //     var deposit = await treasury.userDeposit.call(user);
  //     assert.equal(deposit, web3.utils.toWei('144', 'ether'));
  //     marketAddress = await rcfactory.getMostRecentMarket.call(0);
  //     var owner = await realitycards.ownerOf.call(4);
  //     assert.equal(owner, user);
  //     // withdraw
  //     await time.increase(time.duration.minutes(10));
  //     await withdrawDeposit(1000,user);
  //    });

  //   it('test change price by renting again', async () => {
  //     user = user0;
  //     // setup
  //     await depositDai(10,user);
  //     await newRental(1,4,user);
  //     // tests
  //     var price = await realitycards.cardPrice.call(4);
  //     assert.equal(price, web3.utils.toWei('1', 'ether'));
  //     // rent again
  //     await newRental(3,4,user);
  //     var price = await realitycards.cardPrice.call(4);
  //     assert.equal(price, web3.utils.toWei('3', 'ether'));
  //     // withdraw
  //     await time.increase(time.duration.minutes(10));
  //     await withdrawDeposit(1000,user);
  //    });

  // it('test various after collectRent', async () => {
  //     // setup
  //     user = user0;
  //     await depositDai(100,user);
  //     await newRental(1,4,user);
  //     await time.increase(time.duration.weeks(1));
  //     await realitycards.collectRentAllCards();
  //     // tests
  //     //test deposits
  //     var deposit = await treasury.userDeposit.call(user); 
  //     var depositShouldBe = web3.utils.toWei('93', 'ether');
  //     var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
  //     assert.isBelow(difference/deposit,0.00001);
  //     //test totalRentCollected. 
  //     var totalRentCollected = await realitycards.totalRentCollected.call();
  //     var totalRentCollectedShouldBe = web3.utils.toWei('7', 'ether');
  //     var difference = Math.abs(totalRentCollected.toString()-totalRentCollectedShouldBe.toString());
  //     assert.isBelow(difference/deposit,0.00001);
  //     //test timeLastCollected
  //     var timeLastCollected = await realitycards.timeLastCollected.call(4);
  //     currentTime = await time.latest();
  //     assert.equal(currentTime.toString(),timeLastCollected.toString());
  //     //wait a week and repeat the above
  //     await time.increase(time.duration.weeks(1));
  //     await realitycards.collectRentAllCards();
  //     //test deposits
  //     var deposit = await treasury.userDeposit.call(user); 
  //     var depositShouldBe = web3.utils.toWei('86', 'ether');
  //     var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
  //     assert.isBelow(difference/deposit,0.00001);
  //     //test totalRentCollected. 
  //     var totalRentCollected = await realitycards.totalRentCollected.call();
  //     var totalRentCollectedShouldBe = web3.utils.toWei('14', 'ether');
  //     var difference = Math.abs(totalRentCollected.toString()-totalRentCollectedShouldBe.toString());
  //     assert.isBelow(difference/totalRentCollected,0.001);
  //     //test timeLastCollected
  //     var timeLastCollected = await realitycards.timeLastCollected.call(4);
  //     currentTime = await time.latest();
  //     assert.equal(currentTime.toString(),timeLastCollected.toString());
  //     // withdraw
  //     await time.increase(time.duration.minutes(10));
  //     await withdrawDeposit(1000,user);
  // });

  // // test collectRent again, but this time it should foreclose, does it?
  // it('collectRent function with foreclose and revertPreviousOwner', async () => {
  //     // setup
  //     await depositDai(6,user0);
  //     await newRental(1,1,user0);
  //     await depositDai(10,user1);
  //     await newRental(2,1,user1);
  //     await time.increase(time.duration.weeks(1));
  //     await realitycards.collectRentAllCards();
  //     // check reverted
  //     var owner = await realitycards.ownerOf.call(1);
  //     assert.equal(owner, user0);
  //     var price = await realitycards.cardPrice.call(1);
  //     assert.equal(price, web3.utils.toWei('1', 'ether'));
  //     await time.increase(time.duration.weeks(1));
  //     await realitycards.collectRentAllCards();
  //     var owner = await realitycards.ownerOf.call(1);
  //     assert.equal(owner, realitycards.address);
  //     var price = await realitycards.cardPrice.call(1);
  //     assert.equal(price, 0);
  // });

  // // these are two crucial variables that are relied on for other functions. are they what they should be?
  // it('test timeHeld and totalTimeHeld', async () => {
  //     await depositDai(10,user0);
  //     await newRental(1,0,user0);
  //     await depositDai(10,user1);
  //     await newRental(2,0,user1);
  //     await depositDai(12,user2);
  //     await newRental(3,0,user2);
  //     //tests
  //     await time.increase(time.duration.days(3));
  //     await realitycards.collectRentAllCards();
  //     // u2 3 days
  //     var timeHeld = await realitycards.timeHeld.call(0, user2);
  //     var timeHeldShouldBe = time.duration.days(3);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference,4);
  //     await time.increase(time.duration.days(3));
  //     await realitycards.collectRentAllCards();
  //     // u2 one more day
  //     var timeHeld = await realitycards.timeHeld.call(0, user2);
  //     var timeHeldShouldBe = time.duration.days(4);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference,2);
  //     await time.increase(time.duration.days(3));
  //     await realitycards.collectRentAllCards();
  //     // u2 still 4 days, u1 5 days, u0 0 days
  //     var timeHeld = await realitycards.timeHeld.call(0, user2);
  //     var timeHeldShouldBe = time.duration.days(4);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,2);
  //     var timeHeld = await realitycards.timeHeld.call(0, user1);
  //     var timeHeldShouldBe = time.duration.days(5);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     await time.increase(time.duration.days(3));
  //     await realitycards.collectRentAllCards();
  //     // u1 5 days, u0 3 days
  //     var timeHeld = await realitycards.timeHeld.call(0, user1);
  //     var timeHeldShouldBe = time.duration.days(5);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     var timeHeld = await realitycards.timeHeld.call(0, user0);
  //     var timeHeldShouldBe = time.duration.days(3);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     await time.increase(time.duration.days(1));
  //     await realitycards.collectRentAllCards();
  //     // u1 5 days, u0 6 day
  //     var timeHeld = await realitycards.timeHeld.call(0, user1);
  //     var timeHeldShouldBe = time.duration.days(5);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     var timeHeld = await realitycards.timeHeld.call(0, user0);
  //     var timeHeldShouldBe = time.duration.days(4);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     // buy again, check the new owner, then revert again
  //     user = user5;
  //     await depositDai(10,user5);
  //     await newRental(10,0,user5);
  //     await time.increase(time.duration.days(2));
  //     await realitycards.collectRentAllCards();
  //     var timeHeld = await realitycards.timeHeld.call(0, user5);
  //     var timeHeldShouldBe = time.duration.days(1);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     await time.increase(time.duration.days(7));
  //     await realitycards.collectRentAllCards();
  //     // u0 8 days
  //     var timeHeld = await realitycards.timeHeld.call(0, user0);
  //     var timeHeldShouldBe = time.duration.days(10);
  //     var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     await time.increase(time.duration.days(9));
  //     await realitycards.collectRentAllCards();
  //     // u0 10 days
  //     var timeHeld = await realitycards.timeHeld.call(0, user0);
  //     var timeHeldShouldBe = time.duration.days(10);
  //     var difference = Math.abs(timeHeld - timeHeldShouldBe); 
  //     assert.isBelow(difference/timeHeld,0.001);
  //     // check total collected
  //     var totalTimeHeldShouldBe = time.duration.days(20);
  //     var totalTimeHeld = await realitycards.totalTimeHeld.call(0);
  //     var difference = Math.abs(totalTimeHeld - totalTimeHeldShouldBe);
  //     assert.isBelow(difference/timeHeld,0.001);
  // });

  // it('test withdrawDeposit after zero mins', async () => {
  //     user = user0;
  //     await depositDai(144,user);
  //     await newRental(144,0,user);
  //     var deposit = await treasury.userDeposit.call(user); 
  //     marketAddress = await rcfactory.getMostRecentMarket.call(0);
  //     assert.equal(deposit, web3.utils.toWei('144', 'ether')); 
  //     // withdraw half
  //     var balanceBefore = await web3.eth.getBalance(user);
  //     await time.increase(time.duration.minutes(10));
  //     await withdrawDeposit(72,user);
  //     // check deposit balances 
  //     var deposit = await treasury.userDeposit.call(user); 
  //     var depositShouldBe = web3.utils.toWei('72', 'ether');
  //     var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
  //     assert.isBelow(difference/deposit,0.02);
  //     // check withdrawn amounts
  //     var balanceAfter = await web3.eth.getBalance(user);
  //     var depositWithdrawn = await balanceAfter - balanceBefore;
  //     var depositWithdrawnShouldBe = web3.utils.toWei('72', 'ether');
  //     var difference = Math.abs(depositWithdrawn.toString()-depositWithdrawnShouldBe.toString());
  //     assert.isBelow(difference / depositWithdrawnShouldBe, 0.02);
  //     // withdraw too much, should only allow you to withdraw the remaining
  //     var balanceBefore = await web3.eth.getBalance(user);
  //     await withdrawDeposit(100,user);
  //     // check deposit balances 
  //     var deposit = await treasury.userDeposit.call(user); 
  //     marketAddress = await rcfactory.getMostRecentMarket.call(0);
  //     assert.equal(deposit, 0); 
  //     // check withdrawn amounts 
  //     var balanceAfter = await web3.eth.getBalance(user);
  //     var depositWithdrawn = await balanceAfter - balanceBefore;
  //     var depositWithdrawnShouldBe = web3.utils.toWei('72', 'ether');
  //     var difference = Math.abs(depositWithdrawn.toString()-depositWithdrawnShouldBe.toString());
  //     assert.isBelow(difference / depositWithdrawnShouldBe, 0.025);
  // });

  // TODO test needs updating to consider block times and gas costs
  it('test withdrawDeposit- multiple markets', async () => {
    user = user0;
    await depositDai(10, user);
    await newRental(144, 0, user);
    //second market
    realitycards2 = await createMarketWithArtistSet();
    await realitycards2.newRental(web3.utils.toWei('288', 'ether'), maxuint256, zeroAddress, 0, { from: user });
    // withdraw all, should be 3 left therefore only withdraw 7
    var balanceBefore = await erc20.balanceOf(user);
    await time.increase(time.duration.minutes(10));
    // await realitycards.collectRentAllCards();
    // await realitycards2.collectRentAllCards();
    await withdrawDeposit(1000, user);
    var balanceAfter = await erc20.balanceOf(user);
    var depositWithdrawn = await balanceAfter - balanceBefore;
    var depositWithdrawnShouldBe = web3.utils.toWei('7', 'ether');
    var difference = Math.abs(depositWithdrawn.toString() - depositWithdrawnShouldBe.toString());

    // set to 0.3% loss is acceptable, this needs double checking though.
    assert.isBelow(difference / depositWithdrawn, 0.005);
    //original user tries to withdraw again, should be nothign to withdraw 
    await expectRevert(treasury.withdrawDeposit(1000, true), "Nothing to withdraw");
  });

  it('test exit- more than ten mins', async () => {
    // setup
    await depositDai(144, user0);
    await depositDai(144, user1);
    await newRental(10, 0, user0);
    await newRental(144, 0, user1);
    await time.increase(time.duration.hours(1));
    await realitycards.collectRentAllCards();
    // user 1 should still be owner, held for 1 hour
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.hours(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference, 5);
    // call exit, user 0 should own and no more time held on u1
    await realitycards.exit(0, { from: user1 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    await time.increase(time.duration.hours(1));
    await realitycards.collectRentAllCards();
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.hours(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference, 4);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it('test exit- reduce rental time to one min', async () => {
    // this has been gimped due to removing card specific deposit, a lot of this likely makes no sense now
    // check function is owned to change limit
    await expectRevert(treasury.setMinRental(12, { from: user1 }), "caller is not the owner");
    // change to one min
    await treasury.setMinRental(1440);
    await depositDai(144, user0);
    await depositDai(144, user1);
    await newRental(10, 0, user0);
    await newRental(144, 0, user1);
    await time.increase(time.duration.seconds(30));
    await realitycards.collectRentAllCards();
    // user 1 should be owner, held for 30 secs
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.seconds(30);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference, 5);
    // call exit, user 0 should own
    await realitycards.exit(0, { from: user1 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    // increase by 90 secs, user 0 will own and u1 should have ten minutes ownership time
    await time.increase(time.duration.seconds(90));
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    var timeHeld = await realitycards.timeHeld.call(0, user0);
    var timeHeldShouldBe = time.duration.seconds(92);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference / timeHeldShouldBe, 0.012);
    // to be safe, chcek that u0 has owned for 1 min
    await realitycards.collectRentAllCards();
    var timeHeld = await realitycards.timeHeld.call(0, user0);
    var timeHeldShouldBe = time.duration.seconds(92);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    // 0.1 cos we're dealing with individual seconds and indivdiual calls take a few seconds so 
    // more time has elapsed than the 90 that was set above
    assert.isBelow(difference / timeHeldShouldBe, 0.15);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it('test exitAll', async () => {
    // setup
    await depositDai(144, user0);
    await newRental(10, 0, user0);
    await newRental(10, 1, user0);
    await newRental(10, 2, user0);
    await newRental(10, 3, user0);
    await depositDai(144, user1);
    await newRental(144, 0, user1);
    await newRental(144, 1, user1);
    await newRental(144, 2, user1);
    await newRental(144, 3, user1);
    await time.increase(time.duration.hours(1));
    // exit all, should all be owned by user 0
    await realitycards.exitAll({ from: user1 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    var owner = await realitycards.ownerOf.call(1);
    assert.equal(owner, user0);
    var owner = await realitycards.ownerOf.call(2);
    assert.equal(owner, user0);
    var owner = await realitycards.ownerOf.call(3);
    assert.equal(owner, user0);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });


  it('test payRent/deposits after 0 mins, 5 mins, 15 mins, 20 mins', async () => {
    user = user0;
    await depositDai(144, user);
    await newRental(144, 0, user);
    // 0 mins
    var deposit = await treasury.userDeposit.call(user);
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    assert.equal(deposit, web3.utils.toWei('144', 'ether'));
    // 5 mins
    await time.increase(time.duration.minutes(5));
    await realitycards.collectRentAllCards();
    var deposit = await treasury.userDeposit.call(user);
    var depositShouldBe = web3.utils.toWei('143.5', 'ether');
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / depositShouldBe, 0.01);
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    // 15 mins
    await time.increase(time.duration.minutes(10));
    await realitycards.collectRentAllCards();
    var deposit = await treasury.userDeposit.call(user);
    var depositShouldBe = web3.utils.toWei('142.5', 'ether');
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / depositShouldBe, 0.01);
    // 20 mins
    await time.increase(time.duration.minutes(5));
    await realitycards.collectRentAllCards();
    var deposit = await treasury.userDeposit.call(user);
    var depositShouldBe = web3.utils.toWei('142', 'ether');
    var difference = Math.abs(deposit.toString() - depositShouldBe.toString());
    assert.isBelow(difference / depositShouldBe, 0.01);
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });

  it('test longestTimeHeld & longestOwner', async () => {
    await depositDai(10, user0);
    await newRental(1, 2, user0);
    // await newRental(web3.utils.toWei('1', 'ether'),2,web3.utils.toWei('10', 'ether'),user0 ); 
    await time.increase(time.duration.days(1));
    await realitycards.collectRentAllCards();
    var maxTimeHeld = await realitycards.longestTimeHeld(2);
    var maxTimeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(maxTimeHeld.toString() - maxTimeHeldShouldBe.toString());
    assert.isBelow(difference / maxTimeHeld, 0.0001);
    var longestOwner = await realitycards.longestOwner(2);
    var longestOwnerShouldBe = user0;
    assert.equal(longestOwner, longestOwnerShouldBe);
    // try again new owner
    await depositDai(10, user1);
    await newRental(2, 2, user1);
    // await newRental(web3.utils.toWei('2', 'ether'),2,web3.utils.toWei('10', 'ether'),user1 ); 
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllCards();
    var maxTimeHeld = await realitycards.longestTimeHeld(2);
    var maxTimeHeldShouldBe = time.duration.days(2);
    var difference = Math.abs(maxTimeHeld.toString() - maxTimeHeldShouldBe.toString());
    assert.isBelow(difference / maxTimeHeld, 0.0001);
    var longestOwner = await realitycards.longestOwner(2);
    var longestOwnerShouldBe = user1;
    assert.equal(longestOwner, longestOwnerShouldBe);
  });

  it('test exit but then can rent again', async () => {
    // setup
    await depositDai(144, user0);
    await depositDai(144, user1);
    await newRental(10, 0, user0);
    await newRental(144, 0, user1);
    await time.increase(time.duration.hours(1));
    await realitycards.collectRentAllCards();
    // exit, ownership reverts back to 1
    await realitycards.exit(0, { from: user1 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    // user1 rents again should be new owner
    await newRental(144, 0, user1);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    await time.increase(time.duration.hours(1));
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it('test timeHeldLimit', async () => {
    await depositDai(144, user0);
    await depositDai(144, user1);
    // first: check timeHeldLimit cant be below ten mins
    await expectRevert(realitycards.newRental(web3.utils.toWei('1', 'ether'), '500', zeroAddress, 0, { from: user0 }), "Limit too low");
    // second: limit is below rent owed and below total deposit
    // rent a card for one day only
    await newRentalCustomTimeLimit(1, 1, 0, user0);
    await newRentalCustomTimeLimit(5, 1, 0, user1);
    // do a minor interval to check it isnt reverting yet
    await time.increase(time.duration.hours(11));
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, user1);
    await time.increase(time.duration.weeks(10));
    await realitycards.collectRentAllCards();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference / timeHeld, 0.001);
    // check they paid 5 dai
    var collected = await realitycards.rentCollectedPerUser(user1);
    var collectedShouldBe = web3.utils.toWei('5', 'ether');
    var difference = Math.abs(collected.toString() - collectedShouldBe.toString());
    assert.isBelow(difference / collected, 0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, realitycards.address);
    // third: deposit is below rent owed and below limit
    await depositDai(144, user2);
    await depositDai(144, user3);
    await newRentalCustomTimeLimit(1, 1, 1, user2);
    await newRentalCustomTimeLimit(144, 100, 1, user3);
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllCards();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(1, user3);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference / timeHeld, 0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(1);
    assert.equal(owner, realitycards.address);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it('test timeHeldLimit failures both newRental and updateTimeHeldLimit', async () => {
    await depositDai(144, user0);
    await depositDai(144, user1);
    // first: check timeHeldLimit cant be below ten mins
    await expectRevert(realitycards.newRental(web3.utils.toWei('1', 'ether'), '500', zeroAddress, 0, { from: user0 }), "Limit too low");
    // change divisor and check it still gives the same error, set to 1 min and try 50 seconds
    await treasury.setMinRental(1440);
    // new market
    var realitycards2 = await createMarketWithArtistSet();
    await expectRevert(realitycards2.newRental(web3.utils.toWei('1', 'ether'), '50', zeroAddress, 0, { from: user0 }), "Limit too low");
    // but 70 second should work
    await realitycards2.newRental(web3.utils.toWei('1', 'ether'), '70', zeroAddress, 0);
    // same thing with updateeTimeHeld
    await expectRevert(realitycards2.updateTimeHeldLimit(50, 0, { from: user0 }), "Limit too low");
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });


  it('test timeHeldLimit using updateTimeHeldLimit', async () => {
    await depositDai(144, user0);
    await depositDai(144, user1);
    // first: check timeHeldLimit cant be below ten mins
    await expectRevert(realitycards.updateTimeHeldLimit('500', 0, { from: user0 }), "Limit too low");
    // second: limit is below rent owed and below total deposit
    // rent a card for one day only
    await newRental(1, 0, user0);
    await realitycards.updateTimeHeldLimit(86400, 0, { from: user0 });
    await newRental(5, 0, user1);
    await realitycards.updateTimeHeldLimit(86400, 0, { from: user1 });
    // do a minor interval to check it isnt reverting yet
    await time.increase(time.duration.hours(11));
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, user1);
    await time.increase(time.duration.weeks(10));
    await realitycards.collectRentAllCards();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference / timeHeld, 0.001);
    // check they paid 5 dai
    var collected = await realitycards.rentCollectedPerUser(user1);
    var collectedShouldBe = web3.utils.toWei('5', 'ether');
    var difference = Math.abs(collected.toString() - collectedShouldBe.toString());
    assert.isBelow(difference / collected, 0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, realitycards.address);
    // third: deposit is below rent owed and below limit
    await depositDai(144, user2);
    await depositDai(144, user3);
    await newRentalCustomTimeLimit(1, 1, 1, user2);
    await newRentalCustomTimeLimit(144, 100, 1, user3);
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllCards();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(1, user3);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString());
    assert.isBelow(difference / timeHeld, 0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(1);
    assert.equal(owner, realitycards.address);
    // check that 0 is turned into max
    await newRental(1, 1, user0);
    await realitycards.updateTimeHeldLimit(86400, 1, { from: user0 });
    var limit = await rcorderbook.getBid.call(realitycards.address, user0, 1);
    assert.equal(limit[5], 86400);
    await realitycards.updateTimeHeldLimit(0, 1, { from: user0 });
    var limit = await rcorderbook.getBid.call(realitycards.address, user0, 1);
    assert.equal(limit[5], 0);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
    await withdrawDeposit(1000, user2);
  });

  it('test newRentalWithDeposit', async () => {
    // var amount = web3.utils.toWei('144', 'ether')
    await newRentalWithDeposit(144, 0, user0, 144);
    // check that rent worked
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner, user0);
    // check deposits are correct
    var deposit = await treasury.userDeposit.call(user0)
    var depositShouldBe = web3.utils.toWei('144', 'ether');
    assert.equal(deposit, depositShouldBe);
  });

  it('test rentAllCards', async () => {
    await depositDai(1000, user0);
    await depositDai(1000, user1);
    await newRental(10, 0, user1);
    await realitycards.rentAllCards(web3.utils.toWei('100000', 'ether'));
    for (i = 0; i < 20; i++) {
      var owner = await realitycards.ownerOf.call(i);
      assert.equal(owner, user0);
    }
    // check price
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('11', 'ether'));
    for (i = 1; i < 20; i++) {
      var price = await realitycards.cardPrice.call(i);
      assert.equal(price, web3.utils.toWei('1', 'ether'));
    }
    // sum of all prices is 19 + 11 = 30
    await expectRevert(realitycards.rentAllCards(web3.utils.toWei('25', 'ether')), "Prices too high");
    realitycards.rentAllCards(web3.utils.toWei('30', 'ether'));
    // withdraw
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
    await withdrawDeposit(1000, user1);
  });

  it('test auto lock', async () => {
    await depositDai(1000, user0);
    await newRental(1, 0, user0);
    // check state 1
    var state = await realitycards.state.call();
    assert.equal(1, state);
    // increment 11 months, rent, should be state 1 still
    await time.increase(time.duration.weeks(51));
    await newRental(2, 0, user0);
    // check state 1
    var state = await realitycards.state.call();
    assert.equal(1, state);
    // increment 2 months, rent, should be state 2 still
    await time.increase(time.duration.weeks(2));
    await newRental(3, 0, user0);
    // check state 1
    var state = await realitycards.state.call();
    assert.equal(2, state);
    // withdraw for next test
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user0);
  });

  it('test exit', async () => {
    await depositDai(10, user0);
    await depositDai(10, user1);
    await depositDai(10, user2);
    await depositDai(10, user3);
    await depositDai(10, user4);
    await depositDai(10, user5);
    // rentals: position/price
    await newRentalCustomTimeLimit(10, 1, 0, user0); // 1, 10
    await newRental(9, 0, user1); // 4, 9
    await newRental(15, 0, user2); // 0, 15
    await newRental(10, 0, user3); // 2,  10
    await newRental(10.9, 0, user4); // 3, 10
    await newRental(5, 0, user5); // 5, 5
    // withdraw current owner's deposit and exit the two below it, check it goes down three steps
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user2);
    await realitycards.exit(0, { from: user2 });
    await realitycards.exit(0, { from: user0 });
    await realitycards.exit(0, { from: user3 });
    await realitycards.collectRentAllCards();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user4);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('10', 'ether'));
    var bid = await rcorderbook.getBid.call(realitycards.address, user4, 0);
    assert.equal(bid[2], realitycards.address);
    // this time, current owner calls exit
    await realitycards.exit(0, { from: user4 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    var price = await realitycards.cardPrice.call(0);
    assert.equal(price, web3.utils.toWei('9', 'ether'));
  });

  // more user accounts are going to be needed to finish this test
  it.skip('test collect rent iteration limit', async () => {
    var i, user
    for (i = 0; i < 10; i++) {
      user = eval("user" + i);
      await depositDai(100, user);
      await newRentalCustomTimeLimit(10, 1, 0, user); // 1, 10
    }
    await time.increase(time.duration.weeks(10));
    await realitycards.collectRentAllCards();

    // 10 users is below the limit
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, realitycards.address);

    // TODO need more user accounts
    for (i = 0; i < 100; i++) {
      user = eval("user" + i);
      await depositDai(100, user);
      await newRentalCustomTimeLimit(10, 1, 0, user); // 1, 10
    }
    await time.increase(time.duration.weeks(10));
    await realitycards.collectRentAllCards();

    // 100 users is below the limit
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, realitycards.address);
  });

});
