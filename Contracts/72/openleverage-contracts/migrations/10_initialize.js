const OpenLevV1 = artifacts.require("OpenLevDelegator");
const ControllerV1 = artifacts.require("ControllerV1");
const ControllerDelegator = artifacts.require("ControllerDelegator")
const Gov = artifacts.require("GovernorAlpha");
const Timelock = artifacts.require("Timelock");
const OLEToken = artifacts.require("OLEToken");
const Reserve = artifacts.require("Reserve");
const OLETokenLock = artifacts.require("OLETokenLock");
const DexAggregatorV1 = artifacts.require("BscDexAggregatorV1");

const utils = require("./util");
const m = require('mocha-logger');

module.exports = async function (deployer, network, accounts) {
    if (utils.isSkip(network)) {
        return;
    }
    await Promise.all([
        await initializeContract(accounts, network),
        await initializeLenderPool(accounts, network),
        // await releasePower2Gov(accounts),
        // await loggerInfo()
    ]);
    m.log("initialize finished......");

};

/**
 *initializeContract
 */
async function initializeContract(accounts, network) {
    let tl = await Timelock.at(Timelock.address);
    /**
     * Controller
     */
    m.log("Waiting controller setInterestParam......");
    let blocksPerYear = toBN(utils.blocksPerYear(network));
    await tl.executeTransaction(ControllerDelegator.address, 0, 'setInterestParam(uint256,uint256,uint256,uint256)',
        encodeParameters(['uint256', 'uint256', 'uint256', 'uint256'], [toBN(30e16).div(blocksPerYear), toBN(30e16).div(blocksPerYear), toBN(160e16).div(blocksPerYear), toBN(70e16)]), 0);
}


/**
 *initializeToken
 */
async function initializeToken(accounts) {

}


/**
 *initializeLenderPool
 */
async function initializeLenderPool(accounts, network) {

    switch (network) {
        case utils.kovan:
            m.log("waiting controller create FEI - WETH market ......");
            await intializeMarket(accounts, network, '0x4E9d5268579ae76f390F232AEa29F016bD009aAB', '0xC58854ce3a7d507b1CA97Fa7B28A411956c07782', 3000);
            m.log("waiting controller create XOR - WETH market ......");
            await intializeMarket(accounts, network, '0xcc00A6ecFe6941EabF4E97EcB717156dA47FFc81', '0xC58854ce3a7d507b1CA97Fa7B28A411956c07782', 3100);
            m.log("waiting controller create USDC - WETH9 market ......");
            await intializeMarket(accounts, network, '0x7a8bd2583a3d29241da12dd6f3ae88e92a538144', '0xd0a1e359811322d97991e03f863a0c30c2cf029c', 3300, "0x02002710");
            break;
        case utils.mainnet:
            m.log("waiting controller create MPL/USDC market ......");
            await intializeMarket(accounts, network, '0x33349b282065b0284d756f0577fb39c158f935e6', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 2500);
            m.log("waiting controller create ETH/USDC market ......");
            await intializeMarket(accounts, network, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 2500, "0x02000bb8");
            break;
        case utils.bscIntegrationTest:
            m.log("waiting controller create WBNB - BUSD market ......");
            await intializeMarket(accounts, network, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', '0xe9e7cea3dedca5984780bafc599bd69add087d56', 3000);
            break;
    }
}

async function intializeMarket(accounts, network, token0, token1, marginLimit, dexData) {
    let controller = await ControllerV1.at(ControllerDelegator.address);
    let transaction = await controller.createLPoolPair(token0, token1, marginLimit, dexData == undefined ? utils.getUniV2DexData(network) : dexData);
    let pool0 = transaction.logs[0].args.pool0;
    let pool1 = transaction.logs[0].args.pool1;
    m.log("pool0=", pool0.toLowerCase());
    m.log("pool1=", pool1.toLowerCase());
}

/**
 *initializeFarmings
 */
async function initializeFarmings(accounts) {

}

async function initializeFarming(accounts, farmingAddr, reward) {

}

/**
 *releasePower2Gov
 */
async function releasePower2Gov(accounts) {
    let tl = await Timelock.at(Timelock.address);
    let gov = await Gov.at(Gov.address);
    m.log("waiting tl setPendingAdmin......");
    await tl.setPendingAdmin(Gov.address);
    m.log("waiting gov __acceptAdmin......");
    await gov.__acceptAdmin();
    m.log("waiting gov __abdicate......");
    await gov.__abdicate();
}

async function loggerInfo() {
    m.log("OLEToken.address=", OLEToken.address.toLowerCase());
    m.log("Gov.address=", Gov.address.toLowerCase());
    m.log("Timelock.address=", Timelock.address.toLowerCase());
    m.log("Treasury.address=", TreasuryDelegator.address.toLowerCase());
    m.log("ControllerV1.address=", ControllerV1.address.toLowerCase());
    m.log("ControllerDelegator.address=", ControllerDelegator.address.toLowerCase());
    m.log("OpenLevV1.address=", OpenLevV1.address.toLowerCase());
    m.log("Reserve.address=", Reserve.address.toLowerCase());
    m.log("OLETokenLock.address=", OLETokenLock.address.toLowerCase());
    m.log("DexAggregatorV1.address=", DexAggregatorV1.address.toLowerCase());
}

function toBN(bn) {
    return web3.utils.toBN(bn);
}

function toWei(bn) {
    return web3.utils.toBN(bn).mul(toBN(1e18));
}

function encodeParameters(keys, values) {
    return web3.eth.abi.encodeParameters(keys, values);
}


