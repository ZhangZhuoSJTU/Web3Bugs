"use strict";
const {toBN, maxUint} = require("./EtheUtil");
const LPoolDelegator = artifacts.require("LPoolDelegator");
const LPool = artifacts.require('LPool');
const Controller = artifacts.require('ControllerV1');
const ControllerDelegator = artifacts.require('ControllerDelegator');
const TestToken = artifacts.require("MockERC20");
const WETH = artifacts.require("WETH");
const xOLE = artifacts.require("XOLE");
const xOLEDelegator = artifacts.require("XOLEDelegator");

const MockUniswapV2Factory = artifacts.require("MockUniswapV2Factory");
const MockUniswapV3Factory = artifacts.require("MockUniswapV3Factory");

const UniswapV2Router = artifacts.require("IUniswapV2Router");
const uniRouterV2Address_kovan = exports.uniRouterV2Address_kovan = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
const OpenLevV1Lib = artifacts.require("OpenLevV1Lib")
const OpenLevV1 = artifacts.require("OpenLevV1");
const OpenLevDelegator = artifacts.require("OpenLevDelegator");
const MockUniswapV2Pair = artifacts.require("MockUniswapV2Pair");
const MockUniswapV3Pair = artifacts.require("MockUniswapV3Pair");

const EthDexAggregator = artifacts.require("EthDexAggregatorV1");
const BscDexAggregator = artifacts.require("BscDexAggregatorV1");
const DexAggregatorDelegator = artifacts.require("DexAggregatorDelegator");

const Timelock = artifacts.require('Timelock');

const m = require('mocha-logger');
const zeroAddr = "0x0000000000000000000000000000000000000000";
exports.Uni2DexData = "0x01" + "000000" + "02";
exports.Uni3DexData = "0x02" + "000bb8" + "02";
exports.PancakeDexData = "0x03"+ "000000" + "02";

exports.createLPoolImpl = async () => {
    return await LPool.new();
}

exports.createController = async (admin, oleToken, wChainToken, xoleToken) => {
    let instance = await Controller.new();
    let controller = await ControllerDelegator.new(oleToken ? oleToken : zeroAddr,
        xoleToken ? xoleToken : zeroAddr,
        wChainToken ? wChainToken : zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        "0x01",
        admin,
        instance.address);
    return await Controller.at(controller.address);
}


exports.createUniswapV2Factory = async () => {
    return await MockUniswapV2Factory.new();
}
exports.createUniswapV3Factory = async () => {
    return await MockUniswapV3Factory.new();
}
exports.createUniswapV3Pool = async (factory, tokenA, tokenB, admin) => {
    await factory.createPool(tokenA.address, tokenB.address, 3000);
    let gotPair = await MockUniswapV3Pair.at(await factory.getPool(tokenA.address, tokenB.address, 3000));
    let token0 = await TestToken.at(await gotPair.token0());
    let token1 = await TestToken.at(await gotPair.token1());

    await gotPair.initialize(toBN(1).mul(toBN(2).pow(toBN(96))));
    await gotPair.increaseObservationCardinalityNext(3);

    await gotPair.mint(admin, toBN(-69060), 69060, toWei(100000), '0x');
    await token0.mint(gotPair.address, toWei(100000));
    await token1.mint(gotPair.address, toWei(100000));
    return gotPair;
}
exports.createEthDexAgg = async (_uniV2Factory, _uniV3Factory, admin) => {
    let delegate = await EthDexAggregator.new();
    let dexAgg = await DexAggregatorDelegator.new(_uniV2Factory ? _uniV2Factory : await this.createUniswapV2Factory(), _uniV3Factory ? _uniV3Factory : zeroAddr, admin, delegate.address);
    return await EthDexAggregator.at(dexAgg.address);
}

exports.createBscDexAgg = async (_uniV2Factory, _uniV3Factory, admin) => {
    let delegate = await BscDexAggregator.new();
    let dexAgg = await DexAggregatorDelegator.new(_uniV2Factory ? _uniV2Factory : await this.createUniswapV2Factory(), _uniV3Factory ? _uniV3Factory : zeroAddr, admin, delegate.address);
    return await BscDexAggregator.at(dexAgg.address);
}

exports.createToken = async (tokenSymbol) => {
    return await TestToken.new('Test Token: ' + tokenSymbol, tokenSymbol);
}
exports.createWETH = async () => {
    return await WETH.new();
}
exports.createPriceOracle = async () => {
    return await MockPriceOracle.new();
}
exports.createUniswapV2Pool = async (factory, tokenA, tokenB) => {
    let pair = await MockUniswapV2Pair.new(tokenA.address, tokenB.address, toWei(100000), toWei(100000));
    await factory.addPair(pair.address);
    return pair;
}
exports.tokenAt = async (address) => {
    return await TestToken.at(address);
}
exports.createOpenLev = async (controller, admin, dexAgg, xOLE, depositTokens) => {
    let openLevV1Lib = await OpenLevV1Lib.new();
    await OpenLevV1.link("OpenLevV1Lib", openLevV1Lib.address);
    let delegate = await OpenLevV1.new();
    let openLev = await OpenLevDelegator.new(
        controller,
        dexAgg ? dexAgg : zeroAddr,
        depositTokens ? depositTokens : [],
        zeroAddr,
        xOLE,
        [1,2],
        admin,
        delegate.address);
    return await OpenLevV1.at(openLev.address);
}

exports.createXOLE = async (ole, admin, dev, dexAgg, account) => {
    let delegatee = await xOLE.new();
    let xOLEInstance = await xOLEDelegator.new(ole, dexAgg, 5000, dev, admin, delegatee.address, {from: account == undefined ? admin : account});
    return xOLE.at(xOLEInstance.address);
}

exports.createTimelock = async (admin) => {
    let timeLock = await Timelock.new(admin, 180 + '');
    return timeLock;
}

exports.createPool = async (tokenSymbol, controller, admin, wethToken) => {
    let testToken = wethToken ? wethToken : await TestToken.new('Test Token: ' + tokenSymbol, tokenSymbol);
    let erc20Delegate = await LPool.new();
    let pool = await LPoolDelegator.new();
    await pool.initialize(testToken.address, wethToken ? true : false,
        controller.address,
        toBN(5e16).div(toBN(2102400)), toBN(10e16).div(toBN(2102400)), toBN(20e16).div(toBN(2102400)), 50e16 + '',
        1e18 + '',
        'TestPool',
        'TestPool',
        18,
        admin,
        erc20Delegate.address);
    return {
        'token': testToken,
        'controller': controller,
        'pool': await LPool.at(pool.address)
    };
}

exports.mint = async (token, to, amount) => {
    await token.mint(to, toBN(amount).mul(toBN(1e18)).toString());
}

exports.createUniPair_kovan = async (token0, token1, account, amount) => {
    let router = await UniswapV2Router.at(uniRouterV2Address_kovan);
    await token0.approve(uniRouterV2Address_kovan, maxUint());
    await token1.approve(uniRouterV2Address_kovan, maxUint());
    await router.addLiquidity(token0.address, token1.address, amount, amount,
        amount.div(toBN(10)), amount.div(toBN(10)), account, maxUint());
    return router;
}

let toWei = exports.toWei = (amount) => {
    return toBN(1e18).mul(toBN(amount));
}
exports.toETH = (amount) => {
    return toBN(amount).div(toBN(1e18));
}
exports.maxUint = () => {
    let max = toBN(2).pow(toBN(255));
    return max;
}
exports.last8 = function (aString) {
    if (aString != undefined && typeof aString == "string") {
        return ".." + aString.substr(aString.length - 8);
    } else {
        return aString;
    }
}
exports.firstStr = function (aString, index) {
    if (aString != undefined && typeof aString == "string") {
        return ".." + aString.substr(0, index);
    } else {
        return aString;
    }
}
exports.addressToBytes = function (address) {
    return address.substr(2);
}
exports.printBlockNum = async () => {
    m.log("Block number:", await web3.eth.getBlockNumber());
}

exports.checkAmount = (desc, expected, amountBN, decimal) => {
    let actual = amountBN.div(toBN(10 ** decimal));
    m.log(desc, ":", expected / 10 ** decimal);
    assert.equal(expected, amountBN.toString());
}

exports.assertPrint = (desc, expected, value) => {
    m.log(desc, ":", value);
    assert.equal(expected.toString(), value.toString());
}

exports.approxAssertPrint = (desc, expected, value) => {
    m.log(desc, "approx equals to:", value);
    let expectedNum = Number(expected);
    let valueNum = Number(value);
    let diff = expectedNum > valueNum ? expectedNum - valueNum : valueNum - expectedNum;
    // m.log("expectedNum", expectedNum);
    // m.log("valueNum", valueNum);
    // m.log("diff", diff);
    // m.log("diff/expectedNum", diff/expectedNum);
    assert((diff / expectedNum) < 0.00001, "Diff is too big. expectedNum=" + expectedNum + " valueNum=" + valueNum + " " +
        "diff=" + diff + " diff/expectedNum=" + diff / expectedNum);
}

let currentStep;

exports.resetStep = () => {
    currentStep = 0;
}
exports.step = (desc) => {
    currentStep++;
    m.log("STEP " + currentStep + " - " + desc);
}

function trunc(number, precision) {
    var shift = Math.pow(10, precision)
    return parseInt(number * shift) / shift
}

exports.trunc = trunc;

exports.prettyPrintBalance = function prettyPrintEther(ether) {
    var str;
    if (ether >= 1)
        str = trunc(ether, 3) + "  ether";
    else if (ether > 1e-5)
        str = trunc(ether * 1000, 3) + " finney";
    else if (ether > 1e-7)
        str = trunc(ether * 1000, 6) + " finney";
    else if (ether > 1e-12)
        str = trunc(ether * 1e12, 3) + "   gwei";
    else
        str = parseInt(web3.toWei(ether)) + "    wei";
    return str;
}

exports.now = function () {
    return parseInt(new Date().getTime().toString().substr(0, 10));
}
exports.lastBlockTime = async () => {
    let blockNum = await web3.eth.getBlockNumber();
    return (await web3.eth.getBlock(blockNum)).timestamp;
}
exports.wait = async (second) => {
    m.log("Wait for", second, "seconds");
    await new Promise((resolve => {
        setTimeout(resolve, second * 1000);
    }))
}
exports.createVoteBySigMessage = (govAddress, proposalId, support, chainId) => {
    const types = {
        EIP712Domain: [
            {name: 'name', type: 'string'},
            {name: 'chainId', type: 'uint256'},
            {name: 'verifyingContract', type: 'address'},
        ],
        Ballot: [
            {name: 'proposalId', type: 'uint256'},
            {name: 'support', type: 'bool'}
        ]
    };

    const primaryType = 'Ballot';
    const domain = {name: 'OpenLev Governor Alpha', chainId, verifyingContract: govAddress};
    support = !!support;
    const message = {proposalId, support};

    return JSON.stringify({types, primaryType, domain, message});
};

exports.initEnv = async (admin, dev) => {
    let tokenA = await this.createToken("tokenA");
    let tokenB = await this.createToken("tokenB");
    let oleToken = await this.createToken("Lvr");
    let usdt = await this.createToken("USDT");
    let controller = await this.createController(admin, oleToken.address);
    let uniswapFactory = await this.createUniswapV2Factory();
    let pair = await this.createPair(tokenA.address, tokenB.address);
    await uniswapFactory.addPair(pair.address);
    let priceOracle = await this.createPriceOracle();
    let openLev = await OpenLevDelegator.new(controller.address, uniswapFactory.address, priceOracle.address, admin);

    await controller.setOpenLev(openLev.address);
    await controller.setLPoolImplementation((await this.createLPoolImpl()).address);
    await controller.setInterestParam(5e16 + '', 10e16 + '', 20e16 + '', 50e16 + '');
    return {
        controller: controller,
        tokenA: tokenA,
        tokenB: tokenB,
        oleToken: oleToken,
        priceOracle: priceOracle,
        openLev: openLev,
        uniswapFactory: uniswapFactory,
    };
}


exports.assertThrows = async (promise, reason) => {
    try {
        await promise;
    } catch (error) {
        assert(
            error.message.search(reason) >= 0,
            'Expected throw, got \'' + error + '\' instead',
        );
        m.log("Received expected error: ", error.message);
        return;
    }
    assert.fail('Expected throw not received');
}
