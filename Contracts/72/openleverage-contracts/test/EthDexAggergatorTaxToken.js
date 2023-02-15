const utils = require("./utils/OpenLevUtil");
const TestToken = artifacts.require("MockTaxToken");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router = artifacts.require("UniswapV2Router02");
const m = require('mocha-logger');

contract("DexAggregator Eth", async accounts => {
    // components
    let weth;
    let router;
    let dexAgg;
    let token0;
    // roles
    let admin = accounts[0];
    let swapper = accounts[1];

    beforeEach(async () => {
        weth = await utils.createWETH();
        let factory = await UniswapV2Factory.new("0x0000000000000000000000000000000000000000");
        router = await UniswapV2Router.new(factory.address, weth.address);
        token0 = await TestToken.new('TokenA', 'TKA', 5, 2, router.address);

        await web3.eth.sendTransaction({from: accounts[9], to: admin, value: utils.toWei(1)});
        await token0.approve(router.address, utils.toWei(1));
        let block = await web3.eth.getBlock("latest");
        await router.addLiquidityETH(token0.address, utils.toWei(1), utils.toWei(1), utils.toWei(1), admin, block.timestamp + 60, {from: admin, value: utils.toWei(1)});

        dexAgg = await utils.createEthDexAgg(factory.address, "0x0000000000000000000000000000000000000000", accounts[0]);
        await dexAgg.setOpenLev(admin);
        let openLev = await dexAgg.openLev();

        m.log("Reset EthDexAggregator: ", dexAgg.address);
    });

    it("calulate Buy Amount weth", async () => {
        let swapIn = 1000000000000000;
        r = await dexAgg.calBuyAmount(weth.address, token0.address, 70000, 0, swapIn, utils.Uni2DexData);
        assert.equal(r.toString(), "926286492367109", "sell exact amount");
    });

    it("calulate Sell Amount token0", async () => {
        let swapOut = 1000000000000000;
        r = await dexAgg.calSellAmount(weth.address, token0.address, 70000, 0, swapOut, utils.Uni2DexData);
        assert.equal(r.toString(), "1079665260582610", "buy exact amount");
    });

    it("sell exact amount token0", async () => {
        let swapIn = 1000000000000000;
        let minOut = "926286492367109";
        await token0.transfer(swapper, swapIn);
        await token0.approve(dexAgg.address, swapIn, {from: swapper});

        r = await dexAgg.sell(weth.address, token0.address, 0, 70000, swapIn, minOut, utils.Uni2DexData, {from: swapper});
        m.log("sell exact amount Gas Used:", r.receipt.gasUsed);
        assert.equal(await weth.balanceOf(swapper), "926849117619924", "sell exact amount");
    });

    it("sell exact amount through path token0", async () => {
        let swapIn = 1000000000000000;
        let minOut = "926286492367109";
        await token0.transfer(swapper, swapIn);
        await token0.approve(dexAgg.address, swapIn, {from: swapper});

        let path = utils.Uni2DexData + token0.address.slice(2) + weth.address.slice(2);
        r = await dexAgg.sellMul(swapIn, minOut, path, {from: swapper});     
        m.log("sell exact amount through path Gas Used:", r.receipt.gasUsed);
        assert.equal(await weth.balanceOf(swapper), "926849117619924", "sell exact amount failed");
    });

    it("buy exact amount weth", async () => {
        let swapOut = 1000000000000000;
        let maxIn = "1079665260582610";
        await token0.transfer(swapper, maxIn);
        await token0.approve(dexAgg.address, maxIn, {from: swapper});

        r = await dexAgg.buy(weth.address, token0.address, 0, 70000, swapOut, maxIn, utils.Uni2DexData, {from: swapper});     
        m.log("buy exact amount Gas Used:", r.receipt.gasUsed);
        assert.equal(await weth.balanceOf(swapper), "1000000000000000", "buy exact amount");
    });

    it("calulate Buy Amount token0", async () => {
        let swapIn = 1000000000000000;
        r = await dexAgg.calBuyAmount(token0.address, weth.address, 70000, 0, swapIn, utils.Uni2DexData);
        assert.equal(r.toString(), "926286492367109", "sell exact amount");
    });

    it("calulate Sell Amount weth", async () => {
        let swapOut = 1000000000000000;
        r = await dexAgg.calSellAmount(token0.address, weth.address, 70000, 0, swapOut, utils.Uni2DexData);
        assert.equal(r.toString(), "1079665260582610", "buy exact amount");
    });

    it("sell exact amount weth", async () => {
        let swapIn = 1000000000000000;
        let minOut = "926286492367109";
        await weth.deposit({from: swapper, value: swapIn});
        await weth.approve(dexAgg.address, swapIn, {from: swapper});

        r = await dexAgg.sell(token0.address, weth.address, 70000, 0, swapIn, minOut, utils.Uni2DexData, {from: swapper});
        m.log("sell exact amount Gas Used:", r.receipt.gasUsed);
        assert.equal(await token0.balanceOf(swapper), "926286953661246", "sell exact amount");
    });

    it("sell exact amount through path weth", async () => {
        let swapIn = 1000000000000000;
        let minOut = "926286492367109";
        await weth.deposit({from: swapper, value: swapIn});
        await weth.approve(dexAgg.address, swapIn, {from: swapper});

        let path = utils.Uni2DexData + weth.address.slice(2) + token0.address.slice(2);
        r = await dexAgg.sellMul(swapIn, minOut, path, {from: swapper});     
        m.log("sell exact amount through path Gas Used:", r.receipt.gasUsed);
        assert.equal(await token0.balanceOf(swapper), "926286953661246", "sell exact amount failed");
    });

    it("buy exact amount token0", async () => {
        let swapOut = 1000000000000000;
        let maxIn = "1079665260582610";
        await weth.deposit({from: swapper, value: maxIn});
        await weth.approve(dexAgg.address, maxIn, {from: swapper});

        r = await dexAgg.buy(token0.address, weth.address, 70000, 0, swapOut, maxIn, utils.Uni2DexData, {from: swapper});     
        m.log("buy exact amount Gas Used:", r.receipt.gasUsed);
        assert.equal(await token0.balanceOf(swapper), "1000000537634698", "buy exact amount");
    });
});
