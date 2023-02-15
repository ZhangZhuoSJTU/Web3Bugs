const OLEToken = artifacts.require("OLEToken");
const xOLE = artifacts.require("XOLE");
const xOLEDelegator = artifacts.require("XOLEDelegator");
const EthDexAggregatorV1 = artifacts.require("EthDexAggregatorV1");
const BscDexAggregatorV1 = artifacts.require("BscDexAggregatorV1");
const DexAggregatorDelegator = artifacts.require("DexAggregatorDelegator");
const Gov = artifacts.require("GovernorAlpha");
const Timelock = artifacts.require("Timelock");
const ControllerV1 = artifacts.require("ControllerV1");
const ControllerDelegator = artifacts.require("ControllerDelegator");
const LPool = artifacts.require("LPool");
const OpenLevV1 = artifacts.require("OpenLevV1");
const OpenLevV1Lib = artifacts.require("OpenLevV1Lib");
const OpenLevDelegator = artifacts.require("OpenLevDelegator");
const Airdrop = artifacts.require("Airdrop");
const LPoolDepositor = artifacts.require("LPoolDepositor");
const Reserve = artifacts.require("Reserve");
const utils = require("./util");
const m = require('mocha-logger');

module.exports = async function (deployer, network, accounts) {
    if (utils.isSkip(network)) {
        return;
    }
    let adminAccount = accounts[0];
    let dev = accounts[0];
    let weth9 = utils.getWChainToken(network);
    //timeLock
    await deployer.deploy(Timelock, adminAccount, (3 * 60) + "", utils.deployOption(accounts));
    let adminCtr = Timelock.address;
    //ole
    await deployer.deploy(OLEToken, adminAccount, adminCtr, utils.tokenName(network), utils.tokenSymbol(network), utils.deployOption(accounts));
    //airdrop
    await deployer.deploy(Airdrop, OLEToken.address, utils.deployOption(accounts));
    //dexAgg
    switch (network) {
        case utils.kovan:
        case utils.mainnet:
            await deployer.deploy(EthDexAggregatorV1, utils.deployOption(accounts));
            await deployer.deploy(DexAggregatorDelegator, utils.uniswapV2Address(network), utils.uniswapV3Address(network), adminCtr, EthDexAggregatorV1.address, utils.deployOption(accounts));
            break;
        case utils.bscIntegrationTest:
        case utils.bscTestnet:
            await deployer.deploy(BscDexAggregatorV1, utils.deployOption(accounts));
            await deployer.deploy(DexAggregatorDelegator, utils.uniswapV2Address(network), utils.uniswapV3Address(network), adminCtr, BscDexAggregatorV1.address, utils.deployOption(accounts));
            break;
        default:
            m.error("unkown network");
            return
    }

    //xole
    await deployer.deploy(xOLE, utils.deployOption(accounts));
    await deployer.deploy(xOLEDelegator, OLEToken.address, DexAggregatorDelegator.address, 3000, dev, adminCtr, xOLE.address, utils.deployOption(accounts));
    //gov
    await deployer.deploy(Gov, Timelock.address, xOLEDelegator.address, adminAccount, utils.deployOption(accounts));
    //reserve
    await deployer.deploy(Reserve, adminCtr, OLEToken.address, utils.deployOption(accounts));
    //controller
    await deployer.deploy(LPool, utils.deployOption(accounts));
    await deployer.deploy(ControllerV1, utils.deployOption(accounts));
    switch (network) {
        case utils.bscIntegrationTest:
        case utils.bscTestnet:
            await deployer.deploy(ControllerDelegator, OLEToken.address, xOLEDelegator.address, weth9, LPool.address, utils.zeroAddress, DexAggregatorDelegator.address, '0x03', adminCtr, ControllerV1.address, utils.deployOption(accounts));
            break;
        default:
            await deployer.deploy(ControllerDelegator, OLEToken.address, xOLEDelegator.address, weth9, LPool.address, utils.zeroAddress, DexAggregatorDelegator.address, '0x02000bb8', adminCtr, ControllerV1.address, utils.deployOption(accounts));
    }
    //openLev
    await deployer.deploy(OpenLevV1Lib);
    await deployer.link(OpenLevV1Lib, OpenLevV1);
    await deployer.deploy(OpenLevV1, utils.deployOption(accounts));
    switch (network) {
        case utils.bscIntegrationTest:
        case utils.bscTestnet:
            await deployer.deploy(OpenLevDelegator, ControllerDelegator.address, DexAggregatorDelegator.address, utils.getDepositTokens(network), weth9, xOLEDelegator.address, [3], adminCtr, OpenLevV1.address, utils.deployOption(accounts));
            break;
        default:
            await deployer.deploy(OpenLevDelegator, ControllerDelegator.address, DexAggregatorDelegator.address, utils.getDepositTokens(network), weth9, xOLEDelegator.address, [1, 2], adminCtr, OpenLevV1.address, utils.deployOption(accounts));
    }
    //lpoolDepositor
    await deployer.deploy(LPoolDepositor, utils.deployOption(accounts));
    //set openLev address
    m.log("Waiting controller setOpenLev......");
    await (await Timelock.at(Timelock.address)).executeTransaction(ControllerDelegator.address, 0, 'setOpenLev(address)', encodeParameters(['address'], [OpenLevDelegator.address]), 0);
    m.log("Waiting dexAgg setOpenLev......");
    await (await Timelock.at(Timelock.address)).executeTransaction(DexAggregatorDelegator.address, 0, 'setOpenLev(address)', encodeParameters(['address'], [OpenLevDelegator.address]), 0);
};

function encodeParameters(keys, values) {
    return web3.eth.abi.encodeParameters(keys, values);
}

function toWei(bn) {
    return web3.utils.toBN(bn).mul(web3.utils.toBN(1e18));
}


