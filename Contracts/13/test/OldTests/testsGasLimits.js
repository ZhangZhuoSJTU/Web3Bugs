const { assert, artifacts } = require("hardhat");
const { BN, expectRevert, ether, expectEvent, balance, time } = require("@openzeppelin/test-helpers");
const _ = require("underscore");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");

// chose the test to run by setting this to the number, or 0 to ignore these tests.
var testChoice = 0;
// 1 = test maximum number of bids/user
// 2 = test maximum number of bids/user - with underbidders
// 3 = test maximum number of cards/market

// maximum time to run tests for, remember Ctrl+C can cancel early
var timeoutSeconds = 1000000;

// main contracts
var RCFactory = artifacts.require("./RCFactory.sol");
var RCTreasury = artifacts.require("./RCTreasury.sol");
var RCMarket = artifacts.require("./RCMarket.sol");
var NftHubL2 = artifacts.require("./nfthubs/RCNftHubL2.sol");
var NftHubL1 = artifacts.require("./nfthubs/RCNftHubL1.sol");
var RCOrderbook = artifacts.require('./RCOrderbook.sol');
// mockups
var RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");

var SelfDestructMockup = artifacts.require("./mockups/SelfDestructMockup.sol");
var DaiMockup = artifacts.require("./mockups/DaiMockup.sol");
var kleros = "0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D";
const tokenMockup = artifacts.require("./mockups/tokenMockup.sol");
// an array of market instances
var market = [];
// an array of the addresses (just a more readable way of doing market[].address)
var marketAddress = [];

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

contract("TestTreasury", (accounts) => {
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

  // for(i = 0; i < 20; i++){
  //   var userNumber = "user"+i;
  //   eval(userNumber + ' = ' + accounts[i]);
  // }

  // throws a tantrum if cardRecipients is not outside beforeEach for some reason
  var zeroAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async () => {
    erc20 = await tokenMockup.new("Dai", "Dai", ether("10000000"), user0);
    for (let index = 0; index < 10; index++) {
      user = eval("user" + index);
      erc20.transfer(user, ether("1000"), { from: user0 });
    }

    // main contracts
    treasury = await RCTreasury.new(erc20.address);
    rcfactory = await RCFactory.new(treasury.address);
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
    // mockups
    realitio = await RealitioMockup.new();
    dai = await DaiMockup.new();
    // market creation, start off without any.
    market.length = 0;
    marketAddress.length = 0;
    await createMarket();
  });

  afterEach(async () => {
    // // withdraw all users
    // //await time.increase(time.duration.minutes(20));
    // for (i = 0; i < 10; i++) {
    //     user = eval("user" + i);
    //     var deposit = await treasury.userDeposit.call(user)
    //     console.log(deposit.toString());
    //     if (deposit > 0) {
    //         console.log('withdrawing ', user);
    //         console.log('treasury ', treasury.address);
    //         await treasury.withdrawDeposit(web3.utils.toWei('10000', 'ether'), { from: user });
    //     }
    // }
    // await time.increase(time.duration.minutes(20));
  });

  async function createMarket(options) {
    // default values if no parameter passed
    // mode, 0 = classic, 1 = winner takes all, 2 = hot potato
    // timestamps are in seconds from now
    var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
    var defaults = {
      mode: 0,
      openTime: 0,
      closeTime: 31536000,
      resolveTime: 31536000,
      numberOfCards: 50,
      artistAddress: zeroAddress,
      affiliateAddress: zeroAddress,
      cardAffiliate: [zeroAddress],
      sponsorship: 0,
    };
    options = setDefaults(options, defaults);
    // assemble arrays
    var closeTime = new BN(options.closeTime).add(await time.latest());
    var resolveTime = new BN(options.resolveTime).add(await time.latest());
    var timestamps = [options.openTime, closeTime, resolveTime];
    var tokenURIs = [];
    for (i = 0; i < options.numberOfCards; i++) {
      tokenURIs.push("x");
    }

    await rcfactory.createMarket(
      options.mode,
      "0x0",
      timestamps,
      tokenURIs,
      options.artistAddress,
      options.affiliateAddress,
      options.cardAffiliate,
      question,
      options.sponsorship,
    );
    marketAddress.push(await rcfactory.getMostRecentMarket.call(0));
    market.push(await RCMarket.at(await rcfactory.getMostRecentMarket.call(0)));
  }

  async function depositDai(amount, user) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await erc20.approve(treasury.address, amount, { from: user })
    await treasury.deposit(amount, user, { from: user });
  }
  function setDefaults(options, defaults) {
    return _.defaults({}, _.clone(options), defaults);
  }

  async function newRental(options) {
    var defaults = {
      market: market[0],
      outcome: 0,
      price: 1,
      from: user0,
      timeLimit: 0,
      startingPosition: zeroAddress,
    };
    options = setDefaults(options, defaults);
    options.price = web3.utils.toWei(options.price.toString(), "ether");
    await options.market.newRental(options.price, options.timeLimit, options.startingPosition, options.outcome, { from: options.from });
  }

  async function withdrawDeposit(amount, userx) {
    amount = web3.utils.toWei(amount.toString(), "ether");
    await treasury.withdrawDeposit(amount, true, { from: userx });
  }

  if (testChoice == 1) {
    it('test maximum number of bids/user', async () => {
      var bidsPerMarket = 10;

      user = user0;
      var i = 0;
      var j = 0;
      var k = 0;
      var markets = [];
      var originalMarket = await rcfactory.getMostRecentMarket.call(0);
      markets.push(originalMarket);
      console.log('original market: ', markets[markets.length - 1]);
      tokenPrice = web3.utils.toWei('1', 'ether');
      withdrawAmount = tokenPrice * 20;
      console.log('starting loop');
      while (true) {
        // we're stuck here now, hold on tight!
        k++
        await depositDai(100, user);
        for (j = 0; j < k; j++) {
          tempMarket = await RCMarket.at(markets[j]);
          for (i = 0; i < bidsPerMarket; i++) {
            //await newRental(1,i,user);
            await tempMarket.newRental(tokenPrice, 0, zeroAddress, i, { from: user });
          }
        }

        var userBids = await treasury.userTotalBids(user);
        console.log(userBids.toString());
        //console.log(user);

        await time.increase(time.duration.seconds(600));

        //await withdrawDeposit(web3.utils.toWei('100', 'ether'),user);
        await treasury.withdrawDeposit(web3.utils.toWei('10000', 'ether'), { from: user });

        // create another market for the next loop and add it to the array
        var latestTime = await time.latest();
        var oneYear = new BN('31104000');
        var oneYearInTheFuture = oneYear.add(latestTime);
        var marketLockingTime = oneYearInTheFuture;
        var oracleResolutionTime = oneYearInTheFuture;
        var timestamps = [0, marketLockingTime, oracleResolutionTime];
        var artistAddress = '0x0000000000000000000000000000000000000000';
        var affiliateAddress = '0x0000000000000000000000000000000000000000';
        var tokenURIs = ['x', 'x', 'x', 'uri', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']; // 20 tokens
        var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        var cardRecipients = ['0x0000000000000000000000000000000000000000']
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
        markets.push(await rcfactory.getMostRecentMarket.call(0));
        console.log('new market: ', markets[markets.length - 1]);
      }

    }).timeout(timeoutSeconds);
  }
  if (testChoice == 2) {
    it('test maximum number of bids/user - with underbidders', async () => {
      var bidsPerMarket = 1; //max is 20
      var dummyMarkets = 0;
      var dummyUsers = 9;
      var totalMarkets = 55;

      user = user0;
      var i = 0;
      var j = 0;
      var k = 0;
      var markets = [];
      var originalMarket = await rcfactory.getMostRecentMarket.call(0);
      markets.push(originalMarket);
      console.log('original market: ', markets[markets.length - 1]);
      tokenPrice = web3.utils.toWei('1', 'ether');
      priceInt = 1;
      withdrawAmount = tokenPrice * 20;
      console.log('starting loop');

      //create markets
      for (i = 0; i < totalMarkets; i++) {
        // create another market for the next loop and add it to the array
        var latestTime = await time.latest();
        var oneYear = new BN('31104000');
        var oneYearInTheFuture = oneYear.add(latestTime);
        var marketLockingTime = oneYearInTheFuture;
        var oracleResolutionTime = oneYearInTheFuture;
        var timestamps = [0, marketLockingTime, oracleResolutionTime];
        var artistAddress = '0x0000000000000000000000000000000000000000';
        var affiliateAddress = '0x0000000000000000000000000000000000000000';
        var tokenURIs = ['x', 'x', 'x', 'uri', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']; // 20 tokens
        var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        var cardRecipients = ['0x0000000000000000000000000000000000000000']
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
        markets.push(await rcfactory.getMostRecentMarket.call(0));
        console.log('new market: ', markets[markets.length - 1]);
      }

      //dummy users placing high bids to burn their deposit fast
      for (m = 1; m < dummyUsers + 1; m++) {
        user = eval("user" + m);
        await depositDai(10, user);
        tokenPrice = web3.utils.toWei('10', 'ether');
        console.log('Placing high bid for user ', user);
        console.log('Market index ', m);
        tempMarket = await RCMarket.at(markets[m]);
        await tempMarket.newRental(tokenPrice, 0, zeroAddress, 0, { from: user });
      }

      startPrice = 1;
      // dummy users placing incremental bids on the same cards
      for (m = 1; m < dummyUsers + 1; m++) {
        user = eval("user" + m);
        //increase the price for each user
        startPrice = startPrice * 1.1;
        tokenPrice = web3.utils.toWei(startPrice.toString(), 'ether');
        console.log('Placing bids for user ', user);
        //place bids
        for (j = 10; j < totalMarkets - 10; j++) {
          console.log('Market index ', j);
          tempMarket = await RCMarket.at(markets[j]);
          await tempMarket.newRental(tokenPrice, 0, zeroAddress, 0, { from: user });
        }
      }


      await time.increase(time.duration.weeks(5));

      // go through the dummy markets and rent collect to burn user deposits
      for (j = 0; j < 10; j++) {
        tempMarket = await RCMarket.at(markets[j]);
        await tempMarket.collectRentAllCards();
        console.log('colleced rent on ', markets[j]);
        user = eval("user" + j);
        var deposit = await treasury.userDeposit.call(user);
        console.log('user deposit left ', deposit.toString());
      }

      console.log('Dummy bids placed, time accelerated ');

      // this is the main user we care about
      startPrice = startPrice * 1.1;
      tokenPrice = web3.utils.toWei(startPrice.toString(), 'ether')
      user = user0
      await depositDai(100, user);
      for (j = 10; j < totalMarkets - 10; j++) {
        tempMarket = await RCMarket.at(markets[j]);
        await tempMarket.newRental(tokenPrice, 0, zeroAddress, 0, { from: user });
      }
      //console.log('Dummy Markets ', dummyMarkets);
      console.log('About to withdraw main user ',);
      var userBids = await treasury.userTotalBids(user);
      console.log(userBids.toString());
      console.log('main user is: ', user);
      var owner = await tempMarket.ownerOf(0)
      console.log('card owner is ', owner)

      //var market = await treasury.totalDeposits();
      //console.log(market.toString());
      await time.increase(time.duration.seconds(600));

      //await withdrawDeposit(web3.utils.toWei('100', 'ether'),user);
      await treasury.withdrawDeposit(web3.utils.toWei('10000', 'ether'), { from: user });

      await time.increase(time.duration.seconds(600));

      var userBids = await treasury.userTotalBids(user);
      console.log(userBids.toString());
      //console.log(user);


    }).timeout(timeoutSeconds);
  }
  if (testChoice == 3) {
    it('test maximum number of cards/market', async () => {
      var markets = [];
      var tokenURIs = ['x']; // Start with 1 token

      //create markets
      while (true) {
        // create another market for the next loop and add it to the array
        var latestTime = await time.latest();
        var oneYear = new BN('31104000');
        var oneYearInTheFuture = oneYear.add(latestTime);
        var marketLockingTime = oneYearInTheFuture;
        var oracleResolutionTime = oneYearInTheFuture;
        var timestamps = [0, marketLockingTime, oracleResolutionTime];
        var artistAddress = '0x0000000000000000000000000000000000000000';
        var affiliateAddress = '0x0000000000000000000000000000000000000000';
        var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        var cardRecipients = ['0x0000000000000000000000000000000000000000']
        console.log('number of cards', tokenURIs.length);
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
        markets.push(await rcfactory.getMostRecentMarket.call(0));
        console.log('new market: ', markets[markets.length - 1]);
        tokenURIs.push('X');
      }
    }).timeout(timeoutSeconds);
  }

  if (testChoice == 4) {
    it('test maximum number of cards/market', async () => {
      var markets = [];
      var tokenURIs = ['x']; // Start with 1 token
      var tokenPrice = web3.utils.toWei('1', 'ether')
      //create markets
      while (true) {
        // create another market for the next loop and add it to the array
        var latestTime = await time.latest();
        var oneYear = new BN('31104000');
        var oneYearInTheFuture = oneYear.add(latestTime);
        var marketLockingTime = oneYearInTheFuture;
        var oracleResolutionTime = oneYearInTheFuture;
        var timestamps = [0, marketLockingTime, oracleResolutionTime];
        var artistAddress = '0x0000000000000000000000000000000000000000';
        var affiliateAddress = '0x0000000000000000000000000000000000000000';
        var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        var cardRecipients = ['0x0000000000000000000000000000000000000000']
        console.log('number of cards', tokenURIs.length);
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
        markets.push(await rcfactory.getMostRecentMarket.call(0));
        console.log('new market: ', markets[markets.length - 1]);
        tempMarket = await RCMarket.at(markets[markets.length - 1]);
        await depositDai(100, user0);
        for (i = 0; i < tokenURIs.length; i++) {
          //await newRental(1,i,user);
          await tempMarket.newRental(tokenPrice, 0, zeroAddress, i, { from: user0 });
        }

        await time.increase(time.duration.seconds(600));
        console.log('collecing rent on all cards ')
        await tempMarket.collectRentAllCards();
        await time.increase(time.duration.seconds(600));
        //await withdrawDeposit(web3.utils.toWei('100', 'ether'),user);
        await treasury.withdrawDeposit(web3.utils.toWei('10000', 'ether'), { from: user0 });

        tokenURIs.push('X');
      }
    }).timeout(timeoutSeconds);
  }
});