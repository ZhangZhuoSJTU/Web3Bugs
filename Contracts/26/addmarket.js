const realityCardsFactory = artifacts.require("RCFactory");
const fs = require('fs');
let myArgs = process.argv.slice(1, 9);

const SRC = "test" // put the event name in here (the folder it is stored in)
// truffle exec addmarket.js --network matic

// first part of name should match the network name truffle uses
const teststage1_Factory = '0xe1Ab9305DA70b865d610116163A82E1fDF6cCcFD'; //testnet on Sokol
const xdai_Factory = '0x5b7477AcFa49Cc71530A1119ddbC0d3c30ac8ffE'; //unaudited beta on xDai
const dev_Factory = '0x76d22B0065Ada142207E2cDce12322FB3F8c0bAA'; //dev on Sokol
// const matic_Factory = '0x3d3dCb7f0d05B3297DCBa42D6732373D95355f7c' //dev on Matic
// const matic_Factory = '0xc15941bF3701cE7bf7084A6864cf226eC956b12a' //mastersync on Matic
const matic_Factory = '0xda872a9e5252855F7Bc4f3D7e81eB245C9f07A64' // Beta on Matic

module.exports = async () => {
  async function createMarket() {
    // create market
    let factory = await realityCardsFactory.at(factoryAddress);
    console.log("Adding Artist");
    if (artistAddress != '0x0000000000000000000000000000000000000000') {
      await factory.addArtist(artistAddress)
    }

    // for now deuplicate the original tokenURIs for the copies
    tokenURIs = tokenURIs.concat(tokenURIs);

    console.log("CREATING MARKET");
    console.log("ipfs hash ", ipfsHash);
    console.log("timestamps", timestamps);
    console.log("tokenURIs", tokenURIs);
    console.log("artistAddress", artistAddress);
    console.log("affiliateAddress", affiliateAddress);
    console.log("cardAffiliateAddresses", cardAffiliateAddresses);
    console.log("question", question);
    console.log("sponsorship", sponsorship);
    var transaction = await factory.createMarket(
      0,
      ipfsHash,
      slug,
      timestamps,
      tokenURIs,
      artistAddress,
      affiliateAddress,
      cardAffiliateAddresses,
      question,
      sponsorship
    );

    var lastAddress = await factory.getMostRecentMarket.call(0);
    console.log("Market created at address: ", lastAddress);
    console.log("Block number: ", transaction.receipt.blockNumber);


  }
  console.log("Starting Market Script");
  let factoryAddress, question
  try {
    const jsonString = fs.readFileSync('./events/' + SRC + '/config.json')
    const CONFIG = JSON.parse(jsonString)
    timestamps = [CONFIG.start, CONFIG.end, CONFIG.end];
    question = CONFIG.oracle
    artistAddress = CONFIG.artist
    affiliateAddress = CONFIG.affiliate
    cardAffiliateAddresses = CONFIG.cardAffiliates
    tokenURIs = CONFIG.tokenURIs
    ipfsHash = CONFIG.ipfs
    sponsorship = CONFIG.sponsorship
    slug = CONFIG.slug

  } catch (err) {
    console.log(err)
    return
  }
  factoryAddress = eval(myArgs[4] + '_Factory')

  console.log("Factory address ", factoryAddress);
  await createMarket();
  process.exit();
};