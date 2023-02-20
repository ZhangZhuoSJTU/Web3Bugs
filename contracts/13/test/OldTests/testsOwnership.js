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

contract('TestOwnership', (accounts) => {

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

  it('check that ownership can not be changed unless correct owner, treasury and factory', async () => {
    await expectRevert(rcfactory.transferOwnership(user1, { from: user1 }), "caller is not the owner");
    await expectRevert(treasury.transferOwnership(user1, { from: user1 }), "caller is not the owner");
    // check that works fine if owner
    await rcfactory.transferOwnership(user1, { from: user0 });
    await treasury.transferOwnership(user1, { from: user0 });
    // check that ownership changed
    var newOwner = await rcfactory.owner.call();
    assert.equal(newOwner, user1);
    var newOwner = await treasury.owner.call();
    assert.equal(newOwner, user1);
  });

  it('check renounce ownership works, treasury and factory', async () => {
    await expectRevert(rcfactory.renounceOwnership({ from: user1 }), "caller is not the owner");
    await expectRevert(treasury.renounceOwnership({ from: user1 }), "caller is not the owner");
    // check that works fine if owner
    await rcfactory.renounceOwnership({ from: user0 });
    await treasury.renounceOwnership({ from: user0 });
    // check that ownership changed
    var newOwner = await rcfactory.owner.call();
    assert.equal(newOwner, 0);
    var newOwner = await treasury.owner.call();
    assert.equal(newOwner, 0);
  });

  it('check onlyOwner is on relevant Treasury functions', async () => {
    await expectRevert(treasury.setMaxContractBalance(7 * 24, { from: user1 }), "caller is not the owner");
    await expectRevert(treasury.changeGlobalPause({ from: user1 }), "caller is not the owner");
    await expectRevert(treasury.changePauseMarket(realitycards.address, { from: user1 }), "caller is not the owner");
  });

  it('check onlyOwner is on relevant Factory functions', async () => {
    await expectRevert(rcfactory.setPotDistribution(0, 0, 0, 0, 0, { from: user1 }), "caller is not the owner");
    await expectRevert(treasury.setMinRental(7 * 24, { from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.changeGovernorApproval(user0, { from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.changeMarketCreationGovernorsOnly({ from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.setSponsorshipRequired(7 * 24, { from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.changeMarketApproval(user0, { from: user1 }), "Not approved");
    await expectRevert(rcfactory.setminimumPriceIncreasePercent(4, { from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.changeTrapCardsIfUnapproved({ from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.setAdvancedWarning(23, { from: user1 }), "caller is not the owner");
    await expectRevert(rcfactory.setMaximumDuration(23, { from: user1 }), "caller is not the owner");
  });

  it('test uberOwner Treasury', async () => {
    // market creation shit
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var slug = 'xr';
    // first, change owner
    await treasury.changeUberOwner(user5);
    // now try and change again and change factory from prevous owner, should fail
    await expectRevert(treasury.changeUberOwner(user0), "Verboten");
    await expectRevert(treasury.setFactoryAddress(user0), "Verboten");
    // deploy new factory, update address
    rcfactory2 = await RCFactory.new(treasury.address, realitio.address, kleros);
    await rcfactory2.getAllMarkets(0);
    await rcfactory2.changeCardAffiliateApproval(user5);
    await rcfactory2.changeCardAffiliateApproval(user6);
    await rcfactory2.changeCardAffiliateApproval(user7);
    await rcfactory2.changeCardAffiliateApproval(user8);
    await rcfactory2.changeCardAffiliateApproval(user0);
    await treasury.setFactoryAddress(rcfactory2.address, { from: user5 });
    await nftHubL2.setFactoryAddress(rcfactory2.address);
    await rcfactory2.setReferenceContractAddress(rcreference.address);
    // create market with old factory, should fail
    await expectRevert(rcfactory.createMarket(0, '0x0', timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0), "Not factory");
    // create market with new factory and do some standard stuff
    // nftHubL2 = await NftHubL2.new(rcfactory.address);
    await rcfactory2.setOrderbookAddress(rcorderbook.address);
    await rcorderbook.setFactoryAddress(rcfactory2.address);
    await rcfactory2.setNftHubAddress(nftHubL2.address, 100);
    await rcfactory2.createMarket(
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
    var marketAddress = await rcfactory2.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    await depositDai(144, user3);
    await newRentalCustomContract(realitycards2, 144, 4, user3);
    var price = await realitycards2.cardPrice.call(4);
    assert.equal(price, web3.utils.toWei('144', 'ether'));
    // check that the original market still works
    await newRental(69, 4, user3);
    var price = await realitycards.cardPrice.call(4);
    assert.equal(price, web3.utils.toWei('69', 'ether'));
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user3);
  });

  // test relies on redeploy contract multiplying prices by 2x
  // new test needs writing that doesnt use redeploys
  it.skip('test uberOwner factory', async () => {
    // market creation shit
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture;
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0, marketLockingTime, oracleResolutionTime];
    var artistAddress = '0x0000000000000000000000000000000000000000';
    var affiliateAddress = '0x0000000000000000000000000000000000000000';
    var cardRecipients = ['0x0000000000000000000000000000000000000000'];
    // first, change owner
    await rcfactory.changeUberOwner(user5);
    // now try and change again and change reference from prevous owner, should fail
    await expectRevert(rcfactory.changeUberOwner(user0), "Verboten");
    await expectRevert(rcfactory.setReferenceContractAddress(user0), "Verboten");
    // deploy new reference, update address
    rcreference2 = await RCMarket.new();
    await rcfactory.setReferenceContractAddress(rcreference2.address, { from: user5 });
    // check version has increased 
    var version = await rcfactory.referenceContractVersion.call();
    assert.equal(version, 2);
    // deploy new market from new reference contract, check that price is doubling
    var slug = 'xq';
    await rcfactory.createMarket(0, '0x0', timestamps, tokenURIs, artistAddress, affiliateAddress, cardRecipients, question, 0);
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    await depositDai(144, user3);
    await newRentalCustomContract(realitycards2, 144, 4, user3);
    var price = await realitycards2.cardPrice.call(4);
    assert.equal(price.toString(), web3.utils.toWei('288', 'ether'));
    // check that the original market still works
    await newRental(69, 4, user3);
    var price = await realitycards.cardPrice.call(4);
    assert.equal(price, web3.utils.toWei('69', 'ether'));
    await time.increase(time.duration.minutes(10));
    await withdrawDeposit(1000, user3);
  });



});