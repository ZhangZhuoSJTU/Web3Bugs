//require("dotenv").config();

var realityCardsFactory = artifacts.require("RCFactory");
//var factoryAddress = '0xe1Ab9305DA70b865d610116163A82E1fDF6cCcFD'; //testnet on Sokol
//var factoryAddress = '0x3b557a58E5c6c4Df3e3307F9c7f5ce46472d80F7'; //beta on xDai
var factoryAddress = '0x76d22B0065Ada142207E2cDce12322FB3F8c0bAA'; //dev on Sokol


// variables market specific
var marketOpeningTime = 0;
var marketLockingTime = 1616997600;
var oracleResolutionTime = 1616997600;
const sponsorship = 0;
var ipfsHash = 'QmdWBMbrFY9LvMmEYmdntS1LNbxWu7vh7CMZyvv8PyKg8g';
var question = 'What will the state of Starship SN11 be at the end of this week?';
var artistAddress = "0x0000000000000000000000000000000000000000";
var affiliateAddress = "0x0000000000000000000000000000000000000000";
var cardAffiliateAddresses = ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'];

// kovan overrides (*COMMENT OUT IF MAINNET*)
// var marketLockingTime = 100; 
// var oracleResolutionTime = 100; 

var timestamps = [marketOpeningTime, marketLockingTime, oracleResolutionTime];
var tokenURIs = [
  'https://cdn.realitycards.io/nftmetadata/release/token0.json',
  'https://cdn.realitycards.io/nftmetadata/release/token1.json',
  'https://cdn.realitycards.io/nftmetadata/release/token2.json',
];

module.exports = function () {
  async function createMarket() {
    // create market
    let factory = await realityCardsFactory.at(factoryAddress);
    console.log("CREATING MARKET");
    var transaction = await factory.createMarket(
      0,
      ipfsHash,
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardAffiliateAddresses,
      question,
      sponsorship,
    );

    var lastAddress = await factory.getMostRecentMarket.call(0);
    console.log("Market created at address: ", lastAddress);
    console.log("Block number: ", transaction.receipt.blockNumber);
    process.exit();
  }
  createMarket();
};