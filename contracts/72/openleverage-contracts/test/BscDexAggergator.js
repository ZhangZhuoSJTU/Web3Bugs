const utils = require("./utils/OpenLevUtil");
const {
    last8,
    checkAmount,
    printBlockNum,
    Uni2DexData,
    assertPrint, assertThrows,
} = require("./utils/OpenLevUtil");
const TestToken = artifacts.require("MockERC20");
const m = require('mocha-logger');
const {advanceMultipleBlocksAndTime, toBN} = require("./utils/EtheUtil");
const { result } = require("lodash");
const timeMachine = require('ganache-time-traveler');

contract("DexAggregator BSC", async accounts => {
    // components
    let openLev;
    let pancakeFactory;
    let pair;
    let dexAgg;
    // roles
    let admin = accounts[0];

    let token0;
    let token1;

    beforeEach(async () => {
        token0 = await TestToken.new('TokenA', 'TKA');
        token1 = await TestToken.new('TokenB', 'TKB');
        pancakeFactory = await utils.createUniswapV2Factory();
        pair = await utils.createUniswapV2Pool(pancakeFactory, token0, token1);
        dexAgg = await utils.createBscDexAgg(pancakeFactory.address, "0x0000000000000000000000000000000000000000", accounts[0]);
        await dexAgg.setOpenLev(admin);
        openLev = await dexAgg.openLev();

        m.log("Reset BscDexAggregator: ", last8(dexAgg.address));
    });

    it("setOpenLev to admin ", async () => {
        assert.equal(openLev, admin, "should be set correctly");        
    })

    it("calulate Buy Amount", async () => {
        let swapIn = 1;
        r = await dexAgg.calBuyAmount(token1.address, token0.address, 0, 0, utils.toWei(swapIn), utils.PancakeDexData);
        assert.equal(r.toString(), "997490050036750883", "sell exact amount");
    })

    it("calulate Sell Amount", async () => {
        let swapOut = 1;
        r = await dexAgg.calSellAmount(token1.address, token0.address, 0, 0, utils.toWei(swapOut), utils.PancakeDexData);
        assert.equal(r.toString(), "1002516290827068672", "buy exact amount");
    })

    it("get Price", async () => {
        r = await dexAgg.getPrice(token0.address, token1.address, utils.PancakeDexData);
        m.log(r.price, r.decimals);
        assert.equal(r.price, "1000000000000000000", "wrong token1/token0 price");
        assert.equal(r.decimals, "18", "wrong decimals");
    })

    it("sell exact amount", async () => {
        let swapIn = 1;
        let swapper = accounts[1];
        let minOut = "997490050036750883";

        await utils.mint(token0, swapper, swapIn);
        await token0.approve(dexAgg.address, utils.toWei(swapIn), {from: swapper});

        r = await dexAgg.sell(token1.address, token0.address, 0, 0, utils.toWei(swapIn), minOut, utils.PancakeDexData, {from: swapper});     
        m.log("sell exact amount Gas Used:", r.receipt.gasUsed);
        assert.equal(await token1.balanceOf(swapper), "997490050036750883", "sell exact amount");
    })

    it ("sell exact amount, but over slippage", async () =>{
        let swapIn = 1;
        let swapper = accounts[1];
        let minOut = "997990040059400208";

        await utils.mint(token0, swapper, swapIn);
        await token0.approve(dexAgg.address, utils.toWei(swapIn), {from: swapper});
        await assertThrows(dexAgg.sell(token1.address, token0.address, 0, 0, utils.toWei(swapIn), minOut, utils.PancakeDexData, {from: swapper}), 'buy amount less than min');
        assert.equal(await token1.balanceOf(swapper), "0", "sell exact amount, but failed");
    })

    it("sell exact amount through path", async () => {
        let swapIn = 1;
        let swapper = accounts[1];
        let minOut = "997490050036750883";

        await utils.mint(token0, swapper, swapIn);
        await token0.approve(dexAgg.address, utils.toWei(swapIn), {from: swapper});

        let path = utils.PancakeDexData + token0.address.slice(2) + token1.address.slice(2);
        r = await dexAgg.sellMul(utils.toWei(swapIn), minOut, path, {from: swapper});     
        m.log("sell exact amount through path Gas Used:", r.receipt.gasUsed);
        assert.equal(await token1.balanceOf(swapper), "997490050036750883", "sell exact amount failed");
    })

    it("sell exact amount through path. but over slippage", async () => {
        let swapIn = 1;
        let swapper = accounts[1];
        let minOut = "997990040059400208";
        await utils.mint(token0, swapper, swapIn);
        await token0.approve(dexAgg.address, utils.toWei(swapIn), {from: swapper});
        let path = utils.PancakeDexData + token0.address.slice(2) + token1.address.slice(2);
        await assertThrows(dexAgg.sellMul(utils.toWei(swapIn), minOut, path, {from: swapper}), 'buy amount less than min');
        assert.equal(await token1.balanceOf(swapper), "0", "sell exact amount failed");
    })

    it("buy exact amount", async () => {
        let swapOut = 1;
        let swapper = accounts[1];
        let maxIn = "1002516290827068672";

        await utils.mint(token0, swapper, 2);
        await token0.approve(dexAgg.address, maxIn, {from: swapper});

        r = await dexAgg.buy(token1.address, token0.address, 0, 0, utils.toWei(swapOut), maxIn, utils.PancakeDexData, {from: swapper});     
        m.log("buy exact amount Gas Used:", r.receipt.gasUsed);
        assert.equal(await token1.balanceOf(swapper), "1000000000000000000", "sell exact amount");
    })    

    it ("buy exact amount, but over slippage", async () =>{
        let swapOut = 1;
        let swapper = accounts[1];
        let maxIn = "1002014028156313627";

        await utils.mint(token0, swapper, 2);
        await token0.approve(dexAgg.address, maxIn, {from: swapper});
        await assertThrows(dexAgg.buy(token1.address, token0.address, 0, 0, utils.toWei(swapOut), maxIn, utils.PancakeDexData, {from: swapper}), 'sell amount not enough');
        m.log(utils.toWei(2), await token0.balanceOf(swapper));
        assert.equal(await token1.balanceOf(swapper), "0", "buy exact amount, but failed");
    })

    it("update Price Oracle and get Avg Price and get price C Avg Price H Avg Price", async() => {      
        let originalPriceData = await dexAgg.getPriceCAvgPriceHAvgPrice(token0.address, token1.address, 60, utils.PancakeDexData);
        m.log("originalPriceData: \t", JSON.stringify(originalPriceData));

        assert.equal(originalPriceData.price, "1000000000000000000", "wrong token1/token0 price");
        assert.equal(originalPriceData.hAvgPrice, "0", "wrong hAvgPrice token1/token0 price");
        assert.equal(originalPriceData.decimals, "18", "wrong decimals");
        assert.equal(originalPriceData.timestamp, "0" , "wrong timestamp");
        assert.equal(originalPriceData.cAvgPrice, "19259299", "wrong cAvgPrice token1/token0 price");

        await pair.setPriceUpdateAfter(token0.address, token1.address, "120");
        reserveData = await pair.getReserves();

        let timeWindow = 60;
        await advanceMultipleBlocksAndTime(100);
        let updatePriceOracle_tx = await dexAgg.updatePriceOracle(token0.address, token1.address, timeWindow, utils.PancakeDexData);
        m.log("updatePriceOracle Gas Used: ", updatePriceOracle_tx.receipt.gasUsed);

        await advanceMultipleBlocksAndTime(100);

        updatePriceOracle_tx  = await dexAgg.updatePriceOracle(token0.address, token1.address, timeWindow, utils.PancakeDexData);
        m.log("updatePriceOracle Gas Used: ", updatePriceOracle_tx.receipt.gasUsed);

        reserveData = await pair.getReserves();

        let updatedPriceData0 = await dexAgg.getPriceCAvgPriceHAvgPrice(token0.address, token1.address, 60, utils.PancakeDexData);
        m.log("updatedPriceData0: \t", JSON.stringify(updatedPriceData0));

        assert.equal(updatedPriceData0.price, "1200000000000000000", "wrong token1/token0 price");
        assert.equal(updatedPriceData0.cAvgPrice, "1199999999999999999", "wrong cAvgPrice token1/token0 price");
        assert.equal(updatedPriceData0.hAvgPrice, "1199999999999999999", "wrong hAvgPrice token1/token0 price");
        assert.equal(updatedPriceData0.decimals, "18", "wrong decimals");
        assert.equal(updatedPriceData0.timestamp.toString(), reserveData[2].toString(), "wrong timestamp");
    })

    it("get Avg Price", async () => {
        await pair.setPriceUpdateAfter(token0.address, token1.address, "120");
        reserveData = await pair.getReserves();
        m.log("reserveData:", reserveData.toString());

        let timeWindow = 60;
        await advanceMultipleBlocksAndTime(100);
        await dexAgg.updatePriceOracle(token0.address, token1.address, timeWindow, utils.PancakeDexData);
        await advanceMultipleBlocksAndTime(100);
        await dexAgg.updatePriceOracle(token0.address, token1.address, timeWindow, utils.PancakeDexData);

        r = await dexAgg.getAvgPrice(token0.address, token1.address, 0, utils.PancakeDexData);
        assert.equal(r.price, "1199999999999999999", "wrong token1/token0 avg price");
        assert.equal(r.decimals, "18", "wrong decimals");
        assert.equal(r.timestamp, await utils.lastBlockTime() , "wrong timestamp");
    })
});
