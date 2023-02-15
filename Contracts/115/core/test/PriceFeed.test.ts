import {
  MockWETHInstance,
  MockChainlinkAggregatorInstance,
  PriceFeedInstance,
  AccessControllerInstance,
  AddressProviderInstance,
} from "../types/truffle-contracts";
import { expect } from "chai";
import { constants } from "./utils/helpers";

const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");

const WETH = artifacts.require("MockWETH");
const MockERC20 = artifacts.require("MockERC20");
const PAR = artifacts.require("PAR");
const MockChainlinkAggregator = artifacts.require("MockChainlinkAggregator");
const AccessController = artifacts.require("AccessController");
const PriceFeed = artifacts.require("PriceFeed");
const AddressProvider = artifacts.require("AddressProvider");

const EUR_PRICE = 118033500; // 1 EUR = 1.18 USD
const WETH_PRICE = 44067433087; // 440 USD

contract("PriceFeed", (accounts) => {
  const [owner, other] = accounts;

  let weth: MockWETHInstance;
  let aggregator: MockChainlinkAggregatorInstance;
  let aggregatorEUR: MockChainlinkAggregatorInstance;
  let controller: AccessControllerInstance;
  let feed: PriceFeedInstance;
  let a: AddressProviderInstance;
  let latestTime: BN;

  before(async () => {
    latestTime = await time.latest();
    weth = await WETH.new();
    aggregator = await MockChainlinkAggregator.new(8, WETH_PRICE, "ETH / USD");
    aggregatorEUR = await MockChainlinkAggregator.new(8, EUR_PRICE, "EUR / USD");
    controller = await AccessController.new();
    a = await AddressProvider.new(controller.address);
    feed = await PriceFeed.new(a.address);
    const par = await PAR.new(a.address);

    await a.setStableX(par.address);
    await aggregator.setUpdatedAt(latestTime);
    await aggregatorEUR.setUpdatedAt(latestTime);
  });

  it("Access controller initializes correctly", async () => {
    const ownerIsAdmin = await controller.hasRole(constants.DEFAULT_ADMIN_ROLE, owner);
    expect(ownerIsAdmin).to.equal(true);

    const managerRole = await controller.MANAGER_ROLE();
    const ownerIsManager = await controller.hasRole(managerRole, owner);
    expect(ownerIsManager).to.equal(true);
  });

  it("Feed initializes correctly", async () => {
    const controllerAddress = await a.controller();
    const feedController = await AccessController.at(controllerAddress);
    const managerRole = await feedController.MANAGER_ROLE();
    const ownerIsFeedManager = await feedController.hasRole(managerRole, owner);
    expect(ownerIsFeedManager).to.equal(true);
  });

  it("Aggregator initializes correctly", async () => {
    const description = await aggregator.description();
    expect(description).to.equal("ETH / USD");

    const decimals = await aggregator.decimals();
    assert.equal(decimals.toString(), "8");
  });

  it("Non-feed managers cannot add oracles", async () => {
    await expectRevert(
      feed.setAssetOracle(weth.address, aggregator.address, { from: other }),
      "Caller is not a Manager",
    );
  });

  it("Feed manager can add oracles", async () => {
    const txReceipt = await feed.setAssetOracle(weth.address, aggregator.address, { from: owner });
    expectEvent(txReceipt, "OracleUpdated", {
      asset: weth.address,
      oracle: aggregator.address,
      sender: owner,
    });
    const oracleAddress = await feed.assetOracles(weth.address);
    expect(oracleAddress).to.equal(aggregator.address);

    const eurOracleReceipt = await feed.setEurOracle(aggregatorEUR.address, { from: owner });
    expectEvent(eurOracleReceipt, "EurOracleUpdated", {
      oracle: aggregatorEUR.address,
      sender: owner,
    });

    const eurOracleAddress = await feed.eurOracle();
    expect(eurOracleAddress).to.equal(aggregatorEUR.address);
  });

  it("Price feed returns data", async () => {
    const data = await aggregator.latestRoundData();
    expect(data[1].toString()).to.equal("44067433087");

    const dataEur = await aggregatorEUR.latestRoundData();
    expect(dataEur[1].toString()).to.equal("118033500");

    const answer = await feed.getAssetPrice(weth.address);
    expect(answer.toString()).to.equal("37334683023"); // 373.346830239 EUR
  });

  it("should revert when the aggregater return stale data", async () => {
    await aggregator.setUpdatedAt(0);
    await expectRevert(feed.getAssetPrice(weth.address), "Price data is stale");
  });

  it("should revert when the EUR aggregater return stale data", async () => {
    await aggregatorEUR.setUpdatedAt(0);
    await expectRevert(feed.getAssetPrice(weth.address), "EUR price data is stale");
  });

  it("should convert stablecoin to collateral", async () => {
    await aggregator.setUpdatedAt(latestTime);
    await aggregatorEUR.setUpdatedAt(latestTime);
    await aggregator.setLatestPrice(String(400e8)); // 1 ETH = 400 USD
    await aggregatorEUR.setLatestPrice(String(1e8)); // 1 USD = 1 EUR

    const result = await feed.convertTo(weth.address, String(100e18)); // 100 PAR

    expect(result.toString()).to.equal(String(25e16)); // 100 PAR / 400 = 0.25 ETH
  });

  it("should convert collateral to stablecoin", async () => {
    await aggregator.setLatestPrice(String(400e8)); // 1 ETH = 400 USD
    await aggregatorEUR.setLatestPrice(String(1e8)); // 1 USD = 1 EUR

    const result = await feed.convertFrom(weth.address, String(1e18)); // 100 ETH

    expect(result.toString()).to.equal(String(400e18)); // 100 PAR / 400 = 0.25 ETH
  });

  // Value out-of-bounds
  it.skip("should prevent overflow errors when the aggregater returns a negative answer", async () => {
    await aggregator.setLatestPrice(String(-10));
    await aggregatorEUR.setLatestPrice(String(1e8));

    await expectRevert(feed.getAssetPrice(weth.address), "Price data not valid");
  });

  // Value out-of-bounds
  it.skip("should prevent overflow errors when the EUR aggregater returns a negative answer", async () => {
    await aggregator.setLatestPrice(String(400e8));
    await aggregatorEUR.setLatestPrice(String(-10));

    await expectRevert(feed.getAssetPrice(weth.address), "EUR price data not valid");
  });

  // Value out-of-bounds
  it.skip("should prevent overflow errors when the EUR aggregater returns a negative answer", async () => {
    await aggregator.setLatestPrice(String(400e8));
    await aggregatorEUR.setLatestPrice(String(-10));

    await expectRevert(feed.getAssetPrice(weth.address), "EUR price data not valid");
  });

  it("should convert collateral to stablecoin correctly accounting for different decimals in the oracles correctly", async () => {
    const aggregatorEUR = await MockChainlinkAggregator.new(6, 1e6, "EUR / USD");
    const aggregatorETH = await MockChainlinkAggregator.new(8, 400e8, "ETH / USD");
    feed = await PriceFeed.new(a.address);
    await aggregatorEUR.setUpdatedAt(latestTime);
    await aggregatorETH.setUpdatedAt(latestTime);
    await feed.setAssetOracle(weth.address, aggregatorETH.address, { from: owner });
    await feed.setEurOracle(aggregatorEUR.address, { from: owner });

    const result = await feed.convertFrom(weth.address, String(1e18));
    assert.equal(result.toString(), String(400e18)); //
  });

  it("should convert collateral to stablecoin correctly accounting for different decimals in the oracles correctly", async () => {
    const aggregatorEUR = await MockChainlinkAggregator.new(8, 1e8, "EUR / USD");
    const aggregatorETH = await MockChainlinkAggregator.new(6, 400e6, "ETH / USD");
    feed = await PriceFeed.new(a.address);
    await aggregatorEUR.setUpdatedAt(latestTime);
    await aggregatorETH.setUpdatedAt(latestTime);
    await feed.setAssetOracle(weth.address, aggregatorETH.address, { from: owner });
    await feed.setEurOracle(aggregatorEUR.address, { from: owner });

    const result = await feed.convertFrom(weth.address, String(1e18));
    assert.equal(result.toString(), String(400e18)); //
  });

  it("should handle ERC20 decimals of below 18 correctly", async () => {
    const e8 = new BN("100000000");
    const e18 = new BN("1000000000000000000");
    const aggregatorEUR = await MockChainlinkAggregator.new(6, "1250000", "EUR / USD"); // 1 EUR = 1.25 USD
    const aggregatorWBTC = await MockChainlinkAggregator.new(8, 40000e8, "BTC / USD"); // 1 BTC = 40k USD
    feed = await PriceFeed.new(a.address);
    const wbtc = await MockERC20.new("Wrapped Bitcoin", "WBTC", "8");
    await aggregatorEUR.setUpdatedAt(latestTime);
    await aggregatorWBTC.setUpdatedAt(latestTime);
    await feed.setAssetOracle(wbtc.address, aggregatorWBTC.address, { from: owner });
    await feed.setEurOracle(aggregatorEUR.address, { from: owner });

    const wbtc_amount = new BN("1").mul(e8); // 1 WBTC with 8 decimals
    const result1 = await feed.convertFrom(wbtc.address, wbtc_amount);

    const par_amount = new BN("32000").mul(e18); // 32k PAR
    assert.equal(result1.toString(), par_amount.toString());

    const result2 = await feed.convertTo(wbtc.address, par_amount);
    assert.equal(result2.toString(), wbtc_amount.toString());
  });

  it("should handle ERC20 decimals above 18 correctly", async () => {
    const e18 = new BN("1000000000000000000");
    const e27 = new BN("1000000000000000000000000000");
    const aggregatorEUR = await MockChainlinkAggregator.new(6, "1250000", "EUR / USD"); // 1 EUR = 1.25 USD
    const aggregatorXRP = await MockChainlinkAggregator.new(8, 4e6, "XRP / USD"); // 1 XRP = 0.04 USD
    feed = await PriceFeed.new(a.address);
    const wxrp = await MockERC20.new("Wrapped XRP", "WXRP", "27");
    await aggregatorEUR.setUpdatedAt(latestTime);
    await aggregatorXRP.setUpdatedAt(latestTime);
    await feed.setAssetOracle(wxrp.address, aggregatorXRP.address, { from: owner });
    await feed.setEurOracle(aggregatorEUR.address, { from: owner });

    const wxrp_amount = new BN("1000").mul(e27); // 100 XRP with 27 decimals
    const result1 = await feed.convertFrom(wxrp.address, wxrp_amount);

    const par_amount = new BN("32").mul(e18); // 4 PAR
    assert.equal(result1.toString(), par_amount.toString());

    const result2 = await feed.convertTo(wxrp.address, par_amount);
    assert.equal(result2.toString(), wxrp_amount.toString());
  });
});
