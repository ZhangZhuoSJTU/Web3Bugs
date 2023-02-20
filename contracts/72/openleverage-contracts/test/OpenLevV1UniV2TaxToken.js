const utils = require("./utils/OpenLevUtil");
const {Uni2DexData, assertThrows} = require("./utils/OpenLevUtil");
const {advanceMultipleBlocksAndTime, toBN} = require("./utils/EtheUtil");
const Controller = artifacts.require("ControllerV1");
const ControllerDelegator = artifacts.require("ControllerDelegator");
const OpenLevV1 = artifacts.require("OpenLevV1");
const OpenLevDelegator = artifacts.require("OpenLevDelegator");
const m = require('mocha-logger');
const LPool = artifacts.require("LPool");
const TestToken = artifacts.require("MockERC20");
const MockTaxToken = artifacts.require("MockTaxToken");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router = artifacts.require("UniswapV2Router02");
const OpenLevV1Lib = artifacts.require("OpenLevV1Lib")

// list all cases for tax token since there is no smaller unit to divide.
contract("OpenLev UniV2", async accounts => {
    // components
    let openLev;
    let ole;
    let treasury;
    let factory;
    let router;
    let gotPair;
    let dexAgg;
    let pool0;
    let poolEth;

    // roles
    let admin = accounts[0];
    let saver = accounts[1];
    let trader = accounts[2];

    let dev = accounts[3];
    let liquidator2 = accounts[8];
    let token0;
    let delegatee;
    let weth;

    let pairId = 0;

    beforeEach(async () => {
        weth = await utils.createWETH();
        ole = await TestToken.new('OpenLevERC20', 'OLE');
        // token1 = await TestToken.new('TokenB', 'TKB');
        factory = await UniswapV2Factory.new("0x0000000000000000000000000000000000000000");
        router = await UniswapV2Router.new(factory.address, weth.address);
        token0 = await MockTaxToken.new('TokenA', 'TKA', 5, 2, router.address);

        await web3.eth.sendTransaction({from: accounts[9], to: admin, value: utils.toWei(1)});
        await token0.approve(router.address, utils.toWei(1));
        let block = await web3.eth.getBlock("latest");
        await router.addLiquidityETH(token0.address, utils.toWei(1), utils.toWei(1), utils.toWei(1), admin, block.timestamp + 60, {from: admin, value: utils.toWei(1)});

        dexAgg = await utils.createEthDexAgg(factory.address, "0x0000000000000000000000000000000000000000", accounts[0]);
        xole = await utils.createXOLE(ole.address, admin, dev, dexAgg.address);

        let instance = await Controller.new();
        let controller = await ControllerDelegator.new(
            ole.address, 
            xole.address, 
            weth.address, 
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            dexAgg.address,
            "0x01",
            admin,
            instance.address);
        controller = await Controller.at(controller.address);

        openLevV1Lib = await OpenLevV1Lib.new();
        await OpenLevV1.link("OpenLevV1Lib", openLevV1Lib.address);
        delegatee = await OpenLevV1.new();
        
        openLev = await OpenLevDelegator.new(controller.address, dexAgg.address, [token0.address, weth.address], weth.address, xole.address, [1, 2], accounts[0], delegatee.address);
        openLev = await OpenLevV1.at(openLev.address);
        await openLev.setCalculateConfig(30, 33, 3000, 5, 25, 25, (30e18) + '', 300, 10, 60);
        await controller.setOpenLev(openLev.address);
        await controller.setLPoolImplementation((await utils.createLPoolImpl()).address);
        await controller.setInterestParam(toBN(90e16).div(toBN(2102400)), toBN(10e16).div(toBN(2102400)), toBN(20e16).div(toBN(2102400)), 50e16 + '');
        await dexAgg.setOpenLev(openLev.address);
        let dexData = Uni2DexData + "011170000000011170000000011170000000";
        await controller.createLPoolPair(token0.address, weth.address, 3000, dexData); // 30% margin ratio by default

        market = await openLev.markets(0);
        let pool0Address = market.pool0;
        let poolEthAddress = market.pool1;
        pool0 = await LPool.at(pool0Address);
        poolEth = await LPool.at(poolEthAddress);

        await token0.approve(pool0.address, utils.toWei(1));
        await pool0.mint(utils.toWei(1));
        await poolEth.mintEth({from: saver, value: utils.toWei(1)});

        await token0.transfer(trader, utils.toWei(1));
        await token0.approve(openLev.address, utils.toWei(1), {from: trader});

        await advanceMultipleBlocksAndTime(30);
    });

    it("should long token0 with deposit token0 and closed properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17832);
        assert.equal(marginRatio.hAvg.toString(), 17777);

        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });
    
    it("should long token0 with deposit token0 and liquidate properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(5e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '172704135202825');
        assert.equal(market.pool0Insurance, '3742693820334');
    });

    it("should long token0 with deposit token0 and liquidate with insurance properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '3742693820334');
    });

    it("should long token0 with deposit eth and closed properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17815);
        assert.equal(marginRatio.hAvg.toString(), 17650);
        
        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());
        
        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, 0, 0, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

         m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit eth and liquidate properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- update price...");
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(5e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        
        m.log("-- liquidate with deposit return");
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '106250907452217');
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    it("should long token0 with deposit eth and liquidate with insurance properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    // ------------------------------------------6---------------------------------------------

    it("should short token0 with deposit token0 and closed properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 15870);
        assert.equal(marginRatio.hAvg.toString(), 15737);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit token0 and liquidate properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(4e17)});
        await weth.transfer(uniswapV2Pair, toBN(4e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, "26416496606265");
        assert.equal(market.pool0Insurance, '1910700460350');
    });

    it("should short token0 with deposit token0 and liquidate with insurance properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal( market.pool0Insurance, 0);
    });

    it("should short token0 with deposit eth and closed properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 18579);
        assert.equal(marginRatio.hAvg.toString(), 18530);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit eth and liquidate properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(5e17)});
        await weth.transfer(uniswapV2Pair, toBN(5e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, "55699940539392");
        assert.equal(market.pool1Insurance, '3817465321438');
    });

    it("should short token0 with deposit eth and liquidate with insurance properly", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool1Insurance, "3817465321438");
    });

    // ------------------------------------------12--------------------------------------------

    it("should long token0 with deposit token0 and closed properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9939);
        assert.equal(marginRatio.hAvg.toString(), 9900);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19929);
        assert.equal(marginRatio.hAvg.toString(), 19870);

        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit token0 and liquidate properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9939);
        assert.equal(marginRatio.hAvg.toString(), 9900);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(7e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '91903272451548');
        assert.equal(market.pool0Insurance, '3950106913211');
    });

    it("should long token0 with deposit token0 and liquidate with insurance properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9939);
        assert.equal(marginRatio.hAvg.toString(), 9900);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '3950106913211');
    });

    it("should long token0 with deposit eth and closed properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 9919);
        assert.equal(marginRatio.hAvg.toString(), 9840);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19909);
        assert.equal(marginRatio.hAvg.toString(), 19731);
        
        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());
        
        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, 0, 0, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

         m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit eth and liquidate properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 9919);
        assert.equal(marginRatio.hAvg.toString(), 9840);

        m.log("-- update price...");
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(7e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        
        m.log("-- liquidate with deposit return");
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '49580886375853');
        assert.equal(market.pool0Insurance, '1964232889659');
    });

    it("should long token0 with deposit eth and liquidate with insurance properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 9919);
        assert.equal(marginRatio.hAvg.toString(), 9840);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '1964232889659');
    });

    // ------------------------------------------18--------------------------------------------

    it("should short token0 with deposit token0 and closed properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8532);
        assert.equal(marginRatio.hAvg.toString(), 8464);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17824);
        assert.equal(marginRatio.hAvg.toString(), 17670);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit token0 and liquidate properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8532);
        assert.equal(marginRatio.hAvg.toString(), 8464);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(6e17)});
        await weth.transfer(uniswapV2Pair, toBN(6e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, "114675194432980");
        assert.equal(market.pool0Insurance, '1980000000000');
    });

    it("should short token0 with deposit token0 and liquidate with insurance properly and sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8532);
        assert.equal(marginRatio.hAvg.toString(), 8464);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, 0);
    });

    it("should short token0 with deposit eth and closed properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9244);
        assert.equal(marginRatio.hAvg.toString(), 9208);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19232);
        assert.equal(marginRatio.hAvg.toString(), 19178);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit eth and liquidate properly with sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9244);
        assert.equal(marginRatio.hAvg.toString(), 9208);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(5e17)});
        await weth.transfer(uniswapV2Pair, toBN(5e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '353730801360290');
        assert.equal( market.pool1Insurance, '3881640626443');
    });

    it("should short token0 with deposit eth and liquidate with insurance properly and sell tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapBuyTaxFeePercent(0);
        await token0.setUniswapBuyLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 2, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9244);
        assert.equal(marginRatio.hAvg.toString(), 9208);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool1Insurance, "3881640626443");
    });
    
    // ------------------------------------------24--------------------------------------------

    it("should long token0 with deposit token0 and closed properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9241);
        assert.equal(marginRatio.hAvg.toString(), 9202);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19231);
        assert.equal(marginRatio.hAvg.toString(), 19172);

        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit token0 and liquidate properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9241);
        assert.equal(marginRatio.hAvg.toString(), 9202);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(7e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '152754332103553');
        assert.equal(market.pool0Insurance, '3881084577009');
    });

    it("should long token0 with deposit token0 and liquidate with insurance properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9241);
        assert.equal(marginRatio.hAvg.toString(), 9202);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '3881084577009');
    });

    it("should long token0 with deposit eth and closed properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17815);
        assert.equal(marginRatio.hAvg.toString(), 17650);
        
        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());
        
        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, 0, 0, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

         m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit eth and liquidate properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- update price...");
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(7e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        
        m.log("-- liquidate with deposit return");
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '48623988246043');
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    it("should long token0 with deposit eth and liquidate with insurance properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    // ------------------------------------------30---------------------------------------------

    it("should short token0 with deposit token0 and closed properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9919);
        assert.equal(marginRatio.hAvg.toString(), 9840);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19909);
        assert.equal(marginRatio.hAvg.toString(), 19731);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit token0 and liquidate properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9919);
        assert.equal(marginRatio.hAvg.toString(), 9840);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(6e17)});
        await weth.transfer(uniswapV2Pair, toBN(6e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '114079673773085');
        assert.equal(market.pool0Insurance, '1980000000000');
    });

    it("should short token0 with deposit token0 and liquidate with insurance properly and buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9919);
        assert.equal(marginRatio.hAvg.toString(), 9840);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, 0);
    });

    it("should short token0 with deposit eth and closed properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9939);
        assert.equal(marginRatio.hAvg.toString(), 9900);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19929);
        assert.equal(marginRatio.hAvg.toString(), 19870);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit eth and liquidate properly with buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9939);
        assert.equal(marginRatio.hAvg.toString(), 9900);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(7e17)});
        await weth.transfer(uniswapV2Pair, toBN(7e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '91764604447966');
        assert.equal( market.pool1Insurance, '3950106911229');
    });
    
    it("should short token0 with deposit eth and liquidate with insurance properly and buy tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9939);
        assert.equal(marginRatio.hAvg.toString(), 9900);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool1Insurance, "3950106911229");
    });

    // ------------------------------------------36---------------------------------------------

    it("should long token0 with deposit token0 and closed properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9241);
        assert.equal(marginRatio.hAvg.toString(), 9202);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19231);
        assert.equal(marginRatio.hAvg.toString(), 19172);

        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit token0 and liquidate properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9241);
        assert.equal(marginRatio.hAvg.toString(), 9202);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(7e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '24483950940285');
        assert.equal(market.pool0Insurance, '3881084577009');
    });

    it("should long token0 with deposit token0 and liquidate with insurance properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9241);
        assert.equal(marginRatio.hAvg.toString(), 9202);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '3881084577009');
    });

    it("should long token0 with deposit eth and closed properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17815);
        assert.equal(marginRatio.hAvg.toString(), 17650);
        
        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());
        
        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, 0, 0, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

         m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit eth and liquidate properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- update price...");
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(7e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        
        m.log("-- liquidate with deposit return");
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '48623988246043');
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    it("should long token0 with deposit eth and liquidate with insurance properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.setUniswapSellTaxFeePercent(0);
        await token0.setUniswapSellLiquidityFeePercent(0);
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);
        await openLev.setTaxRate(pairId, token0.address, 1, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    // ------------------------------------------42---------------------------------------------

    it("should short token0 with deposit token0 and closed properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8532);
        assert.equal(marginRatio.hAvg.toString(), 8464);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17824);
        assert.equal(marginRatio.hAvg.toString(), 17670);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit token0 and liquidate properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8532);
        assert.equal(marginRatio.hAvg.toString(), 8464);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(6e17)});
        await weth.transfer(uniswapV2Pair, toBN(6e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '36646561727879');
        assert.equal(market.pool0Insurance, '1980000000000');
    });

    it("should short token0 with deposit token0 and liquidate with insurance properly and uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8532);
        assert.equal(marginRatio.hAvg.toString(), 8464);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, 0);
    });

    it("should short token0 with deposit eth and closed properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9244);
        assert.equal(marginRatio.hAvg.toString(), 9208);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 19232);
        assert.equal(marginRatio.hAvg.toString(), 19178);

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit eth and liquidate properly with uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9244);
        assert.equal(marginRatio.hAvg.toString(), 9208);

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(7e17)});
        await weth.transfer(uniswapV2Pair, toBN(7e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '24686969231944');
        assert.equal( market.pool1Insurance, '3881640626443');
    });

    it("should short token0 with deposit eth and liquidate with insurance properly and uni tax only", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- config tax...")
        await token0.excludeFromFee(pool0.address);
        await token0.excludeFromFee(trader);
        await openLev.setTaxRate(pairId, token0.address, 0, 0);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 9244);
        assert.equal(marginRatio.hAvg.toString(), 9208);
        
        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool1Insurance, "3881640626443");
    });

    // ------------------------------------------48---------------------------------------------

    it("should long token0 with deposit token0 and closed properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17832);
        assert.equal(marginRatio.hAvg.toString(), 17777);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });
    
    it("should long token0 with deposit token0 and liquidate properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(5e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '172703413630546');
        assert.equal(market.pool0Insurance, '3742693820334');
    });

    it("should long token0 with deposit token0 and liquidate with insurance properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '3742693820334');
    });

    it("should long token0 with deposit eth and closed properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17815);
        assert.equal(marginRatio.hAvg.toString(), 17650);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());
        
        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());
        
        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, 0, 0, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

         m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit eth and liquidate properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...");
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(5e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        
        m.log("-- liquidate with deposit return");
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '106250459757314');
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    it("should long token0 with deposit eth and liquidate with insurance properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    // ------------------------------------------54---------------------------------------------

    it("should short token0 with deposit token0 and closed properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 15870);
        assert.equal(marginRatio.hAvg.toString(), 15737);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- close trade partial...");
        await assertThrows(openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader}));
        await openLev.setTaxRate(pairId, token0.address, 0, 100000);
        await openLev.setTaxRate(pairId, token0.address, 1, 100000);
        await openLev.setTaxRate(pairId, token0.address, 2, 100000);
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit token0 and liquidate properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(4e17)});
        await weth.transfer(uniswapV2Pair, toBN(4e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '26416036251689');
        assert.equal(market.pool0Insurance, '1910700460350');
    });

    it("should short token0 with deposit token0 and liquidate with insurance properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal( market.pool0Insurance, 0);
    });

    it("should short token0 with deposit eth and closed properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 18579);
        assert.equal(marginRatio.hAvg.toString(), 18530);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- close trade partial...");
        await assertThrows(openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader}));
        await openLev.setTaxRate(pairId, token0.address, 0, 100000);
        await openLev.setTaxRate(pairId, token0.address, 1, 100000);
        await openLev.setTaxRate(pairId, token0.address, 2, 100000);
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit eth and liquidate properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(5e17)});
        await weth.transfer(uniswapV2Pair, toBN(5e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        // assert.equal(liquidationTx.logs[0].args.depositReturn, 55700357469250);
        assert.equal( market.pool1Insurance, '3817465321438');
    });

    it("should short token0 with deposit eth and liquidate with insurance properly tax increase after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(8);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool1Insurance, "3817465321438");
    });

    // ------------------------------------------60---------------------------------------------

    it("should long token0 with deposit token0 and closed properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17832);
        assert.equal(marginRatio.hAvg.toString(), 17777);

        m.log("-- tax cut...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });
    
    it("should long token0 with deposit token0 and liquidate properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(5e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '172703461513560');
        assert.equal(market.pool0Insurance, '3742693820334');
    });

    it("should long token0 with deposit token0 and liquidate with insurance properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8541);
        assert.equal(marginRatio.hAvg.toString(), 8504);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '3742693820334');
    });

    it("should long token0 with deposit eth and closed properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, false, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 17815);
        assert.equal(marginRatio.hAvg.toString(), 17650);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());
        
        m.log("-- update reward...");
        await token0.transfer(openLev.address, toBN(5e17));
        let tradeAfterUpdateReward = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("tradeAfterUpdateReward.held:", tradeAfterUpdateReward.held);
        m.log("balance:", balance)
        assert.equal(trade.held.toString(), tradeAfterUpdateReward.held.toString());
        
        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, false, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, 0, 0, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

         m.log("-- close trade all...");
        await openLev.closeTrade(pairId, false, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should long token0 with deposit eth and liquidate properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...");
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(5e17));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        
        m.log("-- liquidate with deposit return");
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '106250492365891');
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    it("should long token0 with deposit eth and liquidate with insurance properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, false, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 0);
        let balance = await token0.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance);
        assert.equal(marginRatio.current.toString(), 8525);
        assert.equal(marginRatio.hAvg.toString(), 8451);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await token0.transfer(uniswapV2Pair, toBN(1e18));
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, 0, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 0);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool0Insurance, '1826738399574');
    });

    // ------------------------------------------66---------------------------------------------

    it("should short token0 with deposit token0 and closed properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, false, deposit, 0, 0, Uni2DexData, {from: trader});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 15870);
        assert.equal(marginRatio.hAvg.toString(), 15737);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), 0, Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, 0, Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit token0 and liquidate properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(4e17)});
        await weth.transfer(uniswapV2Pair, toBN(4e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, '26416036251689');
        assert.equal(market.pool0Insurance, '1910700460350');
    });

    it("should short token0 with deposit token0 and liquidate with insurance properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, false, deposit, borrow, 0, Uni2DexData, {from: trader});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 7231);
        assert.equal(marginRatio.hAvg.toString(), 7172);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool0Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal( market.pool0Insurance, 0);
    });

    it("should short token0 with deposit eth and closed properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- margin trade again...")
        await openLev.marginTrade(pairId, true, true, 0, 0, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        trade = await openLev.activeTrades(trader, pairId, 1);
        balance = await weth.balanceOf(openLev.address);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 18579);
        assert.equal(marginRatio.hAvg.toString(), 18530);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- close trade partial...");
        await openLev.closeTrade(pairId, true, toBN(Math.floor(trade.held / 2)), utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData03 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterClose = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData03: \t", JSON.stringify(PriceData03));
        m.log("tradeAfterClose.held:", tradeAfterClose.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterClose.held.toString(), toBN(Math.ceil(trade.held / 2)).toString());

        m.log("-- close trade all...");
        await openLev.closeTrade(pairId, true, tradeAfterClose.held, utils.maxUint(), Uni2DexData, {from: trader});
        let PriceData04 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let tradeAfterCloseAlls = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        m.log("PriceData04: \t", JSON.stringify(PriceData04));
        m.log("tradeAfterCloseAlls.held:", tradeAfterCloseAlls.held);
        m.log("balance:", balance);
        assert.equal(tradeAfterCloseAlls.held.toString(), 0);
    });

    it("should short token0 with deposit eth and liquidate properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(5e17)});
        await weth.transfer(uniswapV2Pair, toBN(5e17), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with deposit return")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, "55699195148487");
        assert.equal( market.pool1Insurance, '3817465321438');
    });

    it("should short token0 with deposit eth and liquidate with insurance properly tax cut after deposit", async() =>{
        let deposit = toBN(1e15);
        let borrow = toBN(1e15);

        m.log("-- margin trade...")
        await openLev.marginTrade(pairId, true, true, 0, borrow, 0, Uni2DexData, {from: trader, value: deposit});
        let PriceData01 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        let marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        let trade = await openLev.activeTrades(trader, pairId, 1);
        let balance = await weth.balanceOf(openLev.address);
        m.log("PriceData01: \t", JSON.stringify(PriceData01));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");
        m.log("Trade.held:", trade.held);
        m.log("balance:", balance)
        assert.equal(marginRatio.current.toString(), 8592);
        assert.equal(marginRatio.hAvg.toString(), 8560);

        m.log("-- tax increase...")
        await token0.setTaxFeePercent(3);
        m.log("tax updated to: ", await token0._taxFee());

        m.log("-- update price...")
        let uniswapV2Pair = await token0.uniswapV2Pair();
        await weth.deposit({from: accounts[9], value: toBN(1e18)});
        await weth.transfer(uniswapV2Pair, toBN(1e18), {from: accounts[9]});
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        await advanceMultipleBlocksAndTime(30);
        await openLev.updatePrice(pairId, Uni2DexData);
        let PriceData02 = await dexAgg.getPriceCAvgPriceHAvgPrice(weth.address, token0.address, 60, Uni2DexData);
        marginRatio = await openLev.marginRatio(trader, pairId, 1, Uni2DexData);
        m.log("PriceData02: \t", JSON.stringify(PriceData02));
        m.log("Margin Ratio current:", marginRatio.current / 100, "%");
        m.log("Margin Ratio cAvg:", marginRatio.cAvg / 100, "%");
        m.log("Margin Ratio hAvg:", marginRatio.hAvg / 100, "%");

        m.log("-- liquidate with insurance")
        let liquidationTx = await openLev.liquidate(trader, pairId, true, 0, utils.maxUint(), Uni2DexData, {from: liquidator2});
        marginRatio = await openLev.marginRatio(trader, pairId, 0, Uni2DexData);
        let tradeAfterLiquidate = await openLev.activeTrades(trader, pairId, 1);
        balance = await token0.balanceOf(openLev.address);
        let market = await openLev.markets(pairId);
        m.log("deposit return:", liquidationTx.logs[0].args.depositReturn);
        m.log("tradeAfterLiquidate.held:", tradeAfterLiquidate.held);
        m.log("balance:", balance);
        m.log("insurance", market.pool1Insurance);
        assert.equal(tradeAfterLiquidate.held.toString(), 0);
        assert.equal(liquidationTx.logs[0].args.depositReturn, 0);
        assert.equal(market.pool1Insurance, "3817465321438");
    });

    // ------------------------------------------72---------------------------------------------
})