// read in extra arguments, this is to help deploy across multiple networks
// myArgs[0] = first extra argument.. etc
var myArgs = process.argv.slice(6, 9);

const _ = require('underscore');
const { BN, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

const argv = require('minimist')(process.argv.slice(2), {
  string: ['ipfs_hash'],
});

const argvMigration = require('minimist')(process.argv.slice(2), {
  string: ['migration'],
});
const migration = argvMigration['migration'];
let runMigration = null;
try {
  runMigration = require('../../migrations-backup/' + migration + '.js');
} catch (err) {
  console.log('Migrations not found: ' + err);
}

/* globals artifacts */
var RCTreasury = artifacts.require('./RCTreasury.sol');
var RCFactory = artifacts.require('./RCFactory.sol');
var RCMarket = artifacts.require('./RCMarket.sol');
var RCOrderbook = artifacts.require('./RCOrderbook.sol');
var RCLeaderboard = artifacts.require('./RCLeaderboard.sol');
var NftHubL2 = artifacts.require('./nfthubs/RCNftHubL2.sol');
var NftHubL1 = artifacts.require('./nfthubs/RCNftHubL1.sol');
var RealitioMockup = artifacts.require('./mockups/RealitioMockup.sol');
var tokenMockup = artifacts.require('./mockups/tokenMockup.sol');

// variables
// TODO: update chilvers' script with the relevant addresses here https://github.com/realitio/realitio-contracts/blob/master/config/arbitrators.json
var ambAddressXdai = '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59';
var ambAddressMainnet = '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e';
var realitioAddress = '0x325a2e0F3CCA2ddbaeBB4DfC38Df8D19ca165b47';
var arbAddressMainnet = '0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016'; // may not be correct
var arbAddressXdai = '0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6'; // may not be correct
var kleros = '0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D'; //double check this
const PoSDai = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063';
const PoSUSDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const childChainManager = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'; //double check this
const MintableERC721PredicateProxy = '0x932532aA4c0174b8453839A6E44eE09Cc615F2b7'
// Testnet addresses
var ambAddressSokol = '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560';
var ambAddressKovan = '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560';
var realitioAddressKovan = '0x325a2e0F3CCA2ddbaeBB4DfC38Df8D19ca165b47';
var arbAddressKovan = '0xA960d095470f7509955d5402e36d9DB984B5C8E2';

// read input arguments
var ProxyL2Address = myArgs[0];
var proxyL1Address = myArgs[1];
var ipfsHashes = argv['ipfs_hash'];

// an array of market instances
var market = [];
// an array of the addresses (just a more readable way of doing market[].address)
var marketAddress = [];

module.exports = async (deployer, network, accounts) => {
  if (
    network === 'teststage1' ||
    network === 'stage1' ||
    network === 'matic' ||
    network === 'matic2'
  ) {
    await deployer.deploy(RealitioMockup);
    realitio = await RealitioMockup.deployed();
    // deploy treasury, factory, reference market and nft hub
    await deployer.deploy(RCTreasury, PoSUSDC);
    treasury = await RCTreasury.deployed();
    await deployer.deploy(
      RCFactory,
      treasury.address,
      realitio.address,
      kleros
    );
    factory = await RCFactory.deployed();
    await deployer.deploy(RCMarket);
    reference = await RCMarket.deployed();
    await deployer.deploy(RCOrderbook, treasury.address);
    orderbook = await RCOrderbook.deployed();
    await deployer.deploy(RCLeaderboard, treasury.address);
    leaderboard = await RCLeaderboard.deployed();
    await deployer.deploy(NftHubL2, factory.address, childChainManager);
    nftHubL2 = await NftHubL2.deployed();
    // tell treasury about factory & ARB, tell factory about nft hub and reference
    await treasury.setFactoryAddress(factory.address, { gas: 200000 });
    await factory.setReferenceContractAddress(reference.address, { gas: 100000 });
    await factory.setNftHubAddress(nftHubL2.address, { gas: 100000 });
    await factory.setRealitioAddress(realitio.address, { gas: 100000 });
    await treasury.setOrderbookAddress(orderbook.address, { gas: 200000 });
    await treasury.setLeaderboardAddress(leaderboard.address, { gas: 200000 });
    // await treasury.toggleWhitelist({ gas: 100000 });

    // print out some stuff to be picked up by the deploy script ready for the next stage
    console.log('Completed stage 1');
    console.log('RCTreasuryAddress  ', RCTreasury.address);
    console.log('RCFactoryAddress   ', RCFactory.address);
    console.log('RCMarketAddress    ', RCMarket.address);
    console.log('RCOrderbookAddress ', RCOrderbook.address);
    console.log('NFTHubL2Address    ', nftHubL2.address);
    console.log('Realitio           ', realitio.address);
  } else if (
    network === 'teststage2' ||
    network === 'stage2' ||
    network === 'develop'
  ) {
    console.log('Begin Stage 2');
    // mainnet
    // deploy mainnet nft hub
    await deployer.deploy(NftHubL1, MintableERC721PredicateProxy);
    nftHubL1 = await NftHubL1.deployed();

    console.log('Completed stage 2');
    console.log("Layer 1 NFT hub ", nftHubL1.address);
  } else if (network === 'graphTesting') {
    /**************************************
     *                                     *
     *     GRAPH TESTING WHOOT WHOOT!      *
     *                                     *
     **************************************/

    console.log('Local Graph Testing, whoot whoot');

    // mockups
    await deployer.deploy(
      tokenMockup,
      'Token name',
      'TKN',
      '150000000000000000000000',
      accounts[0]
    );
    erc20 = await tokenMockup.deployed();
    await deployer.deploy(RealitioMockup);
    realitio = await RealitioMockup.deployed();

    // deploy treasury, factory, reference market and nft hub
    await deployer.deploy(RCTreasury, erc20.address);
    treasury = await RCTreasury.deployed();
    await deployer.deploy(
      RCFactory,
      treasury.address,
      realitio.address,
      realitio.address
    );
    factory = await RCFactory.deployed();
    await deployer.deploy(RCMarket);
    reference = await RCMarket.deployed();
    await deployer.deploy(RCOrderbook, treasury.address);
    orderbook = await RCOrderbook.deployed();
    await deployer.deploy(RCLeaderboard, treasury.address);
    leaderboard = await RCLeaderboard.deployed();
    await deployer.deploy(NftHubL2, factory.address, childChainManager);
    nftHubL2 = await NftHubL2.deployed();
    await deployer.deploy(NftHubL1, MintableERC721PredicateProxy);
    nftHubL1 = await NftHubL1.deployed();
    // tell treasury and factory about various things
    await treasury.setFactoryAddress(factory.address);
    await treasury.setOrderbookAddress(orderbook.address);
    await treasury.setLeaderboardAddress(leaderboard.address);
    await factory.setReferenceContractAddress(reference.address);
    await factory.setNftHubAddress(nftHubL2.address);
    // disable whitelist
    await treasury.toggleWhitelist();
    // fund accounts
    for (let index = 0; index < 101; index++) {
      await erc20.transfer(accounts[index], '1000000000000000000000', {
        from: accounts[0],
      });
    }
    //whitelist accounts
    // for (let index = 0; index < 20; index++) {
    //   await treasury.addToWhitelist(accounts[index]);
    // }

    /***************************************
     *                                     *
     *    START LOCAL TESTING SETUP HERE   *
     *                                     *
     **************************************/

    await runMigration(
      accounts,
      market,
      factory,
      treasury,
      ipfsHashes,
      time,
      createMarket,
      closeMarket,
      depositDai,
      rent,
      exit
    );

    /**************************************
     *                                     *
     *    END LOCAL TESTING SETUP HERE     *
     *                                     *
     **************************************/

    console.log('treasury.address: ', treasury.address);
    console.log('factory.address: ', factory.address);
    console.log('orderbook.address: ', orderbook.address);
    console.log('leaderboard.address: ', leaderboard.address);
  } else {
    console.log('No deploy script for this network');
  }
};

async function createMarket(options) {
  // default values if no parameter passed
  // timestamps are in seconds from now
  var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
  var defaults = {
    mode: 0, // mode, 0 = classic, 1 = winner takes all, 2 = hot potato
    ipfs: 0x0, // ipfs hash
    slug: "slug", // slug
    openTime: 0, // seconds delay before market opens
    closeTime: 31536000, // seconds delay from now before market closes - default 31536000 = 1 year
    resolveTime: 0, // seconds delay from close before market resolves
    numberOfCards: 4, // the number of cards to create
    artistAddress: ZERO_ADDRESS,
    affiliateAddress: ZERO_ADDRESS,
    cardAffiliate: [], // remember this is an array
    sponsorship: 0,
  };
  options = setDefaults(options, defaults);
  // assemble arrays
  var openTime = new BN(options.openTime).add(await time.latest());
  var closeTime = new BN(options.closeTime).add(await time.latest());
  var resolveTime = new BN(options.resolveTime).add(closeTime);
  var timestamps = [openTime, closeTime, resolveTime];
  var tokenURIs = [];
  for (i = 0; i < options.numberOfCards; i++) {
    tokenURIs.push('x');
  }
  // double the length of the array for the copies to be minted
  tokenURIs = tokenURIs.concat(tokenURIs)

  await factory.createMarket(
    options.mode,
    options.ipfs,
    options.slug,
    timestamps,
    tokenURIs,
    options.artistAddress,
    options.affiliateAddress,
    options.cardAffiliate,
    question,
    options.sponsorship
  );
  var recentMarketAddress = await factory.getMostRecentMarket.call(0);
  marketAddress.push(recentMarketAddress);
  market.push(await RCMarket.at(await factory.getMostRecentMarket.call(0)));
  await factory.changeMarketApproval(recentMarketAddress);
}

async function closeMarket(options) {
  var defaults = {
    market: market[0],
    winningOutcome: 0,
  };
  options = setDefaults(options, defaults);

  await options.market.lockMarket();
  await realitio.setResult(options.market.address, options.winningOutcome);
  await options.market.getWinnerFromOracle();
}

async function depositDai(amount, user) {
  amount = web3.utils.toWei(amount.toString(), 'ether');
  await erc20.approve(treasury.address, amount, { from: user });
  await treasury.deposit(amount, user, { from: user });
}

function setDefaults(options, defaults) {
  return _.defaults({}, _.clone(options), defaults);
}

async function rent(options) {
  var defaults = {
    market: market[0],
    outcome: 0,
    from: 0x00,
    timeLimit: 0,
    startingPosition: ZERO_ADDRESS,
  };
  options = setDefaults(options, defaults);
  let newPrice = web3.utils.toWei('1', 'ether');

  try {
    if (options.price) {
      newPrice = web3.utils.toWei(options.price.toString(), 'ether');
    } else {
      let card = await options.market.card(options.outcome);
      const currentPrice = card.cardPrice;
      const currentPriceBN = new BN(currentPrice);
      newPrice = currentPriceBN.add(currentPriceBN.div(new BN('10')));
      if (!newPrice.isZero()) {
        newPrice = newPrice.toString();
      } else {
        newPrice = web3.utils.toWei('1', 'ether');
      }
    }
    await options.market.newRental(
      newPrice,
      options.timeLimit,
      options.startingPosition,
      options.outcome,
      { from: options.from }
    );
  } catch (err) {
    console.log(
      err,
      `on rent from account:${options.from}, market: ${options.market.address
      }, card: ${options.outcome}, price: ${web3.utils.fromWei(
        newPrice,
        'ether'
      )}, timeLimit: ${options.timeLimit}`
    );
  }
}

async function exit(options) {
  var defaults = {
    market: market[0],
    outcome: 0,
    from: 0x00,
  };
  options = setDefaults(options, defaults);

  await options.market.exit(options.outcome, { from: options.from });
}

async function sponsor(options) {
  var defaults = {
    market: market[0],
    amount: 0,
    from: 0x00,
  };
  options = setDefaults(options, defaults);

  var amount = web3.utils.toWei(options.amount.toString(), 'ether');
  await erc20.approve(treasury.address, amount, { from: options.from });
  await options.market.sponsor(amount, {
    from: options.from,
  });
}

// Most recent deployments:

// Treasury: 0x23142EfEb9D8261292c7B12371E9f8688a7C7142
// Factory: 0xe7e5A63E548C03C8e2e3B49bAEAf7967114FEc62
// Orderbook: 0x622a94374B854B079f8941279543E38fd8ca2b58
