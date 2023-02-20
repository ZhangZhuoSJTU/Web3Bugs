// Vanilla node.js script.

/* 
* Script now deprecated. 
* TODO: replace with a script that deploys a PriceFeed.sol instance to mainnet, and interacts with it 
* (i.e. gets the price).
*
*/


// const ethers = require('ethers');
// const oracleABIs = require('./oracleABIs.js')
// const secrets = require ('./../secrets.js')
// const web3 = require('web3')

// const privateKey = secrets.privateKey

// const MainnetAggregatorABI = oracleABIs.MainnetAggregator
// const TestnetAggregatorABI = oracleABIs.TestnetAggregator
// const MainnetPriceFeedABI = oracleABIs.MainnetPriceFeed
// const TestnetPriceFeedABI = oracleABIs.TestnetPriceFeed

// const getGasFromTxHash = async (provider, txHash) => {
//   console.log("tx hash is")
//   console.log(txHash)
//   const receipt = await provider.getTransactionReceipt(txHash)
//   const gas = receipt.gasUsed
//   return gas
// }

// const mainnetProvider = ethers.getDefaultProvider();
// const testnetProvider = ethers.getDefaultProvider('testnet');

// const testnetWallet = new ethers.Wallet(privateKey, testnetProvider)
// const mainnetWallet = new ethers.Wallet(privateKey, mainnetProvider)

// // Addresses of the deployed Chainlink aggregator reference contracts
// const aggregatorAddressMainnet = "0x79fEbF6B9F76853EDBcBc913e6aAE8232cFB9De9";
// const aggregatorAddressTestnet = "0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507"

// // Addresses of our deployed PriceFeeds
// const priceFeedAddressMainnet = "0xfD7838852b42dE1F9189025523e7A7150b81df72"
// const priceFeedAddressTestnet = "0xEF23fa01A1cFf44058495ea20daC9D64f285ffc4"

// // Instantiate contract objects
// const mainnetAggregator = new ethers.Contract(aggregatorAddressMainnet, MainnetAggregatorABI, mainnetWallet);
// const testnetAggregator = new ethers.Contract(aggregatorAddressTestnet, TestnetAggregatorABI, testnetWallet);

// const mainnetPriceFeed = new ethers.Contract(priceFeedAddressMainnet, MainnetPriceFeedABI, mainnetWallet);
// const testnetPriceFeed = new ethers.Contract(priceFeedAddressTestnet, TestnetPriceFeedABI, testnetWallet);

// (async () => {

//     // --- Ropsten Testnet ---

//    // Set the Trove Manager address in the testnet PriceFeed
//     // const res = await testnetPriceFeed.setTroveManagerAddress('0x405143dAe9a8a703a1fE82ad4B65BBFE5505AF63')
//     // res.wait()
//     const recordedTroveManagerAddressTestnet = await testnetPriceFeed.troveManagerAddress()
//     console.log(`recorded TroveManager Address is ${recordedTroveManagerAddressTestnet}`)
   

//     // Call the testnet Chainlink aggregator directly
//     const price_aggregatorTestnet = (await testnetAggregator.latestAnswer()).toString();
//     const timestamp_aggregatorTestnet = (await testnetAggregator.latestTimestamp()).toString()
//     const latestAnswerID_aggregatorTestnet = (await testnetAggregator.latestRound()).toString()
//     console.log(`Testnet: Latest ETH:USD price from aggregator: ${price_aggregatorTestnet}`);
//     console.log(`Testnet: Timestamp of latest price from aggregator: ${timestamp_aggregatorTestnet}`);
//     console.log(`Testnet: ID of latest price answer from  aggregator: ${latestAnswerID_aggregatorTestnet}`)
//     console.log('\n')

//     // Call our testnet PriceFeed - get current price, and timestamp
//     const price_PriceFeedTestnet = await testnetPriceFeed.getLatestPrice_Testnet()
//     const timestamp_PriceFeedTestnet = await testnetPriceFeed.getLatestTimestamp_Testnet()
//     console.log(`Testnet: Latest ETH:USD price from deployed PriceFeed: ${price_PriceFeedTestnet}`)
//     console.log(`Testnet: Timestamp of latest price from deployed PriceFeed: ${timestamp_PriceFeedTestnet}`)
//     console.log('\n')
   
//     let price = await testnetPriceFeed.getPrice()
//     console.log (`stored'price' variable in testnet PriceFeed contract is ${price}`)

//    // Call our testnet PriceFeed - get recent past prices and timestamps
//     for (i = 5; i >= 1; i--) {
//         const previousPrice_PriceFeedTestnet = await testnetPriceFeed.getPreviousPrice_Testnet(i)
//         const previousTimestamp_PriceFeedTestnet = await testnetPriceFeed.getPreviousTimestamp_Testnet(i)
//         console.log(`Testnet: Price from ${i} rounds ago is: ${previousPrice_PriceFeedTestnet}`)
//         console.log(`Testnet: Timestamp of price from ${i} rounds ago is: ${previousTimestamp_PriceFeedTestnet}`)
//         console.log('\n')
//       }

//     // // --- Mainnet ---

//     // Calling the mainnet Chainlink aggregator directly 
//     const price_aggregatorMainnet = (await mainnetAggregator.currentAnswer()).toString();
//     const timestamp_aggregatorMainnet = (await mainnetAggregator.updatedHeight()).toString()
//     const latestAnswerID_aggregatorMainnet = (await mainnetAggregator.latestCompletedAnswer()).toString()
//     console.log(`Mainnet: Latest ETH:USD price from aggregator: ${price_aggregatorMainnet}`);
//     console.log(`Mainnet: Timestamp of latest price from aggregator: ${timestamp_aggregatorMainnet}`);
//     console.log(`Mainnet: ID of latest price answer from aggregator: ${latestAnswerID_aggregatorMainnet}`)
//     console.log('\n')

//     // Call our mainnet PriceFeed
//     const price_PriceFeedMainnet = (await mainnetPriceFeed.getLatestPrice()).toString()
//     const timestap_PriceFeedMainnet = (await mainnetPriceFeed.getLatestTimestamp()).toString()
//     const latestAnswerID_PriceFeedMainnet = (await mainnetPriceFeed.getLatestAnswerID()).toString()
//     console.log(`Mainnet: Latest ETH:USD price from deployed PriceFeed: ${price_PriceFeedMainnet}`)
//     console.log(`Mainnet: Timestamp of latest price from deployed PriceFeed: ${timestap_PriceFeedMainnet}`)
//     console.log(`Mainnet: ID of latest price answer from deployed PriceFeed: ${latestAnswerID_PriceFeedMainnet}`)
//     console.log('\n')

//     // --- Gas costs of updatePrice() ---

//     // console.log("Get gas costs")
//     // console.log("\n")

//     // Testnet - 30-35k gas
//     console.log("Call updatePrice() on Testnet")
//     const txResponseTestnet = await testnetPriceFeed.updatePrice_Testnet()
//     console.log("waiting for tx to be mined...")
//     txResponseTestnet.wait()
//     const gasTestnet = await getGasFromTxHash(testnetProvider, txResponseTestnet.hash)
//     console.log(`Testnet: updatePrice_testnet() gas cost: ${gasTestnet}`)
//     console.log('\n')

//     // // Mainnet - 30-35k gas
//     console.log("Call updatePrice() on Mainnet")
//     const txResponseMainnet = await mainnetPriceFeed.updatePrice()
//     console.log("waiting for tx to be mined...")
//     txResponseMainnet.wait()
//     const gasMainnet = await getGasFromTxHash(mainnetProvider, txResponseMainnet.hash)
//     console.log(`Testnet: updatePrice() gas cost: ${gasMainnet}`)

//     /* updatePrice() is a tx (21k) + SStore (5k) + emit event (1.5k) = 27.5k gas

//     Therefore, expected gas cost of a getLatestPrice() call is within a Trove function is (35k - 27.5k) 
//     = 7500 gas upper bound.
    
//     To check, deploy an instance of FunctionCaller contract to ropsten and mainnet, 
//     with a wrapped getLatestPrice() call. */
// })();