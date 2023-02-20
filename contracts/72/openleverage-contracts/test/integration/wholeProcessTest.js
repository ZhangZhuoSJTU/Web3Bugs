const {toBN, maxUint} = require("../utils/EtheUtil");
const utils = require("../utils/OpenLevUtil");
const m = require('mocha-logger');


const OpenLevV1 = artifacts.require("OpenLevDelegator");
const LPool = artifacts.require("LPool");
const MockERC20 = artifacts.require("MockERC20");
const Controller = artifacts.require("ControllerDelegator");
const XOLE = artifacts.require("XOLEDelegator");

let network;
contract("OpenLev integration test ", async accounts => {

  before(async () => {
    network = process.env.NETWORK
  });
  it("trade test", async () => {
    if (network != 'integrationTest') {
      console.log("Ignore swap test")
      return;
    }

    console.log("starting....");
    let marketId = 7;
    let developer = accounts[0];
    let openLev = await OpenLevV1.at(OpenLevV1.address);
    let controller = await Controller.at(Controller.address);
    let treasury = await XOLE.at(XOLE.address);
    let markets = await openLev.markets(marketId);
    let pool0 = await LPool.at(markets.pool0);
    let pool1 = await LPool.at(markets.pool1);
    //
    let token0 = await MockERC20.at(await pool0.underlying());
    let token1 = await MockERC20.at(await pool1.underlying());
    //
    m.log("openLev=", openLev.address);
    m.log("controller=", controller.address);
    m.log("treasury=", treasury.address);
    m.log("pool0=", pool0.address);
    m.log("pool1=", pool1.address);
    m.log("token0=", token0.address);
    m.log("token1=", token1.address);
    token0.mint(accounts[0], await utils.toWei(1000));
    token1.mint(accounts[0], await utils.toWei(1000));
    let uniV2 = "0x01";
    /**
     * lpool supply
     */
    // let rewardStartByBorrow = await controller.earned(pool1.address, developer, true);
    // let rewardStartBySupply = await controller.earned(pool1.address, developer, false);

    utils.resetStep();
    utils.step("lpool supply");
    await token1.approve(pool1.address, maxUint());
    let pool1BalanceBeforeSupply = await token1.balanceOf(pool1.address);
    m.log("pool1BalanceBeforeSupply=", pool1BalanceBeforeSupply.toString());
    let supplyAmount = await utils.toWei(10);
    await pool1.mint(supplyAmount);
    let pool1BalanceAfterSupply = await token1.balanceOf(pool1.address);
    m.log("pool1BalanceAfterSupply=", pool1BalanceAfterSupply.toString());
    assert.equal(pool1BalanceAfterSupply.sub(pool1BalanceBeforeSupply).toString(), supplyAmount.toString());
    while (await openLev.shouldUpdatePrice(marketId, uniV2) == true) {
      m.log("update price...");
      await openLev.updatePrice(marketId, uniV2);
    }
    utils.step("openLev open margin trade 1");
    let deposit = await utils.toWei(10);
    let borrow = await utils.toWei(2);
    await token0.approve(openLev.address, maxUint());
    await token1.approve(openLev.address, maxUint());

    await openLev.marginTrade(marketId, false, false, deposit, borrow, 0, uniV2);
    let activeTrade1 = await openLev.activeTrades(developer, marketId, false);
    m.log("open trades1=", JSON.stringify(activeTrade1));
    /**
     * openLev open margin trade 2
     */
    utils.step("openLev open margin trade 2");
    await openLev.marginTrade(marketId, false, false, deposit, borrow, 0, uniV2);
    let activeTrade2 = await openLev.activeTrades(developer, marketId, false);
    m.log("open trades1=", JSON.stringify(activeTrade2));
    // let rewardAfterByBorrow = await controller.earned(pool1.address, developer, true);
    /**
     * openLev close margin trade half
     */
    utils.step("openLev close margin trade half");
    let borrowsBeforeClose = await pool1.borrowBalanceStored(developer);
    let treasuryBeforeClose = await token0.balanceOf(treasury.address);
    await openLev.closeTrade(marketId, false, toBN(activeTrade2[1]).div(toBN(2)), 0, uniV2);
    let closeTrade = await openLev.activeTrades(developer, marketId, false);
    m.log("close trades=", JSON.stringify(closeTrade));
    let borrowsAfterClose = await pool1.borrowBalanceStored(developer);
    let treasuryAfterClose = await token0.balanceOf(treasury.address);
    m.log("borrowsBeforeClose=", borrowsBeforeClose.toString());
    m.log("borrowsAfterClose=", borrowsAfterClose.toString());
    m.log("treasuryBeforeClose=", treasuryBeforeClose.toString());
    m.log("treasuryAfterClose=", treasuryAfterClose.toString());

    utils.step("checking borrows and treasury after closed...");
    assert.equal(toBN(borrowsBeforeClose).cmp(toBN(borrowsAfterClose)) > 0, true);
    assert.equal(toBN(treasuryAfterClose).cmp(toBN(treasuryBeforeClose)) > 0, true);

    /**
     * supply & lender OLE reward
     */
    // let rewardAfterBySupply = await controller.earned(pool1.address, developer, false);
    //
    // m.log("rewardStartByBorrow=", rewardStartByBorrow.toString());
    // m.log("rewardAfterByBorrow=", rewardAfterByBorrow.toString());
    // m.log("rewardStartBySupply=", rewardStartBySupply.toString());
    // m.log("rewardAfterBySupply=", rewardAfterBySupply.toString());

    // utils.step("checking borrow & supply OLE rewards...");
    // assert.equal(toBN(rewardAfterByBorrow).cmp(toBN(rewardStartByBorrow)) > 0, true);
    // assert.equal(toBN(rewardAfterBySupply).cmp(toBN(rewardStartBySupply)) > 0, true);

    utils.step("ending...");

  })
})
